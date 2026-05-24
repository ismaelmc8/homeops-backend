import { pool } from "../config/db.js";

const IMBALANCE_THRESHOLD = 0.7;

export function detectImbalance(percentByUser) {
  const values = Object.values(percentByUser).filter((v) => v > 0);
  if (values.length < 2) return { imbalanced: false, maxPercent: values[0] ?? 0, minPercent: 0 };
  const max = Math.max(...values);
  const min = Math.min(...values);
  return {
    imbalanced: max >= IMBALANCE_THRESHOLD * 100 && values.length >= 2,
    maxPercent: max,
    minPercent: min,
  };
}

export async function getBalanceMetrics(homeId, days = 7) {
  const [completions] = await pool.query(
    `SELECT c.user_id, u.name AS user_name, c.zone_dirt_at_completion,
            t.frequency_ideal_days, t.frequency_tolerance_days, t.last_completed_at
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     JOIN users u ON u.id = c.user_id
     WHERE t.home_id = ? AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [homeId, days]
  );

  const byUser = {};
  let total = 0;
  let onTimeTotal = 0;

  for (const c of completions) {
    total++;
    if (!byUser[c.user_id]) {
      byUser[c.user_id] = {
        userId: c.user_id,
        name: c.user_name,
        completions: 0,
        onTime: 0,
      };
    }
    byUser[c.user_id].completions++;
    if (c.zone_dirt_at_completion <= 1) {
      byUser[c.user_id].onTime++;
      onTimeTotal++;
    }
  }

  const members = Object.values(byUser).map((m) => ({
    userId: m.userId,
    name: m.name,
    completions: m.completions,
    sharePercent: total ? Math.round((m.completions / total) * 100) : 0,
    reliabilityPercent: m.completions
      ? Math.round((m.onTime / m.completions) * 100)
      : 100,
  }));

  const percentMap = Object.fromEntries(members.map((m) => [m.userId, m.sharePercent]));
  const balance = detectImbalance(percentMap);

  return {
    days,
    totalCompletions: total,
    members,
    imbalanced: balance.imbalanced,
    imbalanceMessage: balance.imbalanced
      ? `Reparto desequilibrado: un miembro acumula ~${balance.maxPercent}% de las tareas esta semana.`
      : null,
    householdReliabilityPercent: total ? Math.round((onTimeTotal / total) * 100) : 100,
  };
}
