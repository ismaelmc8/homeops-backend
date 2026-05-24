import { NotFoundError } from "../exceptions/NotFoundError.js";
import * as taskModel from "../models/task.model.js";
import * as zoneModel from "../models/zone.model.js";
import * as userModel from "../models/user.model.js";
import {
  calculateCoins,
  dirtReductionForTaskType,
  computePriority,
  kanbanColumn,
  DIRT_LABELS,
} from "./rewardEngine.js";
import { applyDeteriorationIfNeeded, withTransaction } from "./home.service.js";

export async function getKanban(homeId) {
  await applyDeteriorationIfNeeded(homeId);
  const tasks = await taskModel.listByHome(homeId);
  const zones = await zoneModel.listByHome(homeId);
  const zoneMap = Object.fromEntries(zones.map((z) => [z.id, z]));

  const enriched = tasks.map((t) => {
    const zone = zoneMap[t.zone_id] ?? { dirt_level: t.zone_dirt_level, name: t.zone_name };
    const column = kanbanColumn(t, zone);
    const priority = computePriority(t, zone);
    const daysSince = t.last_completed_at
      ? (Date.now() - new Date(t.last_completed_at).getTime()) / (1000 * 60 * 60 * 24)
      : null;
    let scheduleStatus = "ok";
    if (daysSince !== null) {
      const overdue = daysSince - t.frequency_ideal_days;
      if (overdue > t.frequency_critical_days) scheduleStatus = "critical";
      else if (overdue > t.frequency_tolerance_days) scheduleStatus = "late";
      else if (overdue > 0) scheduleStatus = "tolerance";
    }
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
      isMicro: !!t.is_micro,
      column,
      priority,
      scheduleStatus,
      lastCompletedAt: t.last_completed_at,
    };
  });

  enriched.sort((a, b) => b.priority - a.priority);

  const columns = {
    critical: enriched.filter((x) => x.column === "critical"),
    today: enriched.filter((x) => x.column === "today").slice(0, 5),
    todayMore: Math.max(0, enriched.filter((x) => x.column === "today").length - 5),
    next: enriched.filter((x) => x.column === "next"),
  };

  const maxDirt = zones.reduce((m, z) => Math.max(m, z.dirt_level), 0);
  const atRisk = zones.filter((z) => z.dirt_level >= 4).length;
  let homeSummary = "Estado: estable";
  if (atRisk > 0) homeSummary = `${atRisk} zona(s) en riesgo`;
  else if (zones.some((z) => z.dirt_level >= 2)) homeSummary = "Estado: requiere atención pronto";

  const done = await taskModel.listRecentCompletions(homeId, 7);

  return { columns, done, homeSummary, zones };
}

export async function completeTask(taskId, homeId, userId) {
  await applyDeteriorationIfNeeded(homeId);
  const task = await taskModel.findById(taskId, homeId);
  if (!task) throw new NotFoundError("Tarea no encontrada.");

  const dirtLevel = task.zone_dirt_level;
  const reduction = task.dirt_reduction || dirtReductionForTaskType(task.task_type);
  const reward = calculateCoins({
    difficulty: task.difficulty,
    durationMin: task.duration_min,
    dirtLevel,
  });
  const xp = reward.coins;

  await withTransaction(async (conn) => {
    await taskModel.recordCompletion(
      {
        taskId,
        userId,
        zoneDirt: dirtLevel,
        coins: reward.coins,
        xp,
      },
      conn
    );
    await taskModel.markCompleted(taskId, homeId, conn);
    await zoneModel.reduceDirt(task.zone_id, homeId, reduction);
    await userModel.addCoins(userId, reward.coins, conn);
    await userModel.addXp(userId, xp, conn);
  });

  const coins = await userModel.getWallet(userId);
  return {
    coinsEarned: reward.coins,
    xpEarned: xp,
    wallet: coins,
    breakdown: reward.breakdown,
  };
}

export async function getMetricsSummary(homeId) {
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
    const daysSince =
      (Date.now() - new Date(t.last_completed_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= t.frequency_ideal_days + t.frequency_tolerance_days) onTime++;
  }
  const onTimePercent = total ? Math.round((onTime / total) * 100) : 100;

  return {
    daysWithoutCritical,
    onTimePercent,
    zonesCount: zones.length,
    tasksCount: tasks.length,
    completionsThisWeek: completions.length,
  };
}
