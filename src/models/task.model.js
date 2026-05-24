import { pool } from "../config/db.js";

export async function listByHome(homeId) {
  const [rows] = await pool.query(
    `SELECT t.*, z.name AS zone_name, z.dirt_level AS zone_dirt_level
     FROM tasks t
     JOIN zones z ON z.id = t.zone_id
     WHERE t.home_id = ? AND t.active = 1
     ORDER BY t.name`,
    [homeId]
  );
  return rows;
}

export async function findById(id, homeId) {
  const [rows] = await pool.query(
    `SELECT t.*, z.dirt_level AS zone_dirt_level, z.name AS zone_name
     FROM tasks t JOIN zones z ON z.id = t.zone_id
     WHERE t.id = ? AND t.home_id = ?`,
    [id, homeId]
  );
  return rows[0] ?? null;
}

export async function create(data, conn = pool) {
  const isBoss = data.isBoss ? 1 : 0;
  const [r] = await conn.query(
    `INSERT INTO tasks (
      home_id, zone_id, name, task_type, difficulty, duration_min,
      frequency_ideal_days, frequency_tolerance_days, frequency_critical_days,
      dirt_reduction, is_micro, is_cooperative, is_boss
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.homeId,
      data.zoneId,
      data.name,
      data.taskType,
      data.difficulty,
      data.durationMin,
      data.frequencyIdealDays,
      data.frequencyToleranceDays,
      data.frequencyCriticalDays,
      data.dirtReduction,
      data.isMicro ? 1 : 0,
      data.isCooperative ? 1 : 0,
      isBoss,
    ]
  );
  const [rows] = await conn.query(
    `SELECT t.*, z.dirt_level AS zone_dirt_level, z.name AS zone_name
     FROM tasks t JOIN zones z ON z.id = t.zone_id
     WHERE t.id = ? AND t.home_id = ?`,
    [r.insertId, data.homeId]
  );
  return rows[0];
}

export async function update(id, homeId, data) {
  const map = {
    zone_id: data.zoneId,
    name: data.name,
    task_type: data.taskType,
    difficulty: data.difficulty,
    duration_min: data.durationMin,
    frequency_ideal_days: data.frequencyIdealDays,
    frequency_tolerance_days: data.frequencyToleranceDays,
    frequency_critical_days: data.frequencyCriticalDays,
    dirt_reduction: data.dirtReduction,
    is_micro: data.isMicro !== undefined ? (data.isMicro ? 1 : 0) : undefined,
    is_cooperative:
      data.isCooperative !== undefined ? (data.isCooperative ? 1 : 0) : undefined,
    active: data.active !== undefined ? (data.active ? 1 : 0) : undefined,
  };
  const fields = [];
  const vals = [];
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      vals.push(val);
    }
  }
  if (!fields.length) return findById(id, homeId);
  vals.push(id, homeId);
  await pool.query(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ? AND home_id = ?`, vals);
  return findById(id, homeId);
}

export async function remove(id, homeId) {
  const [r] = await pool.query("DELETE FROM tasks WHERE id = ? AND home_id = ?", [id, homeId]);
  return r.affectedRows > 0;
}

export async function markCompleted(id, homeId, conn = pool) {
  await conn.query(
    "UPDATE tasks SET last_completed_at = NOW(), snoozed_until = NULL WHERE id = ? AND home_id = ?",
    [id, homeId]
  );
}

export async function setSnooze(id, homeId, until) {
  await pool.query(
    "UPDATE tasks SET snoozed_until = ? WHERE id = ? AND home_id = ?",
    [until, id, homeId]
  );
  return findById(id, homeId);
}

export async function listRecentCompletions(homeId, days = 7) {
  const [rows] = await pool.query(
    `SELECT c.*, t.name AS task_name, z.name AS zone_name, u.name AS user_name
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     JOIN zones z ON z.id = t.zone_id
     JOIN users u ON u.id = c.user_id
     WHERE t.home_id = ? AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY c.completed_at DESC`,
    [homeId, days]
  );
  return rows;
}

export async function getCompletionsInPeriod(homeId, days = 7, userId = null) {
  let sql = `SELECT c.zone_dirt_at_completion, c.duration_actual, c.coins_earned, c.xp_earned, c.user_id
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     WHERE t.home_id = ? AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
  const params = [homeId, days];
  if (userId != null) {
    sql += " AND c.user_id = ?";
    params.push(userId);
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function recordCompletion(
  {
    taskId,
    userId,
    zoneDirt,
    coins,
    xp,
    durationActual,
    rewardBreakdown,
    coopBonusCoins = 0,
  },
  conn = pool
) {
  const breakdownJson = rewardBreakdown ? JSON.stringify(rewardBreakdown) : null;
  const [r] = await conn.query(
    `INSERT INTO task_completions
       (task_id, user_id, zone_dirt_at_completion, coins_earned, coop_bonus_coins, xp_earned, duration_actual, reward_breakdown)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      taskId,
      userId,
      zoneDirt,
      coins,
      coopBonusCoins,
      xp,
      durationActual ?? null,
      breakdownJson,
    ]
  );
  return r.insertId;
}
