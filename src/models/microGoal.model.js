import { pool } from "../config/db.js";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function getOrCreateToday(userId, homeId, conn = pool) {
  const date = todayStr();
  const [existing] = await conn.query(
    "SELECT * FROM user_micro_goals WHERE user_id = ? AND goal_date = ?",
    [userId, date]
  );
  if (existing[0]) return existing[0];

  await conn.query(
    `INSERT INTO user_micro_goals (home_id, user_id, goal_date, goal_type, target_value)
     VALUES (?, ?, ?, 'micro_count', 2)`,
    [homeId, userId, date]
  );
  const [rows] = await conn.query(
    "SELECT * FROM user_micro_goals WHERE user_id = ? AND goal_date = ?",
    [userId, date]
  );
  return rows[0];
}

export async function incrementMicroProgress(userId, homeId, { isMicro, isPreventive }, conn = pool) {
  const goal = await getOrCreateToday(userId, homeId, conn);
  let progress = goal.progress_value;
  if (isMicro) progress += 1;
  const met = progress >= goal.target_value;
  await conn.query(
    `UPDATE user_micro_goals SET progress_value = ?, completed_at = IF(?, NOW(), completed_at)
     WHERE id = ?`,
    [progress, met && !goal.completed_at, goal.id]
  );
  return { progress, target: goal.target_value, met: met || !!goal.completed_at };
}

export async function listTodayForHome(homeId) {
  const [rows] = await pool.query(
    `SELECT g.*, u.name AS user_name
     FROM user_micro_goals g
     JOIN users u ON u.id = g.user_id
     WHERE g.home_id = ? AND g.goal_date = CURDATE()`,
    [homeId]
  );
  return rows;
}
