import { pool } from "../config/db.js";

function weekStartDate(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export { weekStartDate };

export async function getOrCreateCurrent(homeId, conn = pool) {
  const ws = weekStartDate();
  const [existing] = await conn.query(
    "SELECT * FROM home_weekly_goals WHERE home_id = ? AND week_start = ? LIMIT 1",
    [homeId, ws]
  );
  if (existing[0]) return existing[0];

  await conn.query(
    `INSERT INTO home_weekly_goals (home_id, week_start, goal_type, target_value, reward_coins)
     VALUES (?, ?, 'completions_count', 10, 50)`,
    [homeId, ws]
  );
  const [rows] = await conn.query(
    "SELECT * FROM home_weekly_goals WHERE home_id = ? AND week_start = ? LIMIT 1",
    [homeId, ws]
  );
  return rows[0];
}

export async function findById(id, homeId) {
  const [rows] = await pool.query(
    "SELECT * FROM home_weekly_goals WHERE id = ? AND home_id = ?",
    [id, homeId]
  );
  return rows[0] ?? null;
}

export async function markClaimed(id, conn = pool) {
  await conn.query("UPDATE home_weekly_goals SET claimed_at = NOW() WHERE id = ?", [id]);
}
