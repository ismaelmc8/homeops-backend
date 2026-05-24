import { pool } from "../config/db.js";

export async function findOpenCycle(taskId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT * FROM task_coop_cycles
     WHERE task_id = ? AND closed_at IS NULL
       AND started_at >= DATE_SUB(NOW(), INTERVAL window_hours HOUR)
     ORDER BY started_at DESC LIMIT 1`,
    [taskId]
  );
  return rows[0] ?? null;
}

export async function createCycle(taskId, windowHours = 48, conn = pool) {
  const [r] = await conn.query(
    "INSERT INTO task_coop_cycles (task_id, window_hours) VALUES (?, ?)",
    [taskId, windowHours]
  );
  const [rows] = await conn.query("SELECT * FROM task_coop_cycles WHERE id = ?", [r.insertId]);
  return rows[0];
}

export async function closeCycle(cycleId, conn = pool) {
  await conn.query("UPDATE task_coop_cycles SET closed_at = NOW() WHERE id = ?", [cycleId]);
}

export async function addParticipant(cycleId, userId, completionId, conn = pool) {
  await conn.query(
    `INSERT INTO task_coop_participants (cycle_id, user_id, completion_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE completion_id = VALUES(completion_id)`,
    [cycleId, userId, completionId]
  );
}

export async function listParticipants(cycleId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT p.user_id, p.completion_id, p.coop_bonus_coins,
            c.coins_earned
     FROM task_coop_participants p
     JOIN task_completions c ON c.id = p.completion_id
     WHERE p.cycle_id = ?`,
    [cycleId]
  );
  return rows;
}

export async function setParticipantBonus(cycleId, userId, bonusCoins, conn = pool) {
  await conn.query(
    "UPDATE task_coop_participants SET coop_bonus_coins = ? WHERE cycle_id = ? AND user_id = ?",
    [bonusCoins, cycleId, userId]
  );
}

export async function updateCompletionCoopBonus(completionId, bonusCoins, conn = pool) {
  await conn.query(
    "UPDATE task_completions SET coop_bonus_coins = ? WHERE id = ?",
    [bonusCoins, completionId]
  );
}
