const pool = require('../config/db');

/**
 * Obtener todos los reembolsos con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de reembolsos
 */
const getAllRefunds = async (filters = {}) => {
  let query = `
    SELECT
      r.id,
      r.reservation_id,
      r.customer_id,
      r.customer_name,
      r.phone_number,
      r.field_id,
      r.refund_amount,
      r.status,
      r.cancelled_at,
      r.cancellation_reason,
      r.processed_at,
      r.processed_by,
      r.user_id_registration,
      r.date_time_registration,
      r.user_id_modification,
      r.date_time_modification,
      f.name AS field_name,
      pb.name AS processed_by_name,
      res.date AS reservation_date,
      res.start_time,
      res.end_time
    FROM refunds r
    LEFT JOIN fields f ON r.field_id = f.id
    LEFT JOIN users pb ON r.processed_by = pb.id
    LEFT JOIN reservations res ON r.reservation_id = res.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por estado
  if (filters.status) {
    query += ` AND r.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por cliente
  if (filters.customer_id) {
    query += ` AND r.customer_id = $${paramCount}`;
    params.push(filters.customer_id);
    paramCount++;
  }

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND r.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Filtro por rango de fechas de cancelación
  if (filters.start_date) {
    query += ` AND r.cancelled_at >= $${paramCount}`;
    params.push(filters.start_date);
    paramCount++;
  }

  if (filters.end_date) {
    query += ` AND r.cancelled_at <= $${paramCount}`;
    params.push(filters.end_date);
    paramCount++;
  }

  // Filtro por reembolsos pendientes
  if (filters.pending_only === 'true') {
    query += ` AND r.status = 'pending'`;
  }

  query += ` ORDER BY r.cancelled_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un reembolso por ID
 * @param {number} id - ID del reembolso
 * @returns {Promise<Object|null>} Reembolso o null
 */
const getRefundById = async id => {
  const query = `
    SELECT
      r.*,
      f.name AS field_name,
      pb.name AS processed_by_name,
      res.date AS reservation_date,
      res.start_time,
      res.end_time,
      res.total_price AS reservation_total
    FROM refunds r
    LEFT JOIN fields f ON r.field_id = f.id
    LEFT JOIN users pb ON r.processed_by = pb.id
    LEFT JOIN reservations res ON r.reservation_id = res.id
    WHERE r.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear un nuevo reembolso
 * @param {Object} refundData - Datos del reembolso
 * @returns {Promise<Object>} Reembolso creado
 */
const createRefund = async refundData => {
  const {
    reservation_id,
    customer_id,
    customer_name,
    phone_number,
    field_id,
    refund_amount,
    status = 'pending',
    cancelled_at,
    cancellation_reason,
    user_id_registration,
  } = refundData;

  const query = `
    INSERT INTO refunds (
      reservation_id,
      customer_id,
      customer_name,
      phone_number,
      field_id,
      refund_amount,
      status,
      cancelled_at,
      cancellation_reason,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    reservation_id,
    customer_id,
    customer_name,
    phone_number,
    field_id,
    refund_amount,
    status,
    cancelled_at,
    cancellation_reason,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un reembolso
 * @param {number} id - ID del reembolso
 * @param {Object} refundData - Datos a actualizar
 * @returns {Promise<Object|null>} Reembolso actualizado o null
 */
const updateRefund = async (id, refundData) => {
  const { refund_amount, status, cancellation_reason, user_id_modification } = refundData;

  const query = `
    UPDATE refunds
    SET refund_amount = COALESCE($1, refund_amount),
        status = COALESCE($2, status),
        cancellation_reason = COALESCE($3, cancellation_reason),
        user_id_modification = $4,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `;

  const result = await pool.query(query, [
    refund_amount,
    status,
    cancellation_reason,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Procesar un reembolso
 * @param {number} id - ID del reembolso
 * @param {number} processed_by - ID del usuario que procesa
 * @returns {Promise<Object|null>} Reembolso procesado o null
 */
const processRefund = async (id, processed_by) => {
  const query = `
    UPDATE refunds
    SET status = 'processed',
        processed_at = CURRENT_TIMESTAMP,
        processed_by = $1,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [processed_by, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Rechazar un reembolso
 * @param {number} id - ID del reembolso
 * @param {number} processed_by - ID del usuario que rechaza
 * @returns {Promise<Object|null>} Reembolso rechazado o null
 */
const rejectRefund = async (id, processed_by) => {
  const query = `
    UPDATE refunds
    SET status = 'rejected',
        processed_at = CURRENT_TIMESTAMP,
        processed_by = $1,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [processed_by, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar un reembolso
 * @param {number} id - ID del reembolso
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteRefund = async id => {
  const query = `
    DELETE FROM refunds
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Verificar si ya existe un reembolso para una reserva
 * @param {number} reservation_id - ID de la reserva
 * @returns {Promise<boolean>} True si existe
 */
const refundExistsForReservation = async reservation_id => {
  const query = `
    SELECT id FROM refunds
    WHERE reservation_id = $1
  `;

  const result = await pool.query(query, [reservation_id]);
  return result.rows.length > 0;
};

/**
 * Obtener estadísticas de reembolsos
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Object>} Estadísticas
 */
const getRefundStats = async (filters = {}) => {
  let query = `
    SELECT
      COUNT(*) AS total_refunds,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_refunds,
      COUNT(*) FILTER (WHERE status = 'processed') AS processed_refunds,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_refunds,
      COALESCE(SUM(refund_amount), 0) AS total_refund_amount,
      COALESCE(SUM(refund_amount) FILTER (WHERE status = 'processed'), 0) AS total_processed_amount,
      COALESCE(SUM(refund_amount) FILTER (WHERE status = 'pending'), 0) AS total_pending_amount,
      COUNT(*) FILTER (WHERE cancelled_at >= CURRENT_DATE - INTERVAL '30 days') AS refunds_last_30_days
    FROM refunds
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  if (filters.field_id) {
    query += ` AND field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  if (filters.start_date) {
    query += ` AND cancelled_at >= $${paramCount}`;
    params.push(filters.start_date);
    paramCount++;
  }

  if (filters.end_date) {
    query += ` AND cancelled_at <= $${paramCount}`;
    params.push(filters.end_date);
    paramCount++;
  }

  const result = await pool.query(query, params);
  return result.rows[0];
};

module.exports = {
  getAllRefunds,
  getRefundById,
  createRefund,
  updateRefund,
  processRefund,
  rejectRefund,
  deleteRefund,
  refundExistsForReservation,
  getRefundStats,
};
