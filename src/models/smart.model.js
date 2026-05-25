import { pool } from "../config/db.js";

const DEFAULT_SETTINGS = {
  silence_mode: 0,
  notifications_enabled: 1,
  predictions_enabled: 1,
  next_task_enabled: 1,
  auto_priority_enabled: 1,
  optimal_hours_enabled: 1,
  burnout_guard_enabled: 1,
  assignee_suggestions_enabled: 1,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  daily_notification_cap: 3,
};

export async function getHomeSettings(homeId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT * FROM home_smart_settings WHERE home_id = ?",
    [homeId]
  );
  if (rows[0]) return rows[0];
  await conn.query("INSERT INTO home_smart_settings (home_id) VALUES (?)", [homeId]);
  const [created] = await conn.query(
    "SELECT * FROM home_smart_settings WHERE home_id = ?",
    [homeId]
  );
  return created[0] ?? { home_id: homeId, ...DEFAULT_SETTINGS };
}

export async function updateHomeSettings(homeId, data, conn = pool) {
  await getHomeSettings(homeId, conn);
  const map = {
    silence_mode: data.silenceMode,
    notifications_enabled: data.notificationsEnabled,
    predictions_enabled: data.predictionsEnabled,
    next_task_enabled: data.nextTaskEnabled,
    auto_priority_enabled: data.autoPriorityEnabled,
    optimal_hours_enabled: data.optimalHoursEnabled,
    burnout_guard_enabled: data.burnoutGuardEnabled,
    assignee_suggestions_enabled: data.assigneeSuggestionsEnabled,
    quiet_hours_start: data.quietHoursStart,
    quiet_hours_end: data.quietHoursEnd,
    daily_notification_cap: data.dailyNotificationCap,
  };
  const fields = [];
  const vals = [];
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      vals.push(val);
    }
  }
  if (!fields.length) return getHomeSettings(homeId, conn);
  vals.push(homeId);
  await conn.query(
    `UPDATE home_smart_settings SET ${fields.join(", ")} WHERE home_id = ?`,
    vals
  );
  return getHomeSettings(homeId, conn);
}

export async function getUserPrefs(userId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT * FROM user_smart_prefs WHERE user_id = ?",
    [userId]
  );
  if (rows[0]) return rows[0];
  await conn.query("INSERT INTO user_smart_prefs (user_id) VALUES (?)", [userId]);
  const [created] = await conn.query(
    "SELECT * FROM user_smart_prefs WHERE user_id = ?",
    [userId]
  );
  return created[0] ?? { user_id: userId, low_energy_mode: 0 };
}

export async function updateUserPrefs(userId, { lowEnergyMode }, conn = pool) {
  await getUserPrefs(userId, conn);
  if (lowEnergyMode !== undefined) {
    await conn.query(
      "UPDATE user_smart_prefs SET low_energy_mode = ? WHERE user_id = ?",
      [lowEnergyMode ? 1 : 0, userId]
    );
  }
  return getUserPrefs(userId, conn);
}

export async function listNotifications(homeId, userId, limit = 20, conn = pool) {
  const [rows] = await conn.query(
    `SELECT * FROM smart_notifications
     WHERE home_id = ? AND (user_id IS NULL OR user_id = ?)
     ORDER BY created_at DESC LIMIT ?`,
    [homeId, userId, limit]
  );
  return rows;
}

export async function insertNotification(
  { homeId, userId, kind, title, body, reason },
  conn = pool
) {
  const [r] = await conn.query(
    `INSERT INTO smart_notifications (home_id, user_id, kind, title, body, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [homeId, userId ?? null, kind, title, body, reason ?? null]
  );
  return r.insertId;
}

export async function markNotificationRead(id, homeId, userId, conn = pool) {
  await conn.query(
    `UPDATE smart_notifications SET read_at = NOW()
     WHERE id = ? AND home_id = ? AND (user_id IS NULL OR user_id = ?)`,
    [id, homeId, userId]
  );
}

export async function getDailyNotificationCount(homeId, userId, day, conn = pool) {
  const [rows] = await conn.query(
    `SELECT count FROM smart_notification_daily
     WHERE home_id = ? AND user_id = ? AND day = ?`,
    [homeId, userId, day]
  );
  return rows[0]?.count ?? 0;
}

export async function incrementDailyNotificationCount(homeId, userId, day, conn = pool) {
  await conn.query(
    `INSERT INTO smart_notification_daily (home_id, user_id, day, count)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE count = count + 1`,
    [homeId, userId, day]
  );
}

export async function getZoneCompletionStats(homeId, days, conn = pool) {
  const [rows] = await conn.query(
    `SELECT t.zone_id, COUNT(*) AS completions,
            AVG(c.duration_actual) AS avg_duration,
            AVG(c.zone_dirt_at_completion) AS avg_dirt
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     WHERE t.home_id = ? AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY t.zone_id`,
    [homeId, days]
  );
  return rows;
}

export async function getCompletionHours(homeId, userId, days, conn = pool) {
  const [rows] = await conn.query(
    `SELECT HOUR(c.completed_at) AS hour, COUNT(*) AS c
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     WHERE t.home_id = ? AND c.user_id = ? AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY HOUR(c.completed_at)`,
    [homeId, userId, days]
  );
  return rows;
}

export async function getHomeCompletionHours(homeId, days, conn = pool) {
  const [rows] = await conn.query(
    `SELECT HOUR(c.completed_at) AS hour, COUNT(*) AS c
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     WHERE t.home_id = ? AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY HOUR(c.completed_at)`,
    [homeId, days]
  );
  return rows;
}

export async function getMemberCompletionCounts(homeId, days, conn = pool) {
  const [rows] = await conn.query(
    `SELECT c.user_id, u.name, COUNT(*) AS c
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     JOIN users u ON u.id = c.user_id
     WHERE t.home_id = ? AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY c.user_id, u.name`,
    [homeId, days]
  );
  return rows;
}

export async function getUserRecentCompletions(userId, days, conn = pool) {
  const [rows] = await conn.query(
    `SELECT c.duration_actual, t.duration_min, c.completed_at, c.zone_dirt_at_completion, c.quality_rating
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     WHERE c.user_id = ? AND c.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY c.completed_at DESC`,
    [userId, days]
  );
  return rows;
}
