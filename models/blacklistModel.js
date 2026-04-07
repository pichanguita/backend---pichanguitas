const pool = require('../config/db');

/**
 * Obtener todos los registros de la lista negra con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de registros
 */
const getAllBlacklist = async (filters = {}) => {
  let query = `
    SELECT
      b.id,
      b.phone_number,
      b.customer_name,
      b.reason,
      b.blocked_by,
      b.blocked_at,
      b.blocked_until,
      b.reservations_missed,
      b.status,
      b.user_id_registration,
      b.date_time_registration,
      b.user_id_modification,
      b.date_time_modification,
      u.name AS blocked_by_name
    FROM blacklist b
    LEFT JOIN users u ON b.blocked_by = u.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por estado
  if (filters.status) {
    query += ` AND b.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por teléfono
  if (filters.phone_number) {
    query += ` AND b.phone_number = $${paramCount}`;
    params.push(filters.phone_number);
    paramCount++;
  }

  // Filtro por búsqueda (nombre o teléfono)
  if (filters.search) {
    query += ` AND (b.customer_name ILIKE $${paramCount} OR b.phone_number ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  // Filtro por bloqueos activos (no vencidos)
  if (filters.active_only === 'true') {
    query += ` AND b.status = 'active' AND (b.blocked_until IS NULL OR b.blocked_until > CURRENT_TIMESTAMP)`;
  }

  query += ` ORDER BY b.blocked_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un registro por ID
 * @param {number} id - ID del registro
 * @returns {Promise<Object|null>} Registro o null
 */
const getBlacklistById = async id => {
  const query = `
    SELECT
      b.*,
      u.name AS blocked_by_name
    FROM blacklist b
    LEFT JOIN users u ON b.blocked_by = u.id
    WHERE b.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Verificar si un teléfono está en la lista negra activa
 * @param {string} phone_number - Número de teléfono
 * @returns {Promise<Object|null>} Registro activo o null
 */
const checkPhoneInBlacklist = async phone_number => {
  const query = `
    SELECT * FROM blacklist
    WHERE phone_number = $1
      AND status = 'active'
      AND (blocked_until IS NULL OR blocked_until > CURRENT_TIMESTAMP)
    ORDER BY blocked_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [phone_number]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear un nuevo registro en la lista negra
 * @param {Object} blacklistData - Datos del registro
 * @returns {Promise<Object>} Registro creado
 */
const createBlacklist = async blacklistData => {
  const {
    phone_number,
    customer_name,
    reason,
    blocked_by,
    blocked_until,
    reservations_missed = 0,
    user_id_registration,
  } = blacklistData;

  const query = `
    INSERT INTO blacklist (
      phone_number,
      customer_name,
      reason,
      blocked_by,
      blocked_at,
      blocked_until,
      reservations_missed,
      status,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, 'active', $7, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    phone_number,
    customer_name,
    reason,
    blocked_by,
    blocked_until,
    reservations_missed,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un registro de la lista negra
 * @param {number} id - ID del registro
 * @param {Object} blacklistData - Datos a actualizar
 * @returns {Promise<Object|null>} Registro actualizado o null
 */
const updateBlacklist = async (id, blacklistData) => {
  const {
    phone_number,
    customer_name,
    reason,
    blocked_until,
    reservations_missed,
    status,
    user_id_modification,
  } = blacklistData;

  const query = `
    UPDATE blacklist
    SET phone_number = COALESCE($1, phone_number),
        customer_name = COALESCE($2, customer_name),
        reason = COALESCE($3, reason),
        blocked_until = COALESCE($4, blocked_until),
        reservations_missed = COALESCE($5, reservations_missed),
        status = COALESCE($6, status),
        user_id_modification = $7,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $8
    RETURNING *
  `;

  const result = await pool.query(query, [
    phone_number,
    customer_name,
    reason,
    blocked_until,
    reservations_missed,
    status,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Desbloquear un registro (cambiar status a inactive)
 * @param {number} id - ID del registro
 * @param {number} user_id_modification - ID del usuario
 * @returns {Promise<Object|null>} Registro actualizado o null
 */
const unblockPhone = async (id, user_id_modification) => {
  const query = `
    UPDATE blacklist
    SET status = 'inactive',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar un registro de la lista negra
 * @param {number} id - ID del registro
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteBlacklist = async id => {
  const query = `
    DELETE FROM blacklist
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Verificar si un teléfono ya tiene un registro activo
 * @param {string} phone_number - Número de teléfono
 * @param {number|null} excludeId - ID a excluir de la búsqueda
 * @returns {Promise<boolean>} True si existe
 */
const phoneHasActiveBlock = async (phone_number, excludeId = null) => {
  let query = `
    SELECT id FROM blacklist
    WHERE phone_number = $1
      AND status = 'active'
      AND (blocked_until IS NULL OR blocked_until > CURRENT_TIMESTAMP)
  `;
  const params = [phone_number];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Obtener estadísticas de la lista negra
 * @returns {Promise<Object>} Estadísticas
 */
const getBlacklistStats = async () => {
  const query = `
    SELECT
      COUNT(*) AS total_blocks,
      COUNT(*) FILTER (WHERE status = 'active') AS active_blocks,
      COUNT(*) FILTER (WHERE status = 'inactive') AS inactive_blocks,
      COUNT(*) FILTER (
        WHERE status = 'active'
          AND (blocked_until IS NULL OR blocked_until > CURRENT_TIMESTAMP)
      ) AS current_active_blocks,
      COUNT(*) FILTER (
        WHERE status = 'active'
          AND blocked_until IS NOT NULL
          AND blocked_until <= CURRENT_TIMESTAMP
      ) AS expired_blocks,
      AVG(reservations_missed) FILTER (WHERE reservations_missed > 0) AS avg_reservations_missed
    FROM blacklist
  `;

  const result = await pool.query(query);
  return result.rows[0];
};

/**
 * Actualizar bloqueos expirados (cambiar status a inactive)
 * @returns {Promise<number>} Cantidad de registros actualizados
 */
const updateExpiredBlocks = async () => {
  const query = `
    UPDATE blacklist
    SET status = 'inactive',
        date_time_modification = CURRENT_TIMESTAMP
    WHERE status = 'active'
      AND blocked_until IS NOT NULL
      AND blocked_until <= CURRENT_TIMESTAMP
    RETURNING id
  `;

  const result = await pool.query(query);
  return result.rows.length;
};

module.exports = {
  getAllBlacklist,
  getBlacklistById,
  checkPhoneInBlacklist,
  createBlacklist,
  updateBlacklist,
  unblockPhone,
  deleteBlacklist,
  phoneHasActiveBlock,
  getBlacklistStats,
  updateExpiredBlocks,
};
