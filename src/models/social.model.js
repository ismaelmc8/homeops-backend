import { pool } from "../config/db.js";

export async function getHomeSocialSettings(homeId) {
  const [rows] = await pool.query(
    `SELECT social_mvp_enabled, social_ranking_enabled FROM homes WHERE id = ?`,
    [homeId]
  );
  const r = rows[0] ?? {};
  return {
    mvpEnabled: !!r.social_mvp_enabled,
    rankingEnabled: !!r.social_ranking_enabled,
  };
}

export async function updateHomeSocialSettings(homeId, { mvpEnabled, rankingEnabled }) {
  await pool.query(
    `UPDATE homes SET social_mvp_enabled = ?, social_ranking_enabled = ? WHERE id = ?`,
    [mvpEnabled ? 1 : 0, rankingEnabled ? 1 : 0, homeId]
  );
  return getHomeSocialSettings(homeId);
}

export async function updateCompletionFeedback(
  completionId,
  { feedbackChip, feedbackEmoji, tags },
  conn = pool
) {
  const tagsJson = tags?.length ? JSON.stringify(tags) : null;
  await conn.query(
    `UPDATE task_completions
     SET feedback_chip = ?, feedback_emoji = ?, completion_tags = ?
     WHERE id = ?`,
    [feedbackChip ?? null, feedbackEmoji ?? null, tagsJson, completionId]
  );
}

export async function addKudos({ homeId, fromUserId, toUserId, completionId }, conn = pool) {
  const [r] = await conn.query(
    `INSERT INTO kudos (home_id, from_user_id, to_user_id, completion_id)
     VALUES (?, ?, ?, ?)`,
    [homeId, fromUserId, toUserId, completionId ?? null]
  );
  return r.insertId;
}

export async function countKudosForCompletion(completionId) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS c FROM kudos WHERE completion_id = ?",
    [completionId]
  );
  return rows[0]?.c ?? 0;
}

export async function hasKudosFromUser(completionId, fromUserId) {
  const [rows] = await pool.query(
    "SELECT id FROM kudos WHERE completion_id = ? AND from_user_id = ? LIMIT 1",
    [completionId, fromUserId]
  );
  return !!rows[0];
}

export async function listTimeline(homeId, { days = 14, userId = null, zoneId = null } = {}) {
  let sql = `
    SELECT c.id, c.completed_at, c.coins_earned, c.coop_bonus_coins, c.zone_dirt_at_completion,
           c.feedback_chip, c.feedback_emoji, c.completion_tags,
           t.id AS task_id, t.name AS task_name, t.task_type, t.is_micro,
           z.id AS zone_id, z.name AS zone_name,
           u.id AS user_id, u.name AS user_name,
           (SELECT COUNT(*) FROM kudos k WHERE k.completion_id = c.id) AS kudos_count
    FROM task_completions c
    JOIN tasks t ON t.id = c.task_id
    JOIN zones z ON z.id = t.zone_id
    JOIN users u ON u.id = c.user_id
    WHERE t.home_id = ? AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
  const params = [homeId, days];
  if (userId) {
    sql += " AND c.user_id = ?";
    params.push(userId);
  }
  if (zoneId) {
    sql += " AND t.zone_id = ?";
    params.push(zoneId);
  }
  sql += " ORDER BY c.completed_at DESC LIMIT 100";
  const [rows] = await pool.query(sql, params);
  return rows.map((r) => ({
    ...r,
    completion_tags: r.completion_tags
      ? typeof r.completion_tags === "string"
        ? JSON.parse(r.completion_tags)
        : r.completion_tags
      : [],
  }));
}
