import { pool } from "../config/db.js";

export async function getActive(homeId) {
  const [rows] = await pool.query(
    `SELECT e.*, u.name AS created_by_name
     FROM home_events e
     JOIN users u ON u.id = e.created_by
     WHERE e.home_id = ? AND e.starts_at <= NOW() AND e.ends_at > NOW()
     ORDER BY e.starts_at DESC
     LIMIT 1`,
    [homeId]
  );
  return rows[0] ?? null;
}

export async function listByHome(homeId, limit = 10) {
  const [rows] = await pool.query(
    `SELECT e.*, u.name AS created_by_name
     FROM home_events e
     JOIN users u ON u.id = e.created_by
     WHERE e.home_id = ?
     ORDER BY e.starts_at DESC
     LIMIT ?`,
    [homeId, limit]
  );
  return rows;
}

export async function create({ homeId, eventType, startsAt, endsAt, createdBy }, conn = pool) {
  const [r] = await conn.query(
    `INSERT INTO home_events (home_id, event_type, starts_at, ends_at, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [homeId, eventType, startsAt, endsAt, createdBy]
  );
  const [rows] = await conn.query("SELECT * FROM home_events WHERE id = ?", [r.insertId]);
  return rows[0];
}

export async function remove(id, homeId) {
  const [r] = await pool.query("DELETE FROM home_events WHERE id = ? AND home_id = ?", [id, homeId]);
  return r.affectedRows > 0;
}

export async function countOverlapping(homeId, startsAt, endsAt, excludeId = null) {
  let sql = `SELECT COUNT(*) AS c FROM home_events
     WHERE home_id = ? AND starts_at < ? AND ends_at > ?`;
  const params = [homeId, endsAt, startsAt];
  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0]?.c ?? 0;
}
