import { pool } from "../config/db.js";
import * as homeModel from "../models/home.model.js";
import * as zoneModel from "../models/zone.model.js";

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function applyDeteriorationIfNeeded(homeId) {
  const home = await homeModel.findHomeById(homeId);
  if (!home) return;

  const today = todayDateStr();
  const last = home.last_deterioration_at
    ? new Date(home.last_deterioration_at).toISOString().slice(0, 10)
    : null;

  if (last === today) return;

  let days = 1;
  if (last) {
    const diff = Math.floor(
      (new Date(today).getTime() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)
    );
    days = Math.max(1, diff);
  }

  await zoneModel.applyDeterioration(homeId, days);
  await homeModel.updateLastDeterioration(homeId, today);
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
