import { pool } from "../config/db.js";

export async function listByHome(homeId, { activeOnly = false } = {}) {
  const sql = activeOnly
    ? "SELECT * FROM rewards WHERE home_id = ? AND active = 1 ORDER BY cost_coins"
    : "SELECT * FROM rewards WHERE home_id = ? ORDER BY cost_coins";
  const [rows] = await pool.query(sql, [homeId]);
  return rows;
}

export async function findByIdForHome(id, homeId) {
  const [rows] = await pool.query(
    "SELECT * FROM rewards WHERE id = ? AND home_id = ?",
    [id, homeId]
  );
  return rows[0] ?? null;
}

export async function create({ homeId, name, costCoins }) {
  const [r] = await pool.query(
    "INSERT INTO rewards (home_id, name, cost_coins) VALUES (?, ?, ?)",
    [homeId, name, costCoins]
  );
  const [rows] = await pool.query("SELECT * FROM rewards WHERE id = ?", [r.insertId]);
  return rows[0];
}

export async function update(id, homeId, data) {
  const fields = [];
  const vals = [];
  if (data.name !== undefined) {
    fields.push("name = ?");
    vals.push(data.name);
  }
  if (data.costCoins !== undefined) {
    fields.push("cost_coins = ?");
    vals.push(data.costCoins);
  }
  if (data.active !== undefined) {
    fields.push("active = ?");
    vals.push(data.active ? 1 : 0);
  }
  if (!fields.length) return null;
  vals.push(id, homeId);
  await pool.query(`UPDATE rewards SET ${fields.join(", ")} WHERE id = ? AND home_id = ?`, vals);
  const [rows] = await pool.query("SELECT * FROM rewards WHERE id = ? AND home_id = ?", [
    id,
    homeId,
  ]);
  return rows[0] ?? null;
}

export async function remove(id, homeId) {
  const [r] = await pool.query("DELETE FROM rewards WHERE id = ? AND home_id = ?", [id, homeId]);
  return r.affectedRows > 0;
}
