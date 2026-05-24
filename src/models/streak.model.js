import { pool } from "../config/db.js";

export async function get(userId, taskId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT user_id, task_id, count FROM streaks WHERE user_id = ? AND task_id = ?",
    [userId, taskId]
  );
  return rows[0] ?? null;
}

export async function upsert(userId, taskId, count, conn = pool) {
  await conn.query(
    `INSERT INTO streaks (user_id, task_id, count) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE count = VALUES(count), updated_at = CURRENT_TIMESTAMP`,
    [userId, taskId, count]
  );
}

export async function listForUserTasks(userId, taskIds) {
  if (!taskIds.length) return {};
  const placeholders = taskIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT task_id, count FROM streaks WHERE user_id = ? AND task_id IN (${placeholders})`,
    [userId, ...taskIds]
  );
  return Object.fromEntries(rows.map((r) => [r.task_id, r.count]));
}

export async function countActiveStreaks(userId, minCount = 3) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS c FROM streaks WHERE user_id = ? AND count >= ?",
    [userId, minCount]
  );
  return rows[0]?.c ?? 0;
}
