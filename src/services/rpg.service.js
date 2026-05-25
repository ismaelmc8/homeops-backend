import { BadRequestError } from "../exceptions/BadRequestError.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";
import * as rpgModel from "../models/rpg.model.js";
import * as userModel from "../models/user.model.js";
import { withTransaction } from "./home.service.js";
import {
  LEVEL_THRESHOLDS,
  RANKS,
  TITLES,
  ACHIEVEMENT_DEFS,
  SPECIALIZATIONS,
  SPEC_COOLDOWN_DAYS,
  STATS_LABELS,
} from "../constants/rpg.js";

export function levelFromXp(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const prevThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const progress =
    nextThreshold > prevThreshold
      ? Math.min(100, Math.round(((xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
      : 100;
  return { level, nextThreshold, prevThreshold, progressPercent: progress };
}

export function rankForLevel(level) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel) rank = r;
  }
  return rank;
}

export function computeStats({ completions, coopCount }) {
  if (!completions.length) {
    return {
      order: 0,
      technique: 0,
      endurance: 50,
      speed: 0,
      cooperation: 0,
    };
  }

  let onTime = 0;
  let withDuration = 0;
  let efficiencySum = 0;
  let speedSum = 0;

  for (const c of completions) {
    if (c.zone_dirt_at_completion <= 1) onTime++;
    if (c.duration_actual > 0 && c.duration_min > 0) {
      withDuration++;
      const ratio = c.duration_actual / c.duration_min;
      if (ratio <= 1) efficiencySum += 1;
      speedSum += Math.min(100, Math.round((c.duration_min / c.duration_actual) * 50));
    }
  }

  const n = completions.length;
  return {
    order: Math.round((onTime / n) * 100),
    technique: withDuration ? Math.round((efficiencySum / withDuration) * 100) : 50,
    endurance: Math.min(100, 40 + Math.round((n / 30) * 60)),
    speed: withDuration ? Math.round(speedSum / withDuration) : 50,
    cooperation: Math.min(100, coopCount * 15),
  };
}

export async function getActiveBuffEffects(userId) {
  const rows = await rpgModel.getActiveBuffs(userId);
  const effects = {
    fatigueSoft: false,
    coopMultiplier: 1,
    qualityMultiplier: 1,
  };
  for (const b of rows) {
    if (b.buff_key === "buff_quiet_hour") effects.fatigueSoft = true;
    if (b.buff_key === "buff_duo") effects.coopMultiplier = Number(b.multiplier) || 1.15;
    if (b.buff_key === "buff_quality_eye") effects.qualityMultiplier = Number(b.multiplier) || 1.1;
  }
  return { buffs: rows, effects };
}

export async function getRpgProfile(userId, homeId) {
  const user = await userModel.findById(userId);
  if (!user) throw new NotFoundError("Usuario no encontrado.");

  const prefs = await rpgModel.getPrefs(userId);
  const achievements = await rpgModel.listAchievements(userId);
  const achievementKeys = new Set(achievements.map((a) => a.achievement_key));
  const { level, nextThreshold, progressPercent } = levelFromXp(user.xp);
  const rank = rankForLevel(level);
  const raw = await rpgModel.getStatsRaw(userId, homeId);
  const stats = computeStats(raw);
  const { buffs, effects } = await getActiveBuffEffects(userId);
  const cosmetics = await rpgModel.listCosmetics(userId);
  const shop = await rpgModel.listShopItems();

  const titles = TITLES.map((t) => ({
    ...t,
    unlocked: achievementKeys.has(t.unlockAchievement),
    equipped: prefs.equipped_title_key === t.key,
  }));

  let specCooldownDaysLeft = 0;
  if (prefs.specialization_changed_at) {
    const changed = new Date(prefs.specialization_changed_at).getTime();
    const days = (Date.now() - changed) / (86400000);
    specCooldownDaysLeft = Math.max(0, Math.ceil(SPEC_COOLDOWN_DAYS - days));
  }

  return {
    xp: user.xp,
    level,
    levelProgressPercent: progressPercent,
    xpToNextLevel: nextThreshold,
    rank,
    specialization: prefs.specialization,
    specializationCatalog: SPECIALIZATIONS,
    specCooldownDaysLeft,
    equippedTitleKey: prefs.equipped_title_key,
    equippedCosmeticKey: prefs.equipped_cosmetic_key,
    titles,
    achievements: ACHIEVEMENT_DEFS.map((a) => ({
      ...a,
      unlocked: achievementKeys.has(a.key),
      unlockedAt: achievements.find((x) => x.achievement_key === a.key)?.unlocked_at ?? null,
    })),
    stats: Object.entries(stats).map(([key, value]) => ({
      key,
      label: STATS_LABELS[key],
      value,
    })),
    activeBuffs: buffs.map((b) => ({
      key: b.buff_key,
      expiresAt: b.expires_at,
    })),
    buffEffects: effects,
    cosmeticsOwned: cosmetics.map((c) => c.cosmetic_key),
    shop: shop.map((s) => ({
      key: s.item_key,
      name: s.name,
      description: s.description,
      costCoins: s.cost_coins,
      itemType: s.item_type,
      owned: cosmetics.some((c) => c.cosmetic_key === s.item_key),
    })),
  };
}

export async function setSpecialization(userId, specialization) {
  const valid = SPECIALIZATIONS.find((s) => s.key === specialization);
  if (!valid) throw new BadRequestError("Especialización no válida.");

  const prefs = await rpgModel.getPrefs(userId);
  if (prefs.specialization_changed_at) {
    const days =
      (Date.now() - new Date(prefs.specialization_changed_at).getTime()) / 86400000;
    if (days < SPEC_COOLDOWN_DAYS && prefs.specialization !== specialization) {
      throw new BadRequestError(
        `Puedes cambiar de especialización en ${Math.ceil(SPEC_COOLDOWN_DAYS - days)} día(s).`
      );
    }
  }

  await rpgModel.updateSpecialization(userId, specialization);
  return { specialization: specialization, message: `Especialización: ${valid.label}.` };
}

export async function equipTitle(userId, titleKey) {
  if (!titleKey) {
    await rpgModel.setEquippedTitle(userId, null);
    return { equippedTitleKey: null };
  }
  const def = TITLES.find((t) => t.key === titleKey);
  if (!def) throw new BadRequestError("Título no válido.");
  const achievements = await rpgModel.listAchievements(userId);
  if (!achievements.some((a) => a.achievement_key === def.unlockAchievement)) {
    throw new BadRequestError("Título no desbloqueado.");
  }
  await rpgModel.setEquippedTitle(userId, titleKey);
  return { equippedTitleKey: titleKey };
}

export async function purchaseShopItem(userId, itemKey) {
  const item = await rpgModel.getShopItem(itemKey);
  if (!item) throw new NotFoundError("Artículo no encontrado.");

  if (item.item_type === "cosmetic") {
    const owned = await rpgModel.ownsCosmetic(userId, itemKey);
    if (owned) throw new BadRequestError("Ya tienes este cosmético.");
  }

  await withTransaction(async (conn) => {
    const ok = await userModel.deductCoins(userId, item.cost_coins, conn);
    if (!ok) throw new BadRequestError("Monedas insuficientes.");

    if (item.item_type === "buff") {
      const expires = new Date(
        Date.now() + (item.duration_hours || 24) * 3600 * 1000
      );
      await rpgModel.addActiveBuff(
        {
          userId,
          buffKey: itemKey,
          multiplier: item.buff_multiplier || 1,
          expiresAt: expires,
        },
        conn
      );
    } else {
      await rpgModel.grantCosmetic(userId, itemKey, conn);
      await rpgModel.setEquippedCosmetic(userId, itemKey, conn);
    }
  });

  const wallet = await userModel.getWallet(userId);
  return {
    message: `Comprado: ${item.name}.`,
    wallet,
  };
}

export async function equipCosmetic(userId, cosmeticKey) {
  if (!cosmeticKey) {
    await rpgModel.setEquippedCosmetic(userId, null);
    return { equippedCosmeticKey: null };
  }
  const owned = await rpgModel.ownsCosmetic(userId, cosmeticKey);
  if (!owned) throw new BadRequestError("No posees este cosmético.");
  await rpgModel.setEquippedCosmetic(userId, cosmeticKey);
  return { equippedCosmeticKey: cosmeticKey };
}

export async function revokeAllSessions(userId) {
  await rpgModel.incrementTokenVersion(userId);
  return { message: "Sesiones cerradas en todos los dispositivos. Vuelve a iniciar sesión." };
}

export async function afterCompletionAchievements(
  userId,
  homeId,
  { streakCount, dirtLevel, isMicro, isCooperative, coopBonusCoins },
  conn
) {
  if (streakCount >= 7) await rpgModel.unlockAchievement(userId, "streak_7", conn);
  if (streakCount >= 30) await rpgModel.unlockAchievement(userId, "streak_30", conn);

  const preventiveCount = await rpgModel.countCompletions(
    userId,
    homeId,
    { preventive: true },
    conn
  );
  if (preventiveCount >= 10) await rpgModel.unlockAchievement(userId, "preventive_10", conn);

  const coopCount = await rpgModel.countCompletions(
    userId,
    homeId,
    { cooperative: true },
    conn
  );
  if (coopCount >= 5) await rpgModel.unlockAchievement(userId, "coop_5", conn);

  const microCount = await rpgModel.countCompletions(userId, homeId, { micro: true }, conn);
  if (microCount >= 20) await rpgModel.unlockAchievement(userId, "micro_20", conn);
}

export function getRpgRewardModifiers({
  specialization,
  qualityRating,
  dirtLevel,
  durationMin,
  taskType,
  isCooperative,
  buffEffects,
}) {
  let specCoinMult = 1;
  let specXpMult = 1;
  let extraEfficiencyPercent = 0;

  if (specialization === "speedrunner" && durationMin <= 10) {
    extraEfficiencyPercent = 5;
  }
  if (specialization === "preventive" && dirtLevel <= 2) {
    specCoinMult *= 1.08;
  }
  if (specialization === "cooperative" && isCooperative) {
    specCoinMult *= 1.05;
  }
  if (specialization === "deep" && taskType === "deep" && dirtLevel <= 2) {
    specXpMult *= 1.15;
  }

  let qualityCoinMult = 1;
  let qualityXpMult = 1;
  const q = Number(qualityRating);
  if (q >= 4) {
    qualityCoinMult = 1.1 * (buffEffects?.qualityMultiplier ?? 1);
    qualityXpMult = 1.1 * (buffEffects?.qualityMultiplier ?? 1);
  }

  let fatiguePointsMultiplier = 1;
  if (buffEffects?.fatigueSoft) fatiguePointsMultiplier = 0.75;

  return {
    specCoinMult,
    specXpMult,
    extraEfficiencyPercent,
    qualityCoinMult,
    qualityXpMult,
    fatiguePointsMultiplier,
    coopBuffMultiplier: buffEffects?.coopMultiplier ?? 1,
  };
}
