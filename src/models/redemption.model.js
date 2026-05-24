import { pool } from "../config/db.js";

export async function create({ userId, rewardId, rewardName, coinsSpent }, conn = pool) {
  const [r] = await conn.query(
    `INSERT INTO reward_redemptions (user_id, reward_id, reward_name, coins_spent)
     VALUES (?, ?, ?, ?)`,
    [userId, rewardId, rewardName, coinsSpent]
  );
  const [rows] = await conn.query("SELECT * FROM reward_redemptions WHERE id = ?", [r.insertId]);
  return rows[0];
}

export async function listByUser(userId, limit = 20) {
  const [rows] = await pool.query(
    `SELECT id, reward_id, reward_name, coins_spent, redeemed_at
     FROM reward_redemptions
     WHERE user_id = ?
     ORDER BY redeemed_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

export async function listByHome(homeId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT rr.id, rr.user_id, rr.reward_id, rr.reward_name, rr.coins_spent, rr.redeemed_at,
            u.name AS user_name
     FROM reward_redemptions rr
     INNER JOIN users u ON u.id = rr.user_id
     WHERE u.home_id = ?
     ORDER BY rr.redeemed_at DESC
     LIMIT ?`,
    [homeId, limit]
  );
  return rows;
}
