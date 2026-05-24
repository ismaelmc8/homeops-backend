import { pool } from "../config/db.js";
import * as metaModel from "../models/meta.model.js";
import * as zoneModel from "../models/zone.model.js";
import * as taskModel from "../models/task.model.js";
import * as eventModel from "../models/event.model.js";
import * as userModel from "../models/user.model.js";
import { computeChaosRisk } from "../utils/chaos.js";
import {
  DAILY_MISSIONS,
  SEASON_THEMES,
  SEASON_EPOCH,
  MS_PER_WEEK,
  BASE_BUFF_BY_STATE,
  BASE_STATE_LABELS,
  RANDOM_EVENT_CHANCE,
  RANDOM_EVENT_HOURS,
  RANDOM_EVENT_MULTIPLIER,
  MAX_STACKED_BONUS_EVENTS,
  BOSS_REWARD_COINS,
  BOSS_RESTORE_DIRT_LEVEL,
  BOSS_TASK_DURATION_MIN,
  RECOVERY_MICRO_PER_DAY,
  RECOVERY_MIN_DAYS,
  RECOVERY_MAX_DAYS,
} from "../constants/meta.js";

function todayDateStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function pickDailyMission(homeId, dateStr) {
  let hash = homeId;
  for (const c of dateStr) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return DAILY_MISSIONS[hash % DAILY_MISSIONS.length];
}

export function getCurrentSeason(date = new Date()) {
  const elapsed = date.getTime() - SEASON_EPOCH.getTime();
  const totalWeeks = SEASON_THEMES.reduce((s, t) => s + t.weeks, 0);
  const cycleMs = totalWeeks * MS_PER_WEEK;
  const pos = ((elapsed % cycleMs) + cycleMs) % cycleMs;
  let acc = 0;
  for (const theme of SEASON_THEMES) {
    const span = theme.weeks * MS_PER_WEEK;
    if (pos < acc + span) {
      const weekInSeason = Math.floor((pos - acc) / MS_PER_WEEK) + 1;
      const seasonStart = new Date(
        SEASON_EPOCH.getTime() + Math.floor(elapsed / cycleMs) * cycleMs + acc
      );
      const seasonEnd = new Date(seasonStart.getTime() + span);
      return {
        ...theme,
        weekInSeason,
        weeksTotal: theme.weeks,
        startsAt: seasonStart.toISOString(),
        endsAt: seasonEnd.toISOString(),
      };
    }
    acc += span;
  }
  return { ...SEASON_THEMES[0], weekInSeason: 1, weeksTotal: 5 };
}

export function computeLivingBase(zones, chaosRisk) {
  const total = zones.length;
  const stableCount = zones.filter((z) => z.dirt_level <= 1).length;
  const stabilityPercent = total ? Math.round((stableCount / total) * 100) : 100;
  const hasCollapse = zones.some((z) => z.dirt_level >= 5);
  const criticalCount = zones.filter((z) => z.dirt_level >= 4).length;

  if (hasCollapse || chaosRisk >= 70) {
    return {
      state: "recovery",
      label: BASE_STATE_LABELS.recovery,
      buffPercent: BASE_BUFF_BY_STATE.recovery,
      stabilityPercent,
      alert: hasCollapse
        ? "Hay zona(s) en colapso. Activa el plan de recuperación gradual."
        : "Riesgo de caos alto. Prioriza microtareas y zonas críticas.",
    };
  }
  if (stabilityPercent >= 80 && zones.every((z) => z.dirt_level <= 1)) {
    return {
      state: "radiant",
      label: BASE_STATE_LABELS.radiant,
      buffPercent: BASE_BUFF_BY_STATE.radiant,
      stabilityPercent,
      alert: null,
    };
  }
  if (stabilityPercent >= 60) {
    return {
      state: "stable",
      label: BASE_STATE_LABELS.stable,
      buffPercent: BASE_BUFF_BY_STATE.stable,
      stabilityPercent,
      alert: criticalCount > 0 ? `${criticalCount} zona(s) en riesgo.` : null,
    };
  }
  return {
    state: "attention",
    label: BASE_STATE_LABELS.attention,
    buffPercent: BASE_BUFF_BY_STATE.attention,
    stabilityPercent,
    alert: "El hogar acumula suciedad. Un poco cada día evita maratones.",
  };
}

export function buildRecoveryPlan(chaosRisk, zones) {
  const collapsed = zones.filter((z) => z.dirt_level >= 5).length;
  let days = RECOVERY_MIN_DAYS;
  if (chaosRisk >= 85 || collapsed >= 2) days = RECOVERY_MAX_DAYS;
  else if (chaosRisk >= 70 || collapsed >= 1) days = 5;

  const microPerDay = RECOVERY_MICRO_PER_DAY;
  return {
    days,
    microPerDay,
    minutesPerDay: microPerDay * 5,
    totalMicroTasks: days * microPerDay,
    message: `Plan sugerido: ${microPerDay} microtareas/día durante ${days} días (~${microPerDay * 5} min/día).`,
    collapsedZones: collapsed,
  };
}

