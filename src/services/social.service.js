import { BadRequestError } from "../exceptions/BadRequestError.js";
import { ConflictError } from "../exceptions/ConflictError.js";
import { ForbiddenError } from "../exceptions/ForbiddenError.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";
import * as socialModel from "../models/social.model.js";
import { withTransaction } from "./home.service.js";
import * as userModel from "../models/user.model.js";
import * as microGoalModel from "../models/microGoal.model.js";
import { getBalanceMetrics } from "./balanceMetrics.service.js";
import { getWeeklyGoal } from "./goal.service.js";
import { FEEDBACK_CHIPS, FEEDBACK_EMOJIS, COMPLETION_TAGS } from "../constants/social.js";

export function getSocialCatalog() {
  return {
    chips: FEEDBACK_CHIPS,
    emojis: FEEDBACK_EMOJIS,
    tags: COMPLETION_TAGS,
  };
}

export async function getSettings(homeId) {
  return socialModel.getHomeSocialSettings(homeId);
}

export async function updateSettings(homeId, { mvpEnabled, rankingEnabled }) {
  return socialModel.updateHomeSocialSettings(homeId, {
    mvpEnabled: !!mvpEnabled,
    rankingEnabled: !!rankingEnabled,
  });
}

export async function attachCompletionFeedback(
  completionId,
  { feedbackChip, feedbackEmoji, tags },
  conn
) {
  const validChips = new Set(FEEDBACK_CHIPS.map((c) => c.id));
  const validTags = new Set(COMPLETION_TAGS.map((t) => t.id));

  if (feedbackChip && !validChips.has(feedbackChip)) {
    throw new BadRequestError("Chip de feedback no válido.");
  }
  if (feedbackEmoji && !FEEDBACK_EMOJIS.includes(feedbackEmoji)) {
    throw new BadRequestError("Emoji no válido.");
  }
  const tagList = (tags ?? []).filter((t) => validTags.has(t));

  await socialModel.updateCompletionFeedback(
    completionId,
    { feedbackChip: feedbackChip || null, feedbackEmoji: feedbackEmoji || null, tags: tagList },
    conn
  );
}

export async function sendKudos(homeId, fromUserId, { toUserId, completionId }) {
  if (!toUserId || toUserId === fromUserId) {
    throw new BadRequestError("Destinatario no válido.");
  }
  const target = await userModel.findByIdInHome(toUserId, homeId);
  if (!target || target.status !== "active") {
    throw new NotFoundError("Miembro no encontrado.");
  }
  if (completionId) {
    const already = await socialModel.hasKudosFromUser(completionId, fromUserId);
    if (already) throw new ConflictError("Ya enviaste kudos a esta acción.");
  }

  await socialModel.addKudos({
    homeId,
    fromUserId,
    toUserId,
    completionId: completionId ?? null,
  });

  return { message: `Kudos enviado a ${target.name}.` };
}

export async function getTimeline(homeId, filters = {}) {
  const items = await socialModel.listTimeline(homeId, filters);
  return items.map((row) => ({
    id: row.id,
    completedAt: row.completed_at,
    taskName: row.task_name,
    taskType: row.task_type,
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    userId: row.user_id,
    userName: row.user_name,
    coinsEarned: row.coins_earned + (row.coop_bonus_coins ?? 0),
    feedbackChip: row.feedback_chip,
    feedbackEmoji: row.feedback_emoji,
    tags: row.completion_tags ?? [],
    kudosCount: row.kudos_count,
    isPreventive: row.zone_dirt_at_completion <= 1,
    peerAvgRating: row.quality_rating != null ? Number(row.quality_rating) : null,
  }));
}

