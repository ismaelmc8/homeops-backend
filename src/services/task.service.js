import { NotFoundError } from "../exceptions/NotFoundError.js";
import { BadRequestError } from "../exceptions/BadRequestError.js";
import * as taskModel from "../models/task.model.js";
import * as zoneModel from "../models/zone.model.js";
import * as userModel from "../models/user.model.js";
import * as streakModel from "../models/streak.model.js";
import * as fatigueModel from "../models/fatigue.model.js";
import * as assigneeModel from "../models/assignee.model.js";
import {
  calculateReward,
  dirtReductionForTaskType,
  computePriority,
  kanbanColumn,
  DIRT_LABELS,
  isRecurrentTask,
  fatiguePointsForDifficulty,
  FATIGUE_LIMIT,
} from "./rewardEngine.js";
import { buildKanbanColumns, isRecoveryMode } from "./queue.service.js";
import { getUserMetrics } from "./metrics.service.js";
import { applyDeteriorationIfNeeded, withTransaction } from "./home.service.js";
import { processCooperativeCompletion } from "./cooperation.service.js";
import { getActiveEvent, getEventCoinMultiplier, tryPerfectDayBonus } from "./event.service.js";
import { getWeeklyGoal } from "./goal.service.js";
import { tryDailyPreventiveBonus } from "./dailyBonus.service.js";
import {
  getMicroGoals,
  getWeeklyMvp,
  getFriendlyRanking,
  attachCompletionFeedback,
  afterCompletionSocial,
  getSettings as getSocialSettings,
} from "./social.service.js";

