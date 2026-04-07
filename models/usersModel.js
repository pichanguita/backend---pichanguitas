const bcrypt = require('bcrypt');

const pool = require('../config/db');

/**
 * Obtener todos los usuarios con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de usuarios
 */
const getAllUsers = async (filters = {}) => {
  let query = `
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
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'field_id', f.id,
            'field_name', f.name
          )
        ) FILTER (WHERE f.id IS NOT NULL),
        '[]'
      ) AS managed_fields
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN user_managed_fields umf ON u.id = umf.user_id
    LEFT JOIN fields f ON umf.field_id = f.id
    WHERE u.status != 'deleted'
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por rol
  if (filters.role_id) {
    query += ` AND u.role_id = $${paramCount}`;
    params.push(filters.role_id);
    paramCount++;
  }

  // Filtro por tipo de admin
  if (filters.admin_type) {
    query += ` AND u.admin_type = $${paramCount}`;
    params.push(filters.admin_type);
    paramCount++;
  }

  // Filtro por estado activo
  if (filters.is_active !== undefined) {
    query += ` AND u.is_active = $${paramCount}`;
    params.push(filters.is_active);
    paramCount++;
  }

  // Filtro por estado
  if (filters.status) {
    query += ` AND u.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Búsqueda por nombre, username o email
  if (filters.search) {
    query += ` AND (u.name ILIKE $${paramCount} OR u.username ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` GROUP BY u.id, r.name`;
  query += ` ORDER BY u.date_time_registration DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un usuario por ID con sus permisos
 * @param {number} id - ID del usuario
 * @returns {Promise<Object|null>} Usuario o null
 */
const getUserById = async id => {
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
        json_agg(
          DISTINCT jsonb_build_object(
            'field_id', f.id,
            'field_name', f.name
          )
        ) FILTER (WHERE f.id IS NOT NULL),
        '[]'
      ) AS managed_fields
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN roles_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
    LEFT JOIN user_managed_fields umf ON u.id = umf.user_id
    LEFT JOIN fields f ON umf.field_id = f.id
    WHERE u.id = $1
    GROUP BY u.id, r.name
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener un usuario por email
 * @param {string} email - Email del usuario
 * @returns {Promise<Object|null>} Usuario o null
 */
const getUserByEmail = async email => {
  const query = `
    SELECT
      u.*,
      r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.email = $1
  `;

  const result = await pool.query(query, [email]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener un usuario por username
 * @param {string} username - Username del usuario
 * @returns {Promise<Object|null>} Usuario o null
 */
const getUserByUsername = async username => {
  const query = `
    SELECT
      u.*,
      r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.username = $1
  `;

  const result = await pool.query(query, [username]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear un nuevo usuario
 * @param {Object} userData - Datos del usuario
 * @returns {Promise<Object>} Usuario creado
 */
const createUser = async userData => {
  const {
    username,
    email,
    password,
    role_id,
    admin_type,
    name,
    phone,
    avatar_url,
    is_active = true,
    status = 'active',
    created_by,
    user_id_registration,
  } = userData;

  // Hash de la contraseña
  const password_hash = await bcrypt.hash(password, 10);

  const query = `
    INSERT INTO users (
      username,
      email,
      password_hash,
      role_id,
      admin_type,
      name,
      phone,
      avatar_url,
      is_active,
      status,
      created_by,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
    RETURNING id, username, email, role_id, admin_type, name, phone, avatar_url, is_active, status, date_time_registration
  `;

  const result = await pool.query(query, [
    username,
    email,
    password_hash,
    role_id,
    admin_type,
    name,
    phone,
    avatar_url,
    is_active,
    status,
    created_by,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un usuario
 * @param {number} id - ID del usuario
 * @param {Object} userData - Datos a actualizar
 * @returns {Promise<Object|null>} Usuario actualizado o null
 */
const updateUser = async (id, userData) => {
  const {
    username,
    email,
    role_id,
    admin_type,
    name,
    phone,
    avatar_url,
    is_active,
    is_blocked,
    block_until,
    status,
    user_id_modification,
  } = userData;

  // Determinar si se debe limpiar block_until explícitamente
  // Casos:
  // 1. block_until = null con is_blocked definido → limpiar (bloqueo permanente o desbloqueo)
  // 2. block_until = undefined → mantener valor actual (COALESCE)
  // 3. block_until = fecha → establecer esa fecha
  const shouldClearBlockUntil =
    block_until === null && (is_blocked === true || is_blocked === false);
  const shouldKeepBlockUntil = block_until === undefined;

  // Usar un valor especial '__CLEAR__' para indicar que queremos limpiar
  // Esto evita problemas con PostgreSQL al pasar null directamente
  const blockUntilParam = shouldClearBlockUntil
    ? '__CLEAR__'
    : shouldKeepBlockUntil
      ? '__KEEP__'
      : block_until;

  const query = `
    UPDATE users
    SET username = COALESCE($1, username),
        email = COALESCE($2, email),
        role_id = COALESCE($3, role_id),
        admin_type = COALESCE($4, admin_type),
        name = COALESCE($5, name),
        phone = COALESCE($6, phone),
        avatar_url = COALESCE($7, avatar_url),
        is_active = COALESCE($8, is_active),
        is_blocked = COALESCE($9, is_blocked),
        block_until = CASE
          WHEN $10::text = '__CLEAR__' THEN NULL
          WHEN $10::text = '__KEEP__' THEN block_until
          ELSE $10::timestamptz
        END,
        status = COALESCE($11, status),
        user_id_modification = $12,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $13
    RETURNING id, username, email, role_id, admin_type, name, phone, avatar_url, is_active, is_blocked, block_until, status, date_time_modification
  `;

  const result = await pool.query(query, [
    username,
    email,
    role_id,
    admin_type,
    name,
    phone,
    avatar_url,
    is_active,
    is_blocked,
    blockUntilParam,
    status,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Actualizar contraseña de un usuario
 * @param {number} id - ID del usuario
 * @param {string} newPassword - Nueva contraseña
 * @param {number} user_id_modification - ID del usuario que modifica
 * @returns {Promise<boolean>} True si se actualizó correctamente
 */
const updatePassword = async (id, newPassword, user_id_modification) => {
  const password_hash = await bcrypt.hash(newPassword, 10);

  const query = `
    UPDATE users
    SET password_hash = $1,
        user_id_modification = $2,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id
  `;

  const result = await pool.query(query, [password_hash, user_id_modification, id]);
  return result.rows.length > 0;
};

/**
 * Eliminar (soft delete) un usuario
 * @param {number} id - ID del usuario
 * @param {number} user_id_modification - ID del usuario que realiza la acción
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteUser = async (id, user_id_modification) => {
  const query = `
    UPDATE users
    SET is_active = false,
        status = 'deleted',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0;
};

/**
 * Verificar si un email ya existe
 * @param {string} email - Email
 * @param {number|null} excludeId - ID a excluir de la búsqueda (para updates)
 * @returns {Promise<boolean>} True si existe
 */
const emailExists = async (email, excludeId = null) => {
  let query = `SELECT id FROM users WHERE email = $1`;
  const params = [email];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Verificar si un username ya existe
 * @param {string} username - Username
 * @param {number|null} excludeId - ID a excluir de la búsqueda (para updates)
 * @returns {Promise<boolean>} True si existe
 */
const usernameExists = async (username, excludeId = null) => {
  let query = `SELECT id FROM users WHERE username = $1`;
  const params = [username];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Asignar canchas a un usuario (para field admins)
 * @param {number} userId - ID del usuario
 * @param {Array} fieldIds - Array de IDs de canchas
 * @param {number} assignedBy - ID del usuario que asigna
 * @returns {Promise<boolean>} True si se asignaron correctamente
 */
const assignFieldsToUser = async (userId, fieldIds, assignedBy) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Eliminar asignaciones existentes
    await client.query('DELETE FROM user_managed_fields WHERE user_id = $1', [userId]);

    // Insertar nuevas asignaciones
    if (fieldIds && fieldIds.length > 0) {
      const values = fieldIds
        .map((fieldId, index) => {
          const offset = index * 3;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, CURRENT_TIMESTAMP)`;
        })
        .join(', ');

      const params = [];
      fieldIds.forEach(fieldId => {
        params.push(userId, fieldId, assignedBy);
      });

      const insertQuery = `
        INSERT INTO user_managed_fields (user_id, field_id, assigned_by, assigned_at)
        VALUES ${values}
      `;

      await client.query(insertQuery, params);
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Obtener estadísticas de usuarios
 * @returns {Promise<Object>} Estadísticas de usuarios
 */
const getUsersStats = async () => {
  const query = `
    SELECT
      COUNT(*) AS total_users,
      COUNT(*) FILTER (WHERE is_active = true AND status = 'active') AS active_users,
      COUNT(*) FILTER (WHERE is_active = false OR status = 'inactive') AS inactive_users,
      COUNT(DISTINCT umf.user_id) FILTER (WHERE umf.user_id IS NOT NULL) AS users_with_fields
    FROM users u
    LEFT JOIN user_managed_fields umf ON u.id = umf.user_id
  `;

  const result = await pool.query(query);
  return result.rows[0];
};

module.exports = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  getUserByUsername,
  createUser,
  updateUser,
  updatePassword,
  deleteUser,
  emailExists,
  usernameExists,
  assignFieldsToUser,
  getUsersStats,
};
