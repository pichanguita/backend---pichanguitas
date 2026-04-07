const pool = require('../config/db');

/**
 * Obtener todos los registros de uso de cupones con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de usos de cupones
 */
const getAllCouponUsage = async (filters = {}) => {
  let query = `
    SELECT
      cu.id,
      cu.coupon_id,
      cu.user_id,
      cu.customer_id,
      cu.reservation_id,
      cu.used_at,
      cu.user_id_registration,
      cu.date_time_registration,
      cu.user_id_modification,
      cu.date_time_modification,
      c.code AS coupon_code,
      c.name AS coupon_name,
      c.type AS coupon_type,
      c.value AS coupon_value,
      cust.name AS customer_name,
      cust.phone AS customer_phone,
      u.name AS user_name,
      r.date AS reservation_date,
      r.total_amount AS reservation_total
    FROM coupon_usage cu
    LEFT JOIN coupons c ON cu.coupon_id = c.id
    LEFT JOIN customers cust ON cu.customer_id = cust.id
    LEFT JOIN users u ON cu.user_id = u.id
    LEFT JOIN reservations r ON cu.reservation_id = r.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cupón
  if (filters.coupon_id) {
    query += ` AND cu.coupon_id = $${paramCount}`;
    params.push(filters.coupon_id);
    paramCount++;
  }

  // Filtro por cliente
  if (filters.customer_id) {
    query += ` AND cu.customer_id = $${paramCount}`;
    params.push(filters.customer_id);
    paramCount++;
  }

  // Filtro por usuario
  if (filters.user_id) {
    query += ` AND cu.user_id = $${paramCount}`;
    params.push(filters.user_id);
    paramCount++;
  }

  // Filtro por reserva
  if (filters.reservation_id) {
    query += ` AND cu.reservation_id = $${paramCount}`;
    params.push(filters.reservation_id);
    paramCount++;
  }

  // Filtro por rango de fechas
  if (filters.start_date) {
    query += ` AND cu.used_at >= $${paramCount}`;
    params.push(filters.start_date);
    paramCount++;
  }

  if (filters.end_date) {
    query += ` AND cu.used_at <= $${paramCount}`;
    params.push(filters.end_date);
    paramCount++;
  }

  query += ` ORDER BY cu.used_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un registro de uso por ID
 * @param {number} id - ID del registro
 * @returns {Promise<Object|null>} Registro o null
 */
const getCouponUsageById = async id => {
  const query = `
    SELECT
      cu.*,
      c.code AS coupon_code,
      c.name AS coupon_name,
      c.type AS coupon_type,
      c.value AS coupon_value,
      cust.name AS customer_name,
      cust.phone AS customer_phone,
      u.name AS user_name,
      r.date AS reservation_date,
      r.total_amount AS reservation_total
    FROM coupon_usage cu
    LEFT JOIN coupons c ON cu.coupon_id = c.id
    LEFT JOIN customers cust ON cu.customer_id = cust.id
    LEFT JOIN users u ON cu.user_id = u.id
    LEFT JOIN reservations r ON cu.reservation_id = r.id
    WHERE cu.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Registrar el uso de un cupón
 * @param {Object} usageData - Datos del uso
 * @returns {Promise<Object>} Registro creado
 */
const recordCouponUsage = async usageData => {
  const { coupon_id, user_id, customer_id, reservation_id, user_id_registration } = usageData;

  const query = `
    INSERT INTO coupon_usage (
      coupon_id,
      user_id,
      customer_id,
      reservation_id,
      used_at,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    coupon_id,
    user_id,
    customer_id,
    reservation_id,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Verificar si un cupón ya fue usado en una reserva
 * @param {number} coupon_id - ID del cupón
 * @param {number} reservation_id - ID de la reserva
 * @returns {Promise<boolean>} True si ya fue usado
 */
const isCouponUsedInReservation = async (coupon_id, reservation_id) => {
  const query = `
    SELECT id FROM coupon_usage
    WHERE coupon_id = $1 AND reservation_id = $2
  `;

  const result = await pool.query(query, [coupon_id, reservation_id]);
  return result.rows.length > 0;
};

/**
 * Obtener usos de un cupón específico
 * @param {number} coupon_id - ID del cupón
 * @returns {Promise<Array>} Lista de usos
 */
const getCouponUsageByCouponId = async coupon_id => {
  const query = `
    SELECT
      cu.*,
      cust.name AS customer_name,
      cust.phone AS customer_phone,
      r.date AS reservation_date,
      r.total_amount AS reservation_total
    FROM coupon_usage cu
    LEFT JOIN customers cust ON cu.customer_id = cust.id
    LEFT JOIN reservations r ON cu.reservation_id = r.id
    WHERE cu.coupon_id = $1
    ORDER BY cu.used_at DESC
  `;

  const result = await pool.query(query, [coupon_id]);
  return result.rows;
};

/**
 * Obtener usos de cupones de un cliente
 * @param {number} customer_id - ID del cliente
 * @returns {Promise<Array>} Lista de usos
 */
const getCouponUsageByCustomerId = async customer_id => {
  const query = `
    SELECT
      cu.*,
      c.code AS coupon_code,
      c.name AS coupon_name,
      c.type AS coupon_type,
      c.value AS coupon_value,
      r.date AS reservation_date,
      r.total_amount AS reservation_total
    FROM coupon_usage cu
    LEFT JOIN coupons c ON cu.coupon_id = c.id
    LEFT JOIN reservations r ON cu.reservation_id = r.id
    WHERE cu.customer_id = $1
    ORDER BY cu.used_at DESC
  `;

  const result = await pool.query(query, [customer_id]);
  return result.rows;
};

/**
 * Eliminar un registro de uso de cupón
 * @param {number} id - ID del registro
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteCouponUsage = async id => {
  const query = `
    DELETE FROM coupon_usage
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Obtener estadísticas de uso de cupones
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Object>} Estadísticas
 */
const getCouponUsageStats = async (filters = {}) => {
  let query = `
    SELECT
      COUNT(*) AS total_uses,
      COUNT(DISTINCT coupon_id) AS unique_coupons_used,
      COUNT(DISTINCT customer_id) AS unique_customers,
      COUNT(DISTINCT reservation_id) AS unique_reservations,
      COUNT(*) FILTER (WHERE used_at >= CURRENT_DATE - INTERVAL '30 days') AS uses_last_30_days,
      COUNT(*) FILTER (WHERE used_at >= CURRENT_DATE - INTERVAL '7 days') AS uses_last_7_days
    FROM coupon_usage
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  if (filters.coupon_id) {
    query += ` AND coupon_id = $${paramCount}`;
    params.push(filters.coupon_id);
    paramCount++;
  }

  if (filters.start_date) {
    query += ` AND used_at >= $${paramCount}`;
    params.push(filters.start_date);
    paramCount++;
  }

  if (filters.end_date) {
    query += ` AND used_at <= $${paramCount}`;
    params.push(filters.end_date);
    paramCount++;
  }

  const result = await pool.query(query, params);
  return result.rows[0];
};

module.exports = {
  getAllCouponUsage,
  getCouponUsageById,
  recordCouponUsage,
  isCouponUsedInReservation,
  getCouponUsageByCouponId,
  getCouponUsageByCustomerId,
  deleteCouponUsage,
  getCouponUsageStats,
};
