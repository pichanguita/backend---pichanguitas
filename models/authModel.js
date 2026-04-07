const pool = require('../config/db');

/**
 * Buscar usuario por username, email o phone con su rol y permisos
 * @param {string} identifier - Username, email o phone del usuario
 * @returns {Promise<Object|null>} Usuario con sus datos, rol y permisos
 */
const findUserByIdentifier = async identifier => {
  const query = `
    SELECT
      u.id,
      u.username,
      u.email,
      u.password_hash,
      u.role_id,
      r.name AS role,
      u.admin_type,
      u.name,
      u.phone,
      u.avatar_url,
      u.is_active,
      u.last_login,
      u.created_by,
      u.login_attempts,
      u.last_login_attempt,
      u.is_blocked,
      u.block_until,
      u.status,
      u.user_id_registration,
      u.date_time_registration,
      u.user_id_modification,
      u.date_time_modification,
      c.id AS customer_id,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'module', p.module
          )
        ) FILTER (WHERE p.id IS NOT NULL),
        '[]'
      ) AS permissions,
      COALESCE(
        ARRAY_AGG(DISTINCT f.id) FILTER (WHERE f.id IS NOT NULL),
        ARRAY[]::INTEGER[]
      ) AS managed_fields
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id AND r.is_active = true
    LEFT JOIN roles_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
    LEFT JOIN customers c ON c.user_id = u.id
    LEFT JOIN (
      SELECT umf.user_id, umf.field_id AS id
      FROM user_managed_fields umf
      UNION
      SELECT f2.admin_id AS user_id, f2.id
      FROM fields f2
      WHERE f2.is_active = true
    ) f ON f.user_id = u.id
    WHERE (u.username = $1 OR u.email = $1 OR u.phone = $1)
      AND u.is_active = true
    GROUP BY u.id, u.username, u.email, u.password_hash, u.role_id, r.name,
             u.admin_type, u.name, u.phone, u.avatar_url, u.is_active,
             u.last_login, u.created_by, u.login_attempts, u.last_login_attempt,
             u.is_blocked, u.block_until, u.status, u.user_id_registration,
             u.date_time_registration, u.user_id_modification, u.date_time_modification,
             c.id
  `;

  const result = await pool.query(query, [identifier]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Actualizar intentos de login del usuario
 * @param {number} userId - ID del usuario
 * @param {number} attempts - Número de intentos
 * @returns {Promise<void>}
 */
const updateLoginAttempts = async (userId, attempts) => {
  const query = `
    UPDATE users
    SET login_attempts = $1,
        last_login_attempt = CURRENT_TIMESTAMP,
        user_id_modification = $2,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
  `;

  await pool.query(query, [attempts, userId, userId]);
};

/**
 * Bloquear usuario temporalmente
 * @param {number} userId - ID del usuario
 * @param {number} minutesBlocked - Minutos de bloqueo
 * @returns {Promise<void>}
 */
const blockUser = async (userId, minutesBlocked = 15) => {
  const query = `
    UPDATE users
    SET is_blocked = true,
        block_until = CURRENT_TIMESTAMP + INTERVAL '${minutesBlocked} minutes',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
  `;

  await pool.query(query, [userId, userId]);
};

/**
 * Resetear intentos de login exitoso
 * @param {number} userId - ID del usuario
 * @returns {Promise<void>}
 */
const resetLoginAttempts = async userId => {
  const query = `
    UPDATE users
    SET login_attempts = 0,
        is_blocked = false,
        block_until = NULL,
        last_login = CURRENT_TIMESTAMP,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
  `;

  await pool.query(query, [userId, userId]);
};

module.exports = {
  findUserByIdentifier,
  updateLoginAttempts,
  blockUser,
  resetLoginAttempts,
};
