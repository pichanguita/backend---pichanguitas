const pool = require('../config/db');

/**
 * Crear un token de recuperacion de contrasena
 */
const createResetToken = async (userId, tokenHash, expiresAt) => {
  // Invalidar tokens anteriores del mismo usuario
  await pool.query(
    'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
    [userId]
  );

  const result = await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, expires_at, created_at`,
    [userId, tokenHash, expiresAt]
  );

  return result.rows[0];
};

/**
 * Buscar un token valido (no usado y no expirado) por su hash
 */
const findValidToken = async (tokenHash) => {
  const result = await pool.query(
    `SELECT prt.*, u.name, u.email
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1
       AND prt.used = false
       AND prt.expires_at > NOW()`,
    [tokenHash]
  );

  return result.rows[0] || null;
};

/**
 * Marcar un token como usado
 */
const markTokenAsUsed = async (tokenId) => {
  await pool.query(
    'UPDATE password_reset_tokens SET used = true WHERE id = $1',
    [tokenId]
  );
};

/**
 * Contar solicitudes recientes de un email (rate limiting)
 */
const countRecentRequests = async (userId, minutesAgo = 15) => {
  const result = await pool.query(
    `SELECT COUNT(*) as count
     FROM password_reset_tokens
     WHERE user_id = $1
       AND created_at > NOW() - INTERVAL '${minutesAgo} minutes'`,
    [userId]
  );

  return parseInt(result.rows[0].count);
};

/**
 * Limpiar tokens expirados (mantenimiento)
 */
const cleanExpiredTokens = async () => {
  const result = await pool.query(
    'DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = true'
  );
  return result.rowCount;
};

module.exports = {
  createResetToken,
  findValidToken,
  markTokenAsUsed,
  countRecentRequests,
  cleanExpiredTokens,
};
