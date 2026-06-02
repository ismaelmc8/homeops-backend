import { pool } from "../config/db.js";
/** E11: sin deterioro pasivo; zones.dirt_level se deriva de tareas (syncZoneDirtFromTasks). */
export async function applyDeteriorationIfNeeded(_homeId) {
  return;
}

export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
