import { pool } from "../config/db.js";

export async function countHomes() {
  const [rows] = await pool.query("SELECT COUNT(*) AS c FROM homes");
  return rows[0].c;
}

export async function createHome(name, conn = pool) {
  const [r] = await conn.query("INSERT INTO homes (name) VALUES (?)", [name]);
  return r.insertId;
}

export async function findHomeById(id) {
  const [rows] = await pool.query("SELECT * FROM homes WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function updateLastDeterioration(homeId, dateStr) {
  await pool.query("UPDATE homes SET last_deterioration_at = ? WHERE id = ?", [dateStr, homeId]);
}
