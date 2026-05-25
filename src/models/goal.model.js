import { pool } from "../config/db.js";
import { WEEKLY_GOAL_ROTATION } from "../constants/meta.js";

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

  const weekNum = Math.floor(new Date(ws).getTime() / (7 * 86400000));
  const rot = WEEKLY_GOAL_ROTATION[weekNum % WEEKLY_GOAL_ROTATION.length];

  await conn.query(
    `INSERT INTO home_weekly_goals (home_id, week_start, goal_type, target_value, reward_coins)
     VALUES (?, ?, ?, ?, ?)`,
    [homeId, ws, rot.goalType, rot.target, rot.reward]
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

export async function updateCurrentGoal(homeId, data, conn = pool) {
  const row = await getOrCreateCurrent(homeId, conn);
  const fields = [];
  const vals = [];
  if (data.goalType) {
    fields.push("goal_type = ?");
    vals.push(data.goalType);
  }
  if (data.targetValue != null) {
    fields.push("target_value = ?");
    vals.push(data.targetValue);
  }
  if (data.rewardCoins != null) {
    fields.push("reward_coins = ?");
    vals.push(data.rewardCoins);
  }
  if (data.customLabel !== undefined) {
    fields.push("custom_label = ?");
    vals.push(data.customLabel);
  }
  if (data.setByAdmin) {
    fields.push("set_by_admin = 1");
  }
  if (!fields.length) return row;
  vals.push(row.id);
  await conn.query(
    `UPDATE home_weekly_goals SET ${fields.join(", ")} WHERE id = ?`,
    vals
  );
  return findById(row.id, homeId);
}
