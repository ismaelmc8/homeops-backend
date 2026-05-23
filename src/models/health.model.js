import { pool } from "../config/db.js";

export async function pingDb() {
  const [rows] = await pool.query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}