export async function ensureDailyMission(homeId, conn = pool) {
  const dateStr = todayDateStr();
  let row = await metaModel.getDailyMission(homeId, dateStr, conn);
  if (row) return row;

  const def = pickDailyMission(homeId, dateStr);
  row = await metaModel.createDailyMission(homeId, dateStr, def.key, def.target, conn);
  return row;
}

export function formatDailyMission(row) {
  const def = DAILY_MISSIONS.find((m) => m.key === row.mission_key) ?? DAILY_MISSIONS[0];
  return {
    id: row.id,
    date: row.mission_date,
    key: row.mission_key,
    label: def.label,
    target: row.target_value,
    progress: row.progress,
    completed: !!row.completed_at,
    percent: row.target_value
      ? Math.min(100, Math.round((row.progress / row.target_value) * 100))
      : 0,
  };
}

export async function maybeSpawnRandomEvent(homeId, userId, conn = pool) {
  if (!userId) return null;
  const settings = await metaModel.getSettings(homeId, conn);
  if (!settings.random_events_enabled) return null;

  if (await metaModel.hasRandomEventToday(homeId, conn)) return null;

  const stacked = await metaModel.countActiveBonusEvents(homeId, conn);
  if (stacked >= MAX_STACKED_BONUS_EVENTS) return null;

  if (Math.random() > RANDOM_EVENT_CHANCE) return null;

  const start = new Date();
  const end = new Date(start.getTime() + RANDOM_EVENT_HOURS * 60 * 60 * 1000);
  const row = await eventModel.create(
    {
      homeId,
      eventType: "random_bonus",
      startsAt: start,
      endsAt: end,
      createdBy: userId,
    },
    conn
  );

  return {
    id: row.id,
    eventType: "random_bonus",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    label: `Impulso sorpresa (+${Math.round((RANDOM_EVENT_MULTIPLIER - 1) * 100)}% monedas)`,
  };
}

export async function ensureBossMissions(homeId, conn = pool) {
  const zones = await zoneModel.listByHome(homeId);
  const collapsed = zones.filter((z) => z.dirt_level >= 5);
  const created = [];

  for (const zone of collapsed) {
    const existing = await metaModel.findBossByZone(homeId, zone.id, conn);
    if (existing) continue;

    const task = await taskModel.create(
      {
        homeId,
        zoneId: zone.id,
        name: `Boss: Rescate de ${zone.name}`,
        taskType: "deep",
        difficulty: 4,
        durationMin: BOSS_TASK_DURATION_MIN,
        frequencyIdealDays: 365,
        frequencyToleranceDays: 30,
        frequencyCriticalDays: 60,
        dirtReduction: 4,
        isMicro: false,
        isCooperative: true,
        isBoss: true,
      },
      conn
    );

    const boss = await metaModel.createBossMission(homeId, zone.id, task.id, conn);
    created.push({
      id: boss.id,
      zoneId: zone.id,
      zoneName: zone.name,
      taskId: task.id,
      taskName: task.name,
    });
  }

  return created;
}

export async function syncLivingBase(homeId, conn = pool) {
  const zones = await zoneModel.listByHome(homeId);
  const tasks = await taskModel.listByHome(homeId);
  const chaosRisk = computeChaosRisk(zones, tasks);
  const living = computeLivingBase(zones, chaosRisk);
  const settings = await metaModel.getSettings(homeId, conn);

  let recoveryStartedAt = settings.recovery_started_at;
  if (living.state === "recovery" && !recoveryStartedAt) {
    recoveryStartedAt = new Date();
  } else if (living.state !== "recovery") {
    recoveryStartedAt = null;
  }

  await metaModel.updateSettings(
    homeId,
    {
      baseState: living.state,
      baseBuffCoinsPct: living.buffPercent,
      recoveryStartedAt,
    },
    conn
  );

  return { living, chaosRisk };
}

