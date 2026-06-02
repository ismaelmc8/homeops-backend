import { pool } from "../config/db.js";

export async function listByHome(homeId) {
  const [rows] = await pool.query(
    "SELECT * FROM zones WHERE home_id = ? ORDER BY name",
    [homeId]
  );
  return rows;
}

export async function findById(id, homeId) {
  const [rows] = await pool.query("SELECT * FROM zones WHERE id = ? AND home_id = ?", [
    id,
    homeId,
  ]);
  return rows[0] ?? null;
}

export async function create({ homeId, name, dirtLevel, dailyIncrement }) {
  const [r] = await pool.query(
    "INSERT INTO zones (home_id, name, dirt_level, daily_increment) VALUES (?, ?, ?, ?)",
    [homeId, name, dirtLevel ?? 1, dailyIncrement ?? 0]
  );
  return findById(r.insertId, homeId);
}

export async function update(id, homeId, data) {
  const fields = [];
  const vals = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (!fields.length) return findById(id, homeId);
  vals.push(id, homeId);
  await pool.query(`UPDATE zones SET ${fields.join(", ")} WHERE id = ? AND home_id = ?`, vals);
  return findById(id, homeId);
}

export async function remove(id, homeId) {
  const [r] = await pool.query("DELETE FROM zones WHERE id = ? AND home_id = ?", [id, homeId]);
  return r.affectedRows > 0;
}

export async function applyDeterioration(homeId, days) {
  await pool.query(
    `UPDATE zones SET dirt_level = LEAST(5, dirt_level + (daily_increment * ?))
     WHERE home_id = ?`,
    [days, homeId]
  );
}

export async function reduceDirt(zoneId, homeId, amount) {
  await pool.query(
    `UPDATE zones SET dirt_level = GREATEST(0, dirt_level - ?) WHERE id = ? AND home_id = ?`,
    [amount, zoneId, homeId]
  );
}

export async function maxDirtLevel(homeId) {
  const [rows] = await pool.query(
    "SELECT COALESCE(MAX(dirt_level), 0) AS m FROM zones WHERE home_id = ?",
    [homeId]
  );
  return rows[0].m;
}
