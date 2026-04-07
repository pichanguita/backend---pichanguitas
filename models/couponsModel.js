const pool = require('../config/db');

/**
 * Obtener todos los cupones con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de cupones
 */
const getAllCoupons = async (filters = {}) => {
  let query = `
    SELECT
      c.id,
      c.code,
      c.name,
      c.description,
      c.type,
      c.value,
      c.is_active,
      c.usage_limit,
      c.used_count,
      c.valid_from,
      c.valid_until,
      c.min_purchase,
      c.applicable_fields,
      c.created_by,
      c.status,
      c.user_id_registration,
      c.date_time_registration,
      u.name AS created_by_name
    FROM coupons c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por estado activo
  if (filters.is_active !== undefined) {
    query += ` AND c.is_active = $${paramCount}`;
    params.push(filters.is_active);
    paramCount++;
  }

  // Filtro por tipo
  if (filters.type) {
    query += ` AND c.type = $${paramCount}`;
    params.push(filters.type);
    paramCount++;
  }

  // Filtro por estado
  if (filters.status) {
    query += ` AND c.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por vigencia (solo cupones válidos hoy)
  if (filters.valid_now === 'true') {
    query += ` AND c.valid_from <= CURRENT_DATE AND c.valid_until >= CURRENT_DATE`;
  }

  // Búsqueda por código o nombre
  if (filters.search) {
    query += ` AND (c.code ILIKE $${paramCount} OR c.name ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` ORDER BY c.date_time_registration DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un cupón por ID
 * @param {number} id - ID del cupón
 * @returns {Promise<Object|null>} Cupón o null
 */
const getCouponById = async id => {
  const query = `
    SELECT
      c.*,
      u.name AS created_by_name,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'field_id', f.id,
            'field_name', f.name
          )
        ) FILTER (WHERE f.id IS NOT NULL),
        '[]'
      ) AS applicable_fields_details
    FROM coupons c
    LEFT JOIN users u ON c.created_by = u.id
    LEFT JOIN coupon_fields cf ON c.id = cf.coupon_id
    LEFT JOIN fields f ON cf.field_id = f.id
    WHERE c.id = $1
    GROUP BY c.id, u.name
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener un cupón por código
 * @param {string} code - Código del cupón
 * @returns {Promise<Object|null>} Cupón o null
 */
const getCouponByCode = async code => {
  const query = `
    SELECT
      c.*,
      u.name AS created_by_name
    FROM coupons c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.code = $1
  `;

  const result = await pool.query(query, [code]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear un nuevo cupón
 * @param {Object} couponData - Datos del cupón
 * @returns {Promise<Object>} Cupón creado
 */
const createCoupon = async couponData => {
  const {
    code,
    name,
    description,
    type,
    value,
    is_active = true,
    usage_limit,
    valid_from,
    valid_until,
    min_purchase = 0,
    applicable_fields,
    created_by,
    status = 'active',
    user_id_registration,
  } = couponData;

  const query = `
    INSERT INTO coupons (
      code,
      name,
      description,
      type,
      value,
      is_active,
      usage_limit,
      valid_from,
      valid_until,
      min_purchase,
      applicable_fields,
      created_by,
      status,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    code,
    name,
    description,
    type,
    value,
    is_active,
    usage_limit,
    valid_from,
    valid_until,
    min_purchase,
    applicable_fields,
    created_by,
    status,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un cupón
 * @param {number} id - ID del cupón
 * @param {Object} couponData - Datos a actualizar
 * @returns {Promise<Object|null>} Cupón actualizado o null
 */
const updateCoupon = async (id, couponData) => {
  const {
    code,
    name,
    description,
    type,
    value,
    is_active,
    usage_limit,
    valid_from,
    valid_until,
    min_purchase,
    applicable_fields,
    status,
    user_id_modification,
  } = couponData;

  const query = `
    UPDATE coupons
    SET code = COALESCE($1, code),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        type = COALESCE($4, type),
        value = COALESCE($5, value),
        is_active = COALESCE($6, is_active),
        usage_limit = COALESCE($7, usage_limit),
        valid_from = COALESCE($8, valid_from),
        valid_until = COALESCE($9, valid_until),
        min_purchase = COALESCE($10, min_purchase),
        applicable_fields = COALESCE($11, applicable_fields),
        status = COALESCE($12, status),
        user_id_modification = $13,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $14
    RETURNING *
  `;

  const result = await pool.query(query, [
    code,
    name,
    description,
    type,
    value,
    is_active,
    usage_limit,
    valid_from,
    valid_until,
    min_purchase,
    applicable_fields,
    status,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Incrementar el contador de uso de un cupón
 * @param {number} id - ID del cupón
 * @returns {Promise<Object|null>} Cupón actualizado o null
 */
const incrementUsageCount = async id => {
  const query = `
    UPDATE coupons
    SET used_count = used_count + 1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar (soft delete) un cupón
 * @param {number} id - ID del cupón
 * @param {number} user_id_modification - ID del usuario que realiza la acción
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteCoupon = async (id, user_id_modification) => {
  const query = `
    UPDATE coupons
    SET is_active = false,
        status = 'inactive',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0;
};

/**
 * Verificar si un código de cupón ya existe
 * @param {string} code - Código del cupón
 * @param {number|null} excludeId - ID a excluir de la búsqueda (para updates)
 * @returns {Promise<boolean>} True si existe
 */
const couponCodeExists = async (code, excludeId = null) => {
  let query = `SELECT id FROM coupons WHERE code = $1`;
  const params = [code];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Validar si un cupón puede ser usado
 * @param {string} code - Código del cupón
 * @param {number} fieldId - ID de la cancha
 * @param {number} totalAmount - Monto total de la compra
 * @returns {Promise<Object>} {valid: boolean, message: string, coupon: Object}
 */
const validateCoupon = async (code, fieldId, totalAmount) => {
  const coupon = await getCouponByCode(code);

  if (!coupon) {
    return { valid: false, message: 'Cupón no encontrado', coupon: null };
  }

  if (!coupon.is_active || coupon.status !== 'active') {
    return { valid: false, message: 'Cupón inactivo', coupon: null };
  }

  const today = new Date();
  const validFrom = new Date(coupon.valid_from);
  const validUntil = new Date(coupon.valid_until);

  if (today < validFrom) {
    return { valid: false, message: 'Cupón aún no es válido', coupon: null };
  }

  if (today > validUntil) {
    return { valid: false, message: 'Cupón expirado', coupon: null };
  }

  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return { valid: false, message: 'Cupón ha alcanzado su límite de uso', coupon: null };
  }

  if (totalAmount < parseFloat(coupon.min_purchase)) {
    return {
      valid: false,
      message: `Compra mínima de S/. ${coupon.min_purchase} requerida`,
      coupon: null,
    };
  }

  // Validar si el cupón aplica a esta cancha
  if (coupon.applicable_fields && coupon.applicable_fields.length > 0) {
    if (!coupon.applicable_fields.includes(fieldId)) {
      return { valid: false, message: 'Cupón no válido para esta cancha', coupon: null };
    }
  }

  return { valid: true, message: 'Cupón válido', coupon };
};

/**
 * Obtener estadísticas de uso de cupones
 * @param {number|null} couponId - ID del cupón (opcional)
 * @returns {Promise<Object>} Estadísticas
 */
const getCouponStats = async (couponId = null) => {
  let query = `
    SELECT
      COUNT(*) AS total_usages,
      COALESCE(SUM(cu.used_at IS NOT NULL), 0) AS times_used,
      COUNT(DISTINCT cu.customer_id) AS unique_customers,
      COUNT(DISTINCT cu.reservation_id) AS unique_reservations
    FROM coupon_usage cu
  `;

  const params = [];
  if (couponId) {
    query += ` WHERE cu.coupon_id = $1`;
    params.push(couponId);
  }

  const result = await pool.query(query, params);
  return result.rows[0];
};

module.exports = {
  getAllCoupons,
  getCouponById,
  getCouponByCode,
  createCoupon,
  updateCoupon,
  incrementUsageCount,
  deleteCoupon,
  couponCodeExists,
  validateCoupon,
  getCouponStats,
};
