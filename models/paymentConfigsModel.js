const pool = require('../config/db');

/**
 * Obtener todas las configuraciones de pago con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de configuraciones
 */
const getAllPaymentConfigs = async (filters = {}) => {
  let query = `
    SELECT
      pc.id,
      pc.field_id,
      pc.admin_id,
      pc.monthly_fee,
      pc.due_day,
      pc.effective_from,
      pc.is_active,
      pc.status,
      pc.user_id_registration,
      pc.date_time_registration,
      pc.user_id_modification,
      pc.date_time_modification,
      f.name AS field_name,
      u.name AS admin_name
    FROM payment_configs pc
    LEFT JOIN fields f ON pc.field_id = f.id
    LEFT JOIN users u ON pc.admin_id = u.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND pc.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Filtro por administrador
  if (filters.admin_id) {
    query += ` AND pc.admin_id = $${paramCount}`;
    params.push(filters.admin_id);
    paramCount++;
  }

  // Filtro por estado activo
  if (filters.is_active !== undefined) {
    query += ` AND pc.is_active = $${paramCount}`;
    params.push(filters.is_active);
    paramCount++;
  }

  query += ` ORDER BY pc.date_time_registration DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener configuración de pago por ID
 * @param {number} id - ID de la configuración
 * @returns {Promise<Object|null>} Configuración o null
 */
const getPaymentConfigById = async id => {
  const query = `
    SELECT
      pc.*,
      f.name AS field_name,
      u.name AS admin_name
    FROM payment_configs pc
    LEFT JOIN fields f ON pc.field_id = f.id
    LEFT JOIN users u ON pc.admin_id = u.id
    WHERE pc.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener configuración de pago por field_id
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<Object|null>} Configuración o null
 */
const getPaymentConfigByFieldId = async field_id => {
  const query = `
    SELECT
      pc.*,
      f.name AS field_name,
      u.name AS admin_name
    FROM payment_configs pc
    LEFT JOIN fields f ON pc.field_id = f.id
    LEFT JOIN users u ON pc.admin_id = u.id
    WHERE pc.field_id = $1
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear una nueva configuración de pago
 * @param {Object} configData - Datos de la configuración
 * @returns {Promise<Object>} Configuración creada
 */
const createPaymentConfig = async configData => {
  const {
    field_id,
    admin_id,
    monthly_fee,
    due_day,
    effective_from,
    is_active = true,
    user_id_registration,
  } = configData;

  const query = `
    INSERT INTO payment_configs (
      field_id,
      admin_id,
      monthly_fee,
      due_day,
      effective_from,
      is_active,
      status,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, 'active', $7, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    field_id,
    admin_id,
    monthly_fee,
    due_day,
    effective_from || null,
    is_active,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar una configuración de pago
 * @param {number} id - ID de la configuración
 * @param {Object} configData - Datos a actualizar
 * @returns {Promise<Object|null>} Configuración actualizada o null
 */
const updatePaymentConfig = async (id, configData) => {
  const { monthly_fee, due_day, effective_from, is_active, status, user_id_modification } = configData;

  const query = `
    UPDATE payment_configs
    SET monthly_fee = COALESCE($1, monthly_fee),
        due_day = COALESCE($2, due_day),
        effective_from = COALESCE($3, effective_from),
        is_active = COALESCE($4, is_active),
        status = COALESCE($5, status),
        user_id_modification = $6,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING *
  `;

  const result = await pool.query(query, [
    monthly_fee,
    due_day,
    effective_from || null,
    is_active,
    status,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Actualizar una configuración de pago por field_id
 * @param {number} field_id - ID de la cancha
 * @param {Object} configData - Datos a actualizar
 * @returns {Promise<Object|null>} Configuración actualizada o null
 */
const updatePaymentConfigByFieldId = async (field_id, configData) => {
  const { monthly_fee, due_day, effective_from, is_active, status, user_id_modification } = configData;

  const query = `
    UPDATE payment_configs
    SET monthly_fee = COALESCE($1, monthly_fee),
        due_day = COALESCE($2, due_day),
        effective_from = COALESCE($3, effective_from),
        is_active = COALESCE($4, is_active),
        status = COALESCE($5, status),
        user_id_modification = $6,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE field_id = $7
    RETURNING *
  `;

  const result = await pool.query(query, [
    monthly_fee,
    due_day,
    effective_from || null,
    is_active,
    status,
    user_id_modification,
    field_id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar una configuración de pago
 * @param {number} id - ID de la configuración
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deletePaymentConfig = async id => {
  const query = `
    DELETE FROM payment_configs
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

module.exports = {
  getAllPaymentConfigs,
  getPaymentConfigById,
  getPaymentConfigByFieldId,
  createPaymentConfig,
  updatePaymentConfig,
  updatePaymentConfigByFieldId,
  deletePaymentConfig,
};
