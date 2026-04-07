const pool = require('../config/db');

/**
 * Obtener todas las alertas con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de alertas
 */
const getAllAlerts = async (filters = {}) => {
  let query = `
    SELECT
      a.id,
      a.type,
      a.title,
      a.message,
      a.field_id,
      a.customer_id,
      a.reservation_id,
      a.user_id,
      a.status,
      a.priority,
      a.admin_id,
      a.reservation_data,
      a.user_id_registration,
      a.date_time_registration,
      f.name AS field_name,
      c.name AS customer_name,
      u.name AS admin_name
    FROM alerts a
    LEFT JOIN fields f ON a.field_id = f.id
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN users u ON a.admin_id = u.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por admin
  if (filters.admin_id) {
    query += ` AND a.admin_id = $${paramCount}`;
    params.push(filters.admin_id);
    paramCount++;
  }

  // Filtro por tipo
  if (filters.type) {
    query += ` AND a.type = $${paramCount}`;
    params.push(filters.type);
    paramCount++;
  }

  // Filtro por estado
  if (filters.status) {
    query += ` AND a.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por prioridad
  if (filters.priority) {
    query += ` AND a.priority = $${paramCount}`;
    params.push(filters.priority);
    paramCount++;
  }

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND a.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  query += ` ORDER BY a.date_time_registration DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener una alerta por ID
 * @param {number} id - ID de la alerta
 * @returns {Promise<Object|null>} Alerta o null
 */
const getAlertById = async id => {
  const query = `
    SELECT
      a.*,
      f.name AS field_name,
      c.name AS customer_name,
      c.phone_number AS customer_phone,
      u.name AS admin_name,
      u.email AS admin_email
    FROM alerts a
    LEFT JOIN fields f ON a.field_id = f.id
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN users u ON a.admin_id = u.id
    WHERE a.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear una nueva alerta
 * @param {Object} alertData - Datos de la alerta
 * @returns {Promise<Object>} Alerta creada
 */
const createAlert = async alertData => {
  const {
    type,
    title,
    message,
    field_id,
    customer_id,
    reservation_id,
    user_id,
    status = 'unread',
    priority = 'medium',
    admin_id,
    reservation_data,
    user_id_registration,
  } = alertData;

  const query = `
    INSERT INTO alerts (
      type,
      title,
      message,
      field_id,
      customer_id,
      reservation_id,
      user_id,
      status,
      priority,
      admin_id,
      reservation_data,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    type,
    title,
    message,
    field_id,
    customer_id,
    reservation_id,
    user_id,
    status,
    priority,
    admin_id,
    reservation_data,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Marcar una alerta como leída
 * @param {number} id - ID de la alerta
 * @param {number} user_id_modification - ID del usuario que modifica
 * @returns {Promise<Object|null>} Alerta actualizada o null
 */
const markAsRead = async (id, user_id_modification) => {
  const query = `
    UPDATE alerts
    SET status = 'read',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Marcar múltiples alertas como leídas
 * @param {Array} ids - Array de IDs de alertas
 * @param {number} user_id_modification - ID del usuario que modifica
 * @returns {Promise<number>} Número de alertas actualizadas
 */
const markMultipleAsRead = async (ids, user_id_modification) => {
  const query = `
    UPDATE alerts
    SET status = 'read',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = ANY($2)
    RETURNING id
  `;

  const result = await pool.query(query, [user_id_modification, ids]);
  return result.rows.length;
};

/**
 * Marcar TODAS las alertas como leídas (con filtro opcional por admin)
 * @param {number|null} adminId - ID del admin (null = todas)
 * @param {number} user_id_modification - ID del usuario que modifica
 * @returns {Promise<number>} Número de alertas actualizadas
 */
const markAllAsRead = async (adminId, user_id_modification) => {
  let query = `
    UPDATE alerts
    SET status = 'read',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE status = 'unread'
  `;

  const params = [user_id_modification];

  if (adminId) {
    query += ` AND admin_id = $2`;
    params.push(adminId);
  }

  query += ` RETURNING id`;

  const result = await pool.query(query, params);
  return result.rows.length;
};

/**
 * Eliminar una alerta
 * @param {number} id - ID de la alerta
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteAlert = async id => {
  const query = `DELETE FROM alerts WHERE id = $1 RETURNING id`;
  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Eliminar múltiples alertas
 * @param {Array} ids - Array de IDs de alertas
 * @returns {Promise<number>} Número de alertas eliminadas
 */
const deleteMultipleAlerts = async ids => {
  const query = `DELETE FROM alerts WHERE id = ANY($1) RETURNING id`;
  const result = await pool.query(query, [ids]);
  return result.rows.length;
};

/**
 * Obtener conteo de alertas no leídas por admin
 * @param {number} adminId - ID del admin
 * @returns {Promise<number>} Conteo de alertas no leídas
 */
const getUnreadCount = async adminId => {
  const query = `
    SELECT COUNT(*) as count
    FROM alerts
    WHERE admin_id = $1 AND status = 'unread'
  `;

  const result = await pool.query(query, [adminId]);
  return parseInt(result.rows[0].count);
};

/**
 * Obtener estadísticas de alertas por admin
 * @param {number} adminId - ID del admin
 * @returns {Promise<Object>} Estadísticas
 */
const getAlertStats = async adminId => {
  const query = `
    SELECT
      COUNT(*) AS total_alerts,
      COUNT(*) FILTER (WHERE status = 'unread') AS unread_alerts,
      COUNT(*) FILTER (WHERE status = 'read') AS read_alerts,
      COUNT(*) FILTER (WHERE priority = 'high') AS high_priority,
      COUNT(*) FILTER (WHERE priority = 'medium') AS medium_priority,
      COUNT(*) FILTER (WHERE priority = 'low') AS low_priority,
      COUNT(*) FILTER (WHERE type = 'new_reservation') AS new_reservations,
      COUNT(*) FILTER (WHERE type = 'cancellation') AS cancellations,
      COUNT(*) FILTER (WHERE type = 'payment') AS payments
    FROM alerts
    WHERE admin_id = $1
  `;

  const result = await pool.query(query, [adminId]);
  return result.rows[0];
};

module.exports = {
  getAllAlerts,
  getAlertById,
  createAlert,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteAlert,
  deleteMultipleAlerts,
  getUnreadCount,
  getAlertStats,
};
