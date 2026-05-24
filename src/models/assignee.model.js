import { pool } from "../config/db.js";

export async function listForTasks(taskIds) {
  if (!taskIds.length) return {};
  const placeholders = taskIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT ta.task_id, ta.user_id, u.name AS user_name
     FROM task_assignees ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.task_id IN (${placeholders})`,
    taskIds
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.task_id]) map[r.task_id] = [];
    map[r.task_id].push({ userId: r.user_id, name: r.user_name });
  }
  return map;
}

export async function listForTask(taskId) {
  const [rows] = await pool.query(
    `SELECT ta.user_id, u.name AS user_name
     FROM task_assignees ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.task_id = ?`,
    [taskId]
  );
  return rows.map((r) => ({ userId: r.user_id, name: r.user_name }));
}

export async function setAssignees(taskId, userIds, conn = pool) {
  await conn.query("DELETE FROM task_assignees WHERE task_id = ?", [taskId]);
  if (!userIds?.length) return;
  const values = userIds.map((uid) => [taskId, uid]);
  await conn.query("INSERT INTO task_assignees (task_id, user_id) VALUES ?", [values]);
}
