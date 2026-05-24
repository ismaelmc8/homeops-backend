import { pool } from "../config/db.js";

export async function hasClaimedToday(userId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT bonus_date FROM daily_preventive_bonus WHERE user_id = ? AND bonus_date = CURDATE()",
    [userId]
  );
  return !!rows[0];
}

export async function recordClaim(userId, completionId, coinsBonus, conn = pool) {
  await conn.query(
    `INSERT INTO daily_preventive_bonus (user_id, bonus_date, completion_id, coins_bonus)
     VALUES (?, CURDATE(), ?, ?)`,
    [userId, completionId, coinsBonus]
  );
}
