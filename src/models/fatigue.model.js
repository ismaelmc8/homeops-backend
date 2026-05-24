import { pool } from "../config/db.js";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function getToday(userId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT user_id, fatigue_date, points, warned FROM daily_fatigue WHERE user_id = ? AND fatigue_date = ?",
    [userId, todayStr()]
  );
  return rows[0] ?? { user_id: userId, fatigue_date: todayStr(), points: 0, warned: 0 };
}

export async function addPoints(userId, points, conn = pool) {
  const date = todayStr();
  await conn.query(
    `INSERT INTO daily_fatigue (user_id, fatigue_date, points) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE points = points + VALUES(points)`,
    [userId, date, points]
  );
  const [rows] = await conn.query(
    "SELECT points, warned FROM daily_fatigue WHERE user_id = ? AND fatigue_date = ?",
    [userId, date]
  );
  return rows[0];
}

export async function markWarned(userId, conn = pool) {
  const date = todayStr();
  await conn.query(
    `INSERT INTO daily_fatigue (user_id, fatigue_date, points, warned) VALUES (?, ?, 0, 1)
     ON DUPLICATE KEY UPDATE warned = 1`,
    [userId, date]
  );
}