/** MVP: miembro con mejor equilibrio fiabilidad/reparto (no el de más volumen). */
export async function getWeeklyMvp(homeId) {
  const settings = await socialModel.getHomeSocialSettings(homeId);
  if (!settings.mvpEnabled) return { enabled: false, mvp: null };

  const balance = await getBalanceMetrics(homeId, 7);
  if (balance.members.length < 2) {
    return { enabled: true, mvp: null, reason: "Se necesitan al menos 2 miembros activos." };
  }

  let best = null;
  let bestScore = -1;
  for (const m of balance.members) {
    const sharePenalty = Math.abs(m.sharePercent - 50);
    const score = m.reliabilityPercent - sharePenalty * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return {
    enabled: true,
    mvp: best
      ? {
          userId: best.userId,
          name: best.name,
          reliabilityPercent: best.reliabilityPercent,
          sharePercent: best.sharePercent,
          label: "Contribución equilibrada esta semana",
        }
      : null,
  };
}

/** Ranking amistoso: progreso hacia objetivo común del hogar (no castigo). */
export async function getFriendlyRanking(homeId) {
  const settings = await socialModel.getHomeSocialSettings(homeId);
  if (!settings.rankingEnabled) return { enabled: false, entries: [] };

  const weeklyGoal = await getWeeklyGoal(homeId);
  const members = await userModel.listByHomeId(homeId);
  const active = members.filter((m) => m.status === "active");

  const entries = active.map((m) => ({
    userId: m.id,
    name: m.name,
    teamProgressPercent: weeklyGoal.progress.percent,
    label: "Progreso del hogar hacia el objetivo semanal",
  }));

  entries.sort((a, b) => b.teamProgressPercent - a.teamProgressPercent);

  return { enabled: true, entries, weeklyGoalLabel: weeklyGoal.progress.label };
}

export async function getMicroGoals(homeId, userId) {
  const goal = await microGoalModel.getOrCreateToday(userId, homeId);
  return {
    goalDate: goal.goal_date,
    goalType: goal.goal_type,
    target: goal.target_value,
    progress: goal.progress_value,
    met: !!goal.completed_at || goal.progress_value >= goal.target_value,
    label: `${goal.target_value} microtareas hoy`,
  };
}

/** Tareas completadas por otros miembros pendientes de calificar por el usuario actual. */
export async function getPendingRatings(homeId, userId, { days = 14 } = {}) {
  const [rows, context] = await Promise.all([
    socialModel.listPendingPeerRatings(homeId, userId, { days }),
    socialModel.getPendingRatingsContext(homeId, userId, days),
  ]);

  let emptyReason = null;
  if (rows.length === 0) {
    if (context.activeMembers < 2) {
      emptyReason = "solo_member";
    } else if (context.othersCompletions === 0) {
      emptyReason = context.ownCompletions > 0 ? "only_own_completions" : "no_completions";
    } else {
      emptyReason = "all_rated";
    }
  }

  return {
    items: rows.map((row) => ({
      completionId: row.completion_id,
      completedAt: row.completed_at,
      taskName: row.task_name,
      zoneName: row.zone_name,
      userId: row.user_id,
      userName: row.user_name,
      avgRating: row.avg_rating != null ? Number(row.avg_rating) : null,
      ratingCount: row.rating_count ?? 0,
    })),
    pendingCount: rows.length,
    emptyReason,
    context,
  };
}

/** Calificar un completado ajeno (1–5 estrellas). Solo quien no hizo la tarea. */
export async function rateCompletion(homeId, raterUserId, completionId, rating) {
  const q = Math.round(Number(rating));
  if (!Number.isFinite(q) || q < 1 || q > 5) {
    throw new BadRequestError("La valoración debe ser entre 1 y 5 estrellas.");
  }

  const completion = await socialModel.findCompletionForRating(completionId, homeId);
  if (!completion) throw new NotFoundError("Completado no encontrado.");
  if (completion.completer_id === raterUserId) {
    throw new ForbiddenError("No puedes calificar una tarea que tú completaste.");
  }

  const already = await socialModel.hasPeerRating(completionId, raterUserId);
  if (already) throw new ConflictError("Ya calificaste esta tarea.");

  let avgRating = null;
  await withTransaction(async (conn) => {
    await socialModel.addPeerRating({ completionId, raterUserId, rating: q }, conn);
    avgRating = await socialModel.syncCompletionQualityFromPeers(completionId, conn);
  });

  return {
    message: "¡Gracias por calificar!",
    rating: q,
    avgRating,
  };
}

export async function getPendingRatingsCount(homeId, userId) {
  return socialModel.countPendingPeerRatings(homeId, userId);
}

export async function afterCompletionSocial(
  { homeId, userId, completionId, zoneDirt, isMicro, taskType },
  conn
) {
  const micro = await microGoalModel.incrementMicroProgress(userId, homeId, {
    isMicro: isMicro || taskType === "micro",
    isPreventive: zoneDirt <= 1,
  }, conn);

  return { microGoal: micro };
}
