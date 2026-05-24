import { pool } from "../config/db.js";

export async function findByEmail(email) {
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] ?? null;
}

export async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function createUser(
  { homeId, email, name, role, status },
  conn = pool
) {
  const [r] = await conn.query(
    `INSERT INTO users (home_id, email, name, role, status) VALUES (?, ?, ?, ?, ?)`,
    [homeId, email, name, role, status]
  );
  return r.insertId;
}

export async function setPassword(userId, passwordHash, conn = pool) {
  await conn.query(
    "UPDATE users SET password_hash = ?, status = 'active' WHERE id = ?",
    [passwordHash, userId]
  );
}

export async function setName(userId, name, conn = pool) {
  await conn.query("UPDATE users SET name = ? WHERE id = ?", [name, userId]);
}

export async function createWallet(userId, conn = pool) {
  await conn.query("INSERT INTO wallets (user_id, coins) VALUES (?, 0)", [userId]);
}

export async function getWallet(userId) {
  const [rows] = await pool.query("SELECT coins FROM wallets WHERE user_id = ?", [userId]);
  return rows[0]?.coins ?? 0;
}

export async function addCoins(userId, amount, conn = pool) {
  await conn.query("UPDATE wallets SET coins = coins + ? WHERE user_id = ?", [amount, userId]);
}

/** Resta monedas si hay saldo suficiente. Devuelve false si no alcanza. */
export async function deductCoins(userId, amount, conn = pool) {
  const [r] = await conn.query(
    "UPDATE wallets SET coins = coins - ? WHERE user_id = ? AND coins >= ?",
    [amount, userId, amount]
  );
  return r.affectedRows > 0;
}

export async function addXp(userId, amount, conn = pool) {
  await conn.query("UPDATE users SET xp = xp + ? WHERE id = ?", [amount, userId]);
}

export async function listByHomeId(homeId) {
  const [rows] = await pool.query(
    `SELECT id, email, name, role, status, created_at
     FROM users WHERE home_id = ?
     ORDER BY FIELD(role, 'admin', 'member'), name ASC`,
    [homeId]
  );
  return rows;
}

export async function findByIdInHome(userId, homeId) {
  const [rows] = await pool.query(
    "SELECT id, email, name, role, status, home_id FROM users WHERE id = ? AND home_id = ?",
    [userId, homeId]
  );
  return rows[0] ?? null;
}

export async function touchLastActive(userId) {
  await pool.query("UPDATE users SET last_active_at = NOW() WHERE id = ?", [userId]);
}

export async function getLastActive(userId) {
  const [rows] = await pool.query("SELECT last_active_at FROM users WHERE id = ?", [userId]);
  return rows[0]?.last_active_at ?? null;
}
