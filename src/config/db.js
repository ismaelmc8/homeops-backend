import mysql from "mysql2/promise";
import { formatDbConfigLog, getDbConfig } from "./env.js";

const cfg = getDbConfig();

export const pool = mysql.createPool({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  waitForConnections: true,
  connectionLimit: 10,
});

export async function verifyDbConnection() {
  console.log(formatDbConfigLog(cfg));
  console.log("[db] Intentando conectar…");

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query("SELECT 1 AS ok, DATABASE() AS db, USER() AS user");
    conn.release();
    const row = rows[0];
    console.log(
      `[db] Conexión OK — base: ${row.db}, usuario sesión: ${row.user}`
    );
    return true;
  } catch (err) {
    console.error(`[db] Conexión FALLIDA — ${err.code || "ERROR"}: ${err.message}`);
    if (err.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("[db] Revisa usuario/contraseña en .env o permisos GRANT sobre la base.");
    }
    if (err.code === "ER_BAD_DB_ERROR") {
      console.error("[db] La base no existe. Ejecuta: npm run db:migrate");
    }
    return false;
  }
}
