import { pool } from "../config/db.js";

export async function getSettings(homeId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT * FROM home_meta_settings WHERE home_id = ?",
    [homeId]
  );
  if (rows[0]) return rows[0];
  await conn.query(
    "INSERT INTO home_meta_settings (home_id) VALUES (?)",
    [homeId]
  );
  const [created] = await conn.query(
    "SELECT * FROM home_meta_settings WHERE home_id = ?",
    [homeId]
  );
  return created[0];
}

export async function updateSettings(homeId, data, conn = pool) {
  await getSettings(homeId, conn);
  const fields = [];
  const vals = [];
  if (data.randomEventsEnabled !== undefined) {
    fields.push("random_events_enabled = ?");
    vals.push(data.randomEventsEnabled ? 1 : 0);
  }
  if (data.baseBuffCoinsPct !== undefined) {
    fields.push("base_buff_coins_pct = ?");
    vals.push(data.baseBuffCoinsPct);
  }
  if (data.baseState !== undefined) {
    fields.push("base_state = ?");
    vals.push(data.baseState);
  }
  if (data.recoveryStartedAt !== undefined) {
    fields.push("recovery_started_at = ?");
    vals.push(data.recoveryStartedAt);
  }
  if (!fields.length) return getSettings(homeId, conn);
  vals.push(homeId);
  await conn.query(
    `UPDATE home_meta_settings SET ${fields.join(", ")} WHERE home_id = ?`,
    vals
  );
  return getSettings(homeId, conn);
}

export async function getDailyMission(homeId, missionDate, conn = pool) {
  const [rows] = await conn.query(
    "SELECT * FROM home_daily_missions WHERE home_id = ? AND mission_date = ?",
    [homeId, missionDate]
  );
  return rows[0] ?? null;
}

export async function createDailyMission(homeId, missionDate, missionKey, targetValue, conn = pool) {
  const [r] = await conn.query(
    `INSERT INTO home_daily_missions (home_id, mission_date, mission_key, target_value)
     VALUES (?, ?, ?, ?)`,
    [homeId, missionDate, missionKey, targetValue]
  );
  const [rows] = await conn.query("SELECT * FROM home_daily_missions WHERE id = ?", [r.insertId]);
  return rows[0];
}

export async function incrementDailyProgress(id, amount = 1, conn = pool) {
  await conn.query(
    "UPDATE home_daily_missions SET progress = progress + ? WHERE id = ?",
    [amount, id]
  );
  await conn.query(
    `UPDATE home_daily_missions SET completed_at = NOW()
     WHERE id = ? AND progress >= target_value AND completed_at IS NULL`,
    [id]
  );
  const [rows] = await conn.query("SELECT * FROM home_daily_missions WHERE id = ?", [id]);
  return rows[0];
}

export async function listActiveBossMissions(homeId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT b.*, z.name AS zone_name, z.dirt_level
     FROM home_boss_missions b
     JOIN zones z ON z.id = b.zone_id
     WHERE b.home_id = ? AND b.status = 'active'`,
    [homeId]
  );
  return rows;
}

export async function findBossByZone(homeId, zoneId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT * FROM home_boss_missions WHERE home_id = ? AND zone_id = ? AND status = 'active'",
    [homeId, zoneId]
  );
  return rows[0] ?? null;
}

export async function createBossMission(homeId, zoneId, taskId, conn = pool) {
  const [r] = await conn.query(
    `INSERT INTO home_boss_missions (home_id, zone_id, task_id) VALUES (?, ?, ?)`,
    [homeId, zoneId, taskId ?? null]
  );
  const [rows] = await conn.query("SELECT * FROM home_boss_missions WHERE id = ?", [r.insertId]);
  return rows[0];
}

export async function completeBossMission(id, conn = pool) {
  await conn.query(
    "UPDATE home_boss_missions SET status = 'completed', completed_at = NOW() WHERE id = ?",
    [id]
  );
}

export async function ensureSeasonJoined(homeId, seasonKey, conn = pool) {
  await conn.query(
    `INSERT IGNORE INTO home_season_progress (home_id, season_key) VALUES (?, ?)`,
    [homeId, seasonKey]
  );
}

export async function countActiveBonusEvents(homeId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM home_events
     WHERE home_id = ? AND event_type IN ('speedrun', 'perfect_day', 'random_bonus')
       AND starts_at <= NOW() AND ends_at > NOW()`,
    [homeId]
  );
  return rows[0]?.c ?? 0;
}

export async function hasRandomEventToday(homeId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM home_events
     WHERE home_id = ? AND event_type = 'random_bonus'
       AND DATE(starts_at) = CURDATE()`,
    [homeId]
  );
  return (rows[0]?.c ?? 0) > 0;
}

export async function setZoneDirtLevel(zoneId, homeId, level, conn = pool) {
  await conn.query(
    "UPDATE zones SET dirt_level = ? WHERE id = ? AND home_id = ?",
    [level, zoneId, homeId]
  );
}
