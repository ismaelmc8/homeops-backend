import { pool } from "../config/db.js";
import * as taskModel from "../models/task.model.js";
import * as zoneModel from "../models/zone.model.js";
import * as streakModel from "../models/streak.model.js";

export function computeMetricsFromCompletions(completions, zones) {
  const total = completions.length;
  const preventive = completions.filter((c) => c.zone_dirt_at_completion <= 1).length;
  const preventivePercent = total ? Math.round((preventive / total) * 100) : 100;

  const withDuration = completions.filter((c) => c.duration_actual > 0);
  const avgDurationMin = withDuration.length
    ? Math.round(
        withDuration.reduce((s, c) => s + c.duration_actual, 0) / withDuration.length
      )
    : null;

  const stableZones = zones.filter((z) => z.dirt_level <= 1).length;
  const stabilityPercent = zones.length
    ? Math.round((stableZones / zones.length) * 100)
    : 100;

  const byUser = {};
  for (const c of completions) {
    byUser[c.user_id] = (byUser[c.user_id] || 0) + 1;
  }

  return {
    preventivePercent,
    avgDurationMin,
    stabilityPercent,
    completionsInPeriod: total,
    contributorCount: Object.keys(byUser).length,
  };
}

export async function getUserMetrics(homeId, userId) {
  const zones = await zoneModel.listByHome(homeId);
  const completions = await taskModel.getCompletionsInPeriod(homeId, 7, userId);
  const activeStreaks = await streakModel.countActiveStreaks(userId, 3);
  const base = computeMetricsFromCompletions(completions, zones);
  return { ...base, activeStreaks };
}

export async function getAdminDashboardMetrics(homeId) {
  const zones = await zoneModel.listByHome(homeId);
  const completions = await taskModel.getCompletionsInPeriod(homeId, 7);
  const base = computeMetricsFromCompletions(completions, zones);

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM streaks s
     INNER JOIN users u ON u.id = s.user_id
     WHERE u.home_id = ? AND s.count >= 3`,
    [homeId]
  );

  return {
    ...base,
    activeStreaksHome: rows[0]?.c ?? 0,
  };
}
