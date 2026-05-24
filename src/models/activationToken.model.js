import { pool } from "../config/db.js";

export async function createToken(userId, tokenHash, expiresAt, conn = pool) {
  await conn.query(
    "INSERT INTO activation_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, tokenHash, expiresAt]
  );
}

export async function findValidToken(tokenHash) {
  const [rows] = await pool.query(
    `SELECT t.*, u.email, u.name, u.status, h.name AS home_name
     FROM activation_tokens t
     JOIN users u ON u.id = t.user_id
     JOIN homes h ON h.id = u.home_id
     WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

export async function markTokenUsed(tokenId, conn = pool) {
  await conn.query("UPDATE activation_tokens SET used_at = NOW() WHERE id = ?", [tokenId]);
}

export async function invalidateUserTokens(userId, conn = pool) {
  await conn.query(
    "UPDATE activation_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
    [userId]
  );
}
