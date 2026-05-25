import { pool } from "../config/db.js";

export async function getPrefs(userId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT * FROM user_rpg_prefs WHERE user_id = ?",
    [userId]
  );
  if (rows[0]) return rows[0];
  await conn.query("INSERT INTO user_rpg_prefs (user_id) VALUES (?)", [userId]);
  const [created] = await conn.query(
    "SELECT * FROM user_rpg_prefs WHERE user_id = ?",
    [userId]
  );
  return created[0];
}

export async function updateSpecialization(userId, specialization, conn = pool) {
  await getPrefs(userId, conn);
  await conn.query(
    `UPDATE user_rpg_prefs SET specialization = ?, specialization_changed_at = NOW() WHERE user_id = ?`,
    [specialization, userId]
  );
}

export async function setEquippedTitle(userId, titleKey, conn = pool) {
  await getPrefs(userId, conn);
  await conn.query(
    "UPDATE user_rpg_prefs SET equipped_title_key = ? WHERE user_id = ?",
    [titleKey, userId]
  );
}

export async function setEquippedCosmetic(userId, cosmeticKey, conn = pool) {
  await getPrefs(userId, conn);
  await conn.query(
    "UPDATE user_rpg_prefs SET equipped_cosmetic_key = ? WHERE user_id = ?",
    [cosmeticKey, userId]
  );
}

export async function listAchievements(userId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_id = ?",
    [userId]
  );
  return rows;
}

export async function unlockAchievement(userId, key, conn = pool) {
  await conn.query(
    `INSERT IGNORE INTO user_achievements (user_id, achievement_key) VALUES (?, ?)`,
    [userId, key]
  );
}

export async function listShopItems(conn = pool) {
  const [rows] = await conn.query(
    "SELECT * FROM rpg_shop_items WHERE active = 1 ORDER BY cost_coins ASC"
  );
  return rows;
}

export async function getShopItem(itemKey, conn = pool) {
  const [rows] = await conn.query(
    "SELECT * FROM rpg_shop_items WHERE item_key = ? AND active = 1",
    [itemKey]
  );
  return rows[0] ?? null;
}

export async function addActiveBuff({ userId, buffKey, multiplier, expiresAt }, conn = pool) {
  const [r] = await conn.query(
    `INSERT INTO user_active_buffs (user_id, buff_key, multiplier, expires_at) VALUES (?, ?, ?, ?)`,
    [userId, buffKey, multiplier, expiresAt]
  );
  return r.insertId;
}

export async function getActiveBuffs(userId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT * FROM user_active_buffs WHERE user_id = ? AND expires_at > NOW() ORDER BY expires_at ASC`,
    [userId]
  );
  return rows;
}

export async function ownsCosmetic(userId, key, conn = pool) {
  const [rows] = await conn.query(
    "SELECT 1 FROM user_cosmetics_owned WHERE user_id = ? AND cosmetic_key = ?",
    [userId, key]
  );
  return !!rows[0];
}

export async function grantCosmetic(userId, key, conn = pool) {
  await conn.query(
    `INSERT IGNORE INTO user_cosmetics_owned (user_id, cosmetic_key) VALUES (?, ?)`,
    [userId, key]
  );
}

export async function listCosmetics(userId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT cosmetic_key, purchased_at FROM user_cosmetics_owned WHERE user_id = ?",
    [userId]
  );
  return rows;
}

export async function setCompletionQuality(completionId, rating, conn = pool) {
  await conn.query(
    "UPDATE task_completions SET quality_rating = ? WHERE id = ?",
    [rating, completionId]
  );
}

export async function incrementTokenVersion(userId, conn = pool) {
  await conn.query(
    "UPDATE users SET token_version = token_version + 1 WHERE id = ?",
    [userId]
  );
}

export async function getTokenVersion(userId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT token_version FROM users WHERE id = ?",
    [userId]
  );
  return rows[0]?.token_version ?? 0;
}

export async function countCompletions(userId, homeId, { micro, cooperative, preventive }, conn = pool) {
  let sql = `SELECT COUNT(*) AS c FROM task_completions c
     JOIN tasks t ON t.id = c.task_id WHERE c.user_id = ? AND t.home_id = ?`;
  const params = [userId, homeId];
  if (micro) sql += " AND (t.is_micro = 1 OR t.task_type = 'micro')";
  if (cooperative) sql += " AND t.is_cooperative = 1";
  if (preventive) sql += " AND c.zone_dirt_at_completion <= 1";
  const [rows] = await conn.query(sql, params);
  return rows[0]?.c ?? 0;
}

export async function getStatsRaw(userId, homeId, days = 30, conn = pool) {
  const [completions] = await conn.query(
    `SELECT c.duration_actual, t.duration_min, c.zone_dirt_at_completion, t.is_cooperative,
            c.coop_bonus_coins, c.completed_at, t.frequency_ideal_days, t.frequency_tolerance_days,
            t.last_completed_at
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     WHERE c.user_id = ? AND t.home_id = ? AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [userId, homeId, days]
  );
  const [coopCount] = await conn.query(
    `SELECT COUNT(*) AS c FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     WHERE c.user_id = ? AND t.home_id = ? AND c.coop_bonus_coins > 0
       AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [userId, homeId, days]
  );
  return { completions, coopCount: coopCount[0]?.c ?? 0 };
}
