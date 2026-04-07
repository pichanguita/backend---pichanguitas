const pool = require('../config/db');

/**
 * Obtener todos los pagos con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de pagos
 */
const getAllPayments = async (filters = {}) => {
  let query = `
    SELECT
      p.id,
      p.field_id,
      p.admin_id,
      p.month,
      p.due_date,
      p.amount,
      p.status,
      p.paid_date,
      p.payment_method,
      p.operation_number,
      p.notes,
      p.registered_by,
      p.user_id_registration,
      p.date_time_registration,
      p.user_id_modification,
      p.date_time_modification,
      f.name AS field_name,
      u.name AS admin_name,
      rb.name AS registered_by_name
    FROM payments p
    LEFT JOIN fields f ON p.field_id = f.id
    LEFT JOIN users u ON p.admin_id = u.id
    LEFT JOIN users rb ON p.registered_by = rb.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND p.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Filtro por administrador
  if (filters.admin_id) {
    query += ` AND p.admin_id = $${paramCount}`;
    params.push(filters.admin_id);
    paramCount++;
  }

  // Filtro por estado
  if (filters.status) {
    query += ` AND p.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por mes
  if (filters.month) {
    query += ` AND p.month = $${paramCount}`;
    params.push(filters.month);
    paramCount++;
  }

  // Filtro por año
  if (filters.year) {
    query += ` AND EXTRACT(YEAR FROM p.due_date) = $${paramCount}`;
    params.push(filters.year);
    paramCount++;
  }

  // Filtro por pagos vencidos
  if (filters.overdue === 'true') {
    query += ` AND p.status = 'pending' AND p.due_date < CURRENT_DATE`;
  }

  query += ` ORDER BY p.due_date DESC, p.date_time_registration DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un pago por ID
 * @param {number} id - ID del pago
 * @returns {Promise<Object|null>} Pago o null
 */
const getPaymentById = async id => {
  const query = `
    SELECT
      p.*,
      f.name AS field_name,
      u.name AS admin_name,
      rb.name AS registered_by_name
    FROM payments p
    LEFT JOIN fields f ON p.field_id = f.id
    LEFT JOIN users u ON p.admin_id = u.id
    LEFT JOIN users rb ON p.registered_by = rb.id
    WHERE p.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear un nuevo pago
 * @param {Object} paymentData - Datos del pago
 * @returns {Promise<Object>} Pago creado
 */
const createPayment = async paymentData => {
  const {
    field_id,
    admin_id,
    month,
    due_date,
    amount,
    status = 'pending',
    payment_method,
    operation_number,
    notes,
    registered_by,
    user_id_registration,
  } = paymentData;

  const query = `
    INSERT INTO payments (
      field_id,
      admin_id,
      month,
      due_date,
      amount,
      status,
      payment_method,
      operation_number,
      notes,
      registered_by,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    field_id,
    admin_id,
    month,
    due_date,
    amount,
    status,
    payment_method,
    operation_number,
    notes,
    registered_by,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un pago
 * @param {number} id - ID del pago
 * @param {Object} paymentData - Datos a actualizar
 * @returns {Promise<Object|null>} Pago actualizado o null
 */
const updatePayment = async (id, paymentData) => {
  const {
    field_id,
    admin_id,
    month,
    due_date,
    amount,
    status,
    payment_method,
    operation_number,
    notes,
    user_id_modification,
  } = paymentData;

  const query = `
    UPDATE payments
    SET field_id = COALESCE($1, field_id),
        admin_id = COALESCE($2, admin_id),
        month = COALESCE($3, month),
        due_date = COALESCE($4, due_date),
        amount = COALESCE($5, amount),
        status = COALESCE($6, status),
        payment_method = COALESCE($7, payment_method),
        operation_number = COALESCE($8, operation_number),
        notes = COALESCE($9, notes),
        user_id_modification = $10,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $11
    RETURNING *
  `;

  const result = await pool.query(query, [
    field_id,
    admin_id,
    month,
    due_date,
    amount,
    status,
    payment_method,
    operation_number,
    notes,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Marcar un pago como pagado
 * @param {number} id - ID del pago
 * @param {Object} paymentInfo - Información del pago
 * @returns {Promise<Object|null>} Pago actualizado o null
 */
const markAsPaid = async (id, paymentInfo) => {
  const { payment_method, operation_number, notes, user_id_modification } = paymentInfo;

  const query = `
    UPDATE payments
    SET status = 'paid',
        paid_date = CURRENT_TIMESTAMP,
        payment_method = COALESCE($1, payment_method),
        operation_number = COALESCE($2, operation_number),
        notes = COALESCE($3, notes),
        user_id_modification = $4,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `;

  const result = await pool.query(query, [
    payment_method,
    operation_number,
    notes,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Cancelar un pago
 * @param {number} id - ID del pago
 * @param {number} user_id_modification - ID del usuario
 * @returns {Promise<Object|null>} Pago actualizado o null
 */
const cancelPayment = async (id, user_id_modification) => {
  const query = `
    UPDATE payments
    SET status = 'cancelled',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar un pago
 * @param {number} id - ID del pago
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deletePayment = async id => {
  const query = `
    DELETE FROM payments
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Verificar si ya existe un pago para una cancha en un mes específico
 * @param {number} field_id - ID de la cancha
 * @param {string} month - Mes (YYYY-MM)
 * @param {number|null} excludeId - ID a excluir de la búsqueda
 * @returns {Promise<boolean>} True si existe
 */
const paymentExistsForMonth = async (field_id, month, excludeId = null) => {
  let query = `
    SELECT id FROM payments
    WHERE field_id = $1 AND month = $2
  `;
  const params = [field_id, month];

  if (excludeId) {
    query += ` AND id != $3`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Obtener estadísticas de pagos
 * @param {Object} filters - Filtros opcionales (field_id, admin_id, year)
 * @returns {Promise<Object>} Estadísticas
 */
const getPaymentStats = async (filters = {}) => {
  let query = `
    SELECT
      COUNT(*) AS total_payments,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_payments,
      COUNT(*) FILTER (WHERE status = 'paid') AS paid_payments,
      COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_payments,
      COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_payments,
      COUNT(*) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE) AS pending_overdue,
      COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS total_paid_amount,
      COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS total_pending_amount,
      COALESCE(SUM(amount) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE), 0) AS total_overdue_amount
    FROM payments
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  if (filters.field_id) {
    query += ` AND field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  if (filters.admin_id) {
    query += ` AND admin_id = $${paramCount}`;
    params.push(filters.admin_id);
    paramCount++;
  }

  if (filters.year) {
    query += ` AND EXTRACT(YEAR FROM due_date) = $${paramCount}`;
    params.push(filters.year);
    paramCount++;
  }

  const result = await pool.query(query, params);
  return result.rows[0];
};

/**
 * Actualizar pagos vencidos (cambiar status de pending a overdue)
 * @returns {Promise<number>} Cantidad de pagos actualizados
 */
const updateOverduePayments = async () => {
  const query = `
    UPDATE payments
    SET status = 'overdue',
        date_time_modification = CURRENT_TIMESTAMP
    WHERE status = 'pending' AND due_date < CURRENT_DATE
    RETURNING id
  `;

  const result = await pool.query(query);
  return result.rows.length;
};

module.exports = {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  markAsPaid,
  cancelPayment,
  deletePayment,
  paymentExistsForMonth,
  getPaymentStats,
  updateOverduePayments,
};