export async function getMetaDashboard(homeId, userId) {
  await ensureBossMissions(homeId);
  const { living, chaosRisk } = await syncLivingBase(homeId);
  const dailyRow = await ensureDailyMission(homeId);
  const dailyMission = formatDailyMission(dailyRow);
  const season = getCurrentSeason();
  await metaModel.ensureSeasonJoined(homeId, season.key);

  const zones = await zoneModel.listByHome(homeId);
  const recoveryPlan =
    living.state === "recovery" ? buildRecoveryPlan(chaosRisk, zones) : null;

  const bosses = (await metaModel.listActiveBossMissions(homeId)).map((b) => ({
    id: b.id,
    zoneId: b.zone_id,
    zoneName: b.zone_name,
    taskId: b.task_id,
    dirtLevel: b.dirt_level,
  }));

  const randomSpawned = await maybeSpawnRandomEvent(homeId, userId);

  const activeEvents = await eventModel.getActive(homeId);
  let randomBonusActive = null;
  if (activeEvents?.event_type === "random_bonus") {
    randomBonusActive = {
      endsAt: activeEvents.ends_at,
      multiplier: RANDOM_EVENT_MULTIPLIER,
    };
  }

  const settings = await metaModel.getSettings(homeId);

  return {
    livingBase: {
      state: living.state,
      label: living.label,
      buffPercent: living.buffPercent,
      stabilityPercent: living.stabilityPercent,
      alert: living.alert,
    },
    chaosRisk,
    dailyMission,
    season: {
      key: season.key,
      name: season.name,
      emoji: season.emoji,
      weekInSeason: season.weekInSeason,
      weeksTotal: season.weeksTotal,
      endsAt: season.endsAt,
      cosmeticNote: "Temporada cosmética — no resetea XP ni historial.",
    },
    recoveryPlan,
    bossMissions: bosses,
    randomBonusActive,
    randomEventSpawned: randomSpawned,
    settings: {
      randomEventsEnabled: !!settings.random_events_enabled,
    },
  };
}

export async function updateMetaSettings(homeId, userId, { randomEventsEnabled }) {
  await metaModel.updateSettings(homeId, {
    randomEventsEnabled: !!randomEventsEnabled,
  });
  return getMetaDashboard(homeId, userId);
}

export async function onTaskCompletedMeta(
  homeId,
  { isMicro, isCooperative, dirtLevel, userId },
  conn
) {
  const row = await ensureDailyMission(homeId, conn);
  if (row.completed_at) return { dailyCompleted: false };

  const def = DAILY_MISSIONS.find((m) => m.key === row.mission_key);
  if (!def) return { dailyCompleted: false };

  let increment = 0;
  if (def.type === "micro" && isMicro) increment = 1;
  if (def.type === "coop" && isCooperative) increment = 1;
  if (def.type === "preventive" && dirtLevel <= 1) increment = 1;

  if (increment <= 0) return { dailyCompleted: false };

  const wasComplete = !!row.completed_at;
  const updated = await metaModel.incrementDailyProgress(row.id, increment, conn);
  const justCompleted = !!updated.completed_at && !wasComplete;

  if (justCompleted && userId) {
    await userModel.addCoins(userId, 8, conn);
  }

  return {
    dailyCompleted: justCompleted,
    dailyProgress: updated.progress,
    dailyTarget: updated.target_value,
  };
}

export async function onBossTaskCompleted(homeId, taskId, userId, conn) {
  const [bossRows] = await conn.query(
    "SELECT * FROM home_boss_missions WHERE home_id = ? AND task_id = ? AND status = 'active'",
    [homeId, taskId]
  );
  const boss = bossRows[0];
  if (!boss) return { bossBonus: 0, messages: [] };

  await metaModel.setZoneDirtLevel(boss.zone_id, homeId, BOSS_RESTORE_DIRT_LEVEL, conn);
  await metaModel.completeBossMission(boss.id, conn);
  await conn.query("UPDATE tasks SET active = 0 WHERE id = ?", [taskId]);

  const [members] = await conn.query(
    "SELECT id FROM users WHERE home_id = ? AND status = 'active'",
    [homeId]
  );
  const share = members.length
    ? Math.max(1, Math.floor(BOSS_REWARD_COINS / members.length))
    : BOSS_REWARD_COINS;
  await userModel.addCoins(userId, share, conn);

  await syncLivingBase(homeId, conn);

  return {
    bossBonus: share,
    messages: [
      `¡Boss derrotado! Zona restaurada a nivel ${BOSS_RESTORE_DIRT_LEVEL}. +${share} monedas (rescate, no grind).`,
    ],
  };
}

export function getCombinedEventMultiplier(activeEvent, durationMin) {
  if (!activeEvent) return 1;
  if (activeEvent.event_type === "random_bonus") return RANDOM_EVENT_MULTIPLIER;
  if (activeEvent.event_type === "speedrun" && durationMin <= 15) return 1.5;
  return 1;
}

export async function getHomeBuffMultiplier(homeId, conn = pool) {
  const settings = await metaModel.getSettings(homeId, conn);
  const pct = settings.base_buff_coins_pct ?? 0;
  return 1 + pct / 100;
}