function daysSinceCompletion(lastCompletedAt) {
  if (!lastCompletedAt) return null;
  return (Date.now() - new Date(lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24);
}

function stripInternalTaskFields(task) {
  const { priority, column, ...publicTask } = task;
  return publicTask;
}

function stripColumnTasks(columns) {
  return {
    critical: columns.critical.map(stripInternalTaskFields),
    today: columns.today.map(stripInternalTaskFields),
    recommended: columns.recommended.map(stripInternalTaskFields),
    next: columns.next.map(stripInternalTaskFields),
    todayMore: columns.todayMore,
    recommendedMore: columns.recommendedMore,
    nextMore: columns.nextMore,
  };
}

export async function getKanban(
  homeId,
  userId,
  { microOnly = false, assignedToMe = false } = {}
) {
  await applyDeteriorationIfNeeded(homeId);

  const lastActiveAt = await userModel.getLastActive(userId);
  const recoveryMode = isRecoveryMode(lastActiveAt);
  await userModel.touchLastActive(userId);

  const tasks = await taskModel.listByHome(homeId);
  const zones = await zoneModel.listByHome(homeId);
  const zoneMap = Object.fromEntries(zones.map((z) => [z.id, z]));
  const assigneeMap = await assigneeModel.listForTasks(tasks.map((t) => t.id));

  const recurrentIds = tasks.filter((t) => isRecurrentTask(t.task_type)).map((t) => t.id);
  const streakMap = await streakModel.listForUserTasks(userId, recurrentIds);

  const fatigueRow = await fatigueModel.getToday(userId);
  const fatiguePoints = fatigueRow.points ?? 0;

  let filteredTasks = tasks;
  if (assignedToMe) {
    filteredTasks = tasks.filter((t) => {
      const assignees = assigneeMap[t.id] ?? [];
      return assignees.length === 0 || assignees.some((a) => a.userId === userId);
    });
  }

  const enriched = filteredTasks.map((t) => {
    const zone = zoneMap[t.zone_id] ?? { dirt_level: t.zone_dirt_level, name: t.zone_name };
    const snoozed = t.snoozed_until && new Date(t.snoozed_until) > new Date();
    let column = kanbanColumn(t, zone);
    if (snoozed) column = "snoozed";
    const priority = snoozed ? 0 : computePriority(t, zone, { recoveryMode });
    const daysSince = daysSinceCompletion(t.last_completed_at);
    let scheduleStatus = "ok";
    if (daysSince !== null) {
      const overdue = daysSince - t.frequency_ideal_days;
      if (overdue > t.frequency_critical_days) scheduleStatus = "critical";
      else if (overdue > t.frequency_tolerance_days) scheduleStatus = "late";
      else if (overdue > 0) scheduleStatus = "tolerance";
    }
    const streakCount = streakMap[t.id] ?? 0;
    const assignees = assigneeMap[t.id] ?? [];
    return {
      id: t.id,
      name: t.name,
      zoneId: t.zone_id,
      zoneName: zone.name,
      dirtLevel: zone.dirt_level,
      dirtLabel: DIRT_LABELS[zone.dirt_level] ?? "—",
      taskType: t.task_type,
      difficulty: t.difficulty,
      durationMin: t.duration_min,
      isMicro: !!t.is_micro || t.task_type === "micro",
      isCooperative: !!t.is_cooperative,
      assignees,
      assignedToMe: assignees.length === 0 || assignees.some((a) => a.userId === userId),
      column,
      priority,
      scheduleStatus,
      lastCompletedAt: t.last_completed_at,
      streakCount: isRecurrentTask(t.task_type) ? streakCount : 0,
    };
  });

  enriched.sort((a, b) => b.priority - a.priority);

  const queue = buildKanbanColumns(enriched, { recoveryMode, microOnly });

  const atRisk = zones.filter((z) => z.dirt_level >= 4).length;
  let homeSummary = "Estado: estable";
  if (atRisk > 0) homeSummary = `${atRisk} zona(s) en riesgo`;
  else if (zones.some((z) => z.dirt_level >= 2)) homeSummary = "Estado: requiere atención pronto";

  const done = await taskModel.listRecentCompletions(homeId, 7);
  const activeEvent = await getActiveEvent(homeId);
  const weeklyGoal = await getWeeklyGoal(homeId);
  const microGoal = await getMicroGoals(homeId, userId);
  const weeklyMvp = await getWeeklyMvp(homeId);
  const friendlyRanking = await getFriendlyRanking(homeId);
  const socialSettings = await getSocialSettings(homeId);

  let welcomeMessage = null;
  if (recoveryMode) {
    welcomeMessage =
      "¡Qué bueno verte de nuevo! Sin presión: hoy solo lo esencial. Tus rachas siguen guardadas.";
  }

  return {
    columns: stripColumnTasks(queue.columns),
    zoneAggregates: queue.zoneAggregates,
    sessionSuggestion: queue.sessionSuggestion,
    recoveryMode,
    done,
    homeSummary,
    zones,
    activeEvent,
    weeklyGoal,
    microGoal,
    weeklyMvp,
    friendlyRanking,
    socialSettings,
    welcomeMessage,
    fatigue: {
      points: fatiguePoints,
      limit: FATIGUE_LIMIT,
      high: fatiguePoints > FATIGUE_LIMIT,
      nearLimit: fatiguePoints >= FATIGUE_LIMIT - 2 && fatiguePoints <= FATIGUE_LIMIT,
    },
  };
}

export async function setTaskAssignees(taskId, homeId, userIds) {
  const task = await taskModel.findById(taskId, homeId);
  if (!task) throw new NotFoundError("Tarea no encontrada.");

  const ids = [...new Set((userIds ?? []).map(Number).filter((id) => id > 0))];
  if (ids.length) {
    const members = await userModel.listByHomeId(homeId);
    const activeIds = new Set(members.filter((m) => m.status === "active").map((m) => m.id));
    for (const id of ids) {
      if (!activeIds.has(id)) {
        throw new BadRequestError("Solo puedes asignar a miembros activos del hogar.");
      }
    }
  }

  await assigneeModel.setAssignees(taskId, ids);
  const assignees = await assigneeModel.listForTask(taskId);
  return { taskId, assignees };
}

export async function completeTask(
  taskId,
  homeId,
  userId,
  { durationActualMin = null, feedbackChip = null, feedbackEmoji = null, tags = null } = {}
) {
  await applyDeteriorationIfNeeded(homeId);
  const task = await taskModel.findById(taskId, homeId);
  if (!task) throw new NotFoundError("Tarea no encontrada.");

  const dirtLevel = task.zone_dirt_level;
  const reduction = task.dirt_reduction || dirtReductionForTaskType(task.task_type);
  const daysSince = daysSinceCompletion(task.last_completed_at);

  const streakRow = isRecurrentTask(task.task_type)
    ? await streakModel.get(userId, taskId)
    : null;
  const currentStreak = streakRow?.count ?? 0;

  const fatigueBefore = await fatigueModel.getToday(userId);
  const fatiguePointsBefore = fatigueBefore.points ?? 0;
  const fatiguePointsAdded = fatiguePointsForDifficulty(task.difficulty);

  const activeEventRow = await getActiveEvent(homeId);
  const { multiplier: eventMultiplier } = getEventCoinMultiplier(
    activeEventRow ? { event_type: activeEventRow.eventType } : null,
    task.duration_min
  );

  const reward = calculateReward({
    difficulty: task.difficulty,
    durationMin: task.duration_min,
    dirtLevel,
    durationActualMin: durationActualMin ?? null,
    currentStreak,
    taskType: task.task_type,
    daysSinceCompletion: daysSince,
    frequencyIdealDays: task.frequency_ideal_days,
    frequencyCriticalDays: task.frequency_critical_days,
    fatiguePointsBefore,
    fatiguePointsAdded,
    eventMultiplier,
  });

  let coopBonusCoins = 0;
  let perfectDayBonus = 0;
  let dailyBonusCoins = 0;
  let completionId = null;
  let microGoalProgress = null;
  const extraMessages = [];

  await withTransaction(async (conn) => {
    completionId = await taskModel.recordCompletion(
      {
        taskId,
        userId,
        zoneDirt: dirtLevel,
        coins: reward.coins,
        xp: reward.xp,
        durationActual: durationActualMin ?? null,
        rewardBreakdown: reward.breakdown,
        coopBonusCoins: 0,
      },
      conn
    );

    const coop = await processCooperativeCompletion(
      {
        taskId,
        userId,
        baseCoins: reward.coins,
        completionId,
        isCooperative: !!task.is_cooperative,
      },
      conn
    );
    coopBonusCoins = coop.coopBonusCoins;
    extraMessages.push(...coop.messages);

    await taskModel.markCompleted(taskId, homeId, conn);
    await zoneModel.reduceDirt(task.zone_id, homeId, reduction);
    await userModel.addCoins(userId, reward.coins + coopBonusCoins, conn);
    await userModel.addXp(userId, reward.xp, conn);

    if (isRecurrentTask(task.task_type)) {
      await streakModel.upsert(userId, taskId, reward.newStreak, conn);
    }

    await fatigueModel.addPoints(userId, fatiguePointsAdded, conn);
    if (reward.fatigueWarning) {
      await fatigueModel.markWarned(userId, conn);
    }

    const perfect = await tryPerfectDayBonus(homeId, userId, conn);
    if (perfect.perfectDayBonus > 0) {
      perfectDayBonus = perfect.perfectDayBonus;
      await userModel.addCoins(userId, perfectDayBonus, conn);
      extraMessages.push(...perfect.messages);
    }

    const daily = await tryDailyPreventiveBonus(userId, completionId, dirtLevel, conn);
    if (daily.dailyBonusCoins > 0) {
      dailyBonusCoins = daily.dailyBonusCoins;
      extraMessages.push(daily.message);
    }

    const social = await afterCompletionSocial(
      {
        homeId,
        userId,
        completionId,
        zoneDirt: dirtLevel,
        isMicro: !!task.is_micro || task.task_type === "micro",
        taskType: task.task_type,
      },
      conn
    );
    microGoalProgress = social.microGoal;

    if (feedbackChip || feedbackEmoji || tags?.length) {
      await attachCompletionFeedback(
        completionId,
        { feedbackChip, feedbackEmoji, tags },
        conn
      );
    }
  });

  const coins = await userModel.getWallet(userId);
  const totalCoins = reward.coins + coopBonusCoins + perfectDayBonus + dailyBonusCoins;

  return {
    completionId,
    coinsEarned: totalCoins,
    baseCoins: reward.coins,
    coopBonusCoins,
    perfectDayBonus,
    dailyBonusCoins,
    microGoal: microGoalProgress,
    xpEarned: reward.xp,
    wallet: coins,
    breakdown: {
      ...reward.breakdown,
      coopBonusCoins,
      perfectDayBonus,
      dailyBonusCoins,
    },
    streakCount: reward.newStreak,
    streakBroken: reward.streakBroken,
    streakMilestone: reward.streakMilestone,
    fatiguePoints: reward.fatiguePoints,
    fatigueWarning: reward.fatigueWarning,
    fatiguePenaltyApplied: reward.fatiguePenaltyApplied,
    messages: [...reward.messages, ...extraMessages],
  };
}

export async function getMetricsSummary(homeId, userId) {
  await applyDeteriorationIfNeeded(homeId);
  const zones = await zoneModel.listByHome(homeId);
  const tasks = await taskModel.listByHome(homeId);
  const completions = await taskModel.listRecentCompletions(homeId, 7);

  const daysWithoutCritical = zones.every((z) => z.dirt_level < 4) ? 1 : 0;
  let onTime = 0;
  let total = 0;
  for (const t of tasks) {
    if (!t.last_completed_at) continue;
    total++;
    const daysSince = daysSinceCompletion(t.last_completed_at);
    if (daysSince <= t.frequency_ideal_days + t.frequency_tolerance_days) onTime++;
  }
  const onTimePercent = total ? Math.round((onTime / total) * 100) : 100;

  const fatigueRow = await fatigueModel.getToday(userId);
  const fatiguePoints = fatigueRow.points ?? 0;

  const e3 = await getUserMetrics(homeId, userId);

  return {
    daysWithoutCritical,
    onTimePercent,
    zonesCount: zones.length,
    tasksCount: tasks.length,
    completionsThisWeek: completions.length,
    preventivePercent: e3.preventivePercent,
    avgDurationMin: e3.avgDurationMin,
    activeStreaks: e3.activeStreaks,
    stabilityPercent: e3.stabilityPercent,
    fatigue: {
      points: fatiguePoints,
      limit: FATIGUE_LIMIT,
      high: fatiguePoints > FATIGUE_LIMIT,
      nearLimit: fatiguePoints >= FATIGUE_LIMIT - 2 && fatiguePoints <= FATIGUE_LIMIT,
    },
  };
}

export async function postponeTask(taskId, homeId, days = 1) {
  const task = await taskModel.findById(taskId, homeId);
  if (!task) throw new NotFoundError("Tarea no encontrada.");
  const d = Math.min(14, Math.max(1, Math.round(Number(days) || 1)));
  const until = new Date(Date.now() + d * 24 * 60 * 60 * 1000);
  await taskModel.setSnooze(taskId, homeId, until);
  return {
    taskId,
    snoozedUntil: until.toISOString(),
    message: `Pospuesta ${d} día${d > 1 ? "s" : ""}.`,
  };
}

export async function splitTask(taskId, homeId) {
  const task = await taskModel.findById(taskId, homeId);
  if (!task) throw new NotFoundError("Tarea no encontrada.");
  if (task.is_micro || task.task_type === "micro") {
    throw new BadRequestError("Las microtareas no se dividen.");
  }

  const halfDur = Math.max(5, Math.floor(task.duration_min / 2));
  const partA = `${task.name} (1/2)`;
  const partB = `${task.name} (2/2)`;

  await taskModel.update(taskId, homeId, { active: false });

  const a = await taskModel.create({
    homeId,
    zoneId: task.zone_id,
    name: partA,
    taskType: task.task_type,
    difficulty: Math.max(1, task.difficulty - 1),
    durationMin: halfDur,
    frequencyIdealDays: task.frequency_ideal_days,
    frequencyToleranceDays: task.frequency_tolerance_days,
    frequencyCriticalDays: task.frequency_critical_days,
    dirtReduction: Math.max(1, Math.floor(task.dirt_reduction / 2)),
    isMicro: false,
    isCooperative: !!task.is_cooperative,
  });

  const b = await taskModel.create({
    homeId,
    zoneId: task.zone_id,
    name: partB,
    taskType: "micro",
    difficulty: 1,
    durationMin: halfDur,
    frequencyIdealDays: 1,
    frequencyToleranceDays: 1,
    frequencyCriticalDays: 2,
    dirtReduction: 1,
    isMicro: true,
    isCooperative: false,
  });

  return {
    message: "Tarea dividida en dos partes más manejables.",
    deactivatedTaskId: taskId,
    created: [a, b],
  };
}

export async function createQuickMicro(homeId, body) {
  const zoneId = Number(body.zoneId);
  if (!zoneId) throw new BadRequestError("Indica la zona (zoneId).");
  const zone = await zoneModel.findById(zoneId, homeId);
  if (!zone) throw new NotFoundError("Zona no encontrada.");

  const name = (body.name || `Micro en ${zone.name}`).trim();
  return taskModel.create({
    homeId,
    zoneId,
    name,
    taskType: "micro",
    difficulty: 1,
    durationMin: body.durationMin ?? 5,
    frequencyIdealDays: 1,
    frequencyToleranceDays: 1,
    frequencyCriticalDays: 2,
    dirtReduction: 1,
    isMicro: true,
    isCooperative: false,
  });
}
