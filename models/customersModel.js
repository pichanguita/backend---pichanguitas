const pool = require('../config/db');

/**
 * Obtener todos los clientes con estadísticas
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de clientes
 */
const getAllCustomers = async (filters = {}) => {
  let query = `
    SELECT
      c.id,
      c.user_id,
      c.phone_number,
      c.name,
      c.email,
      c.created_by,
      c.total_reservations,
      c.total_hours,
      c.total_spent,
      c.earned_free_hours,
      c.used_free_hours,
      c.available_free_hours,
      c.last_reservation,
      c.is_vip,
      c.notes,
      c.status,
      c.user_id_registration,
      c.date_time_registration,
      c.user_id_modification,
      c.date_time_modification,
      u.username,
      u.name AS created_by_name
    FROM customers c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por estado
  if (filters.status) {
    query += ` AND c.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por VIP
  if (filters.is_vip !== undefined) {
    query += ` AND c.is_vip = $${paramCount}`;
    params.push(filters.is_vip);
    paramCount++;
  }

  // Búsqueda por nombre o teléfono
  if (filters.search) {
    query += ` AND (c.name ILIKE $${paramCount} OR c.phone_number ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` ORDER BY c.date_time_registration DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un cliente por ID
 * @param {number} id - ID del cliente
 * @returns {Promise<Object|null>} Cliente o null
 */
const getCustomerById = async id => {
  const query = `
    SELECT
      c.id,
      c.user_id,
      c.phone_number,
      c.name,
      c.email,
      c.created_by,
      c.total_reservations,
      c.total_hours,
      c.total_spent,
      c.earned_free_hours,
      c.used_free_hours,
      c.available_free_hours,
      c.last_reservation,
      c.is_vip,
      c.notes,
      c.status,
      c.user_id_registration,
      c.date_time_registration,
      c.user_id_modification,
      c.date_time_modification,
      u.username,
      u.name AS created_by_name
    FROM customers c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener un cliente por número de teléfono
 * @param {string} phoneNumber - Número de teléfono
 * @returns {Promise<Object|null>} Cliente o null
 */
const getCustomerByPhone = async phoneNumber => {
  const query = `
    SELECT
      c.id,
      c.user_id,
      c.phone_number,
      c.name,
      c.email,
      c.created_by,
      c.total_reservations,
      c.total_hours,
      c.total_spent,
      c.earned_free_hours,
      c.used_free_hours,
      c.available_free_hours,
      c.last_reservation,
      c.is_vip,
      c.notes,
      c.status,
      c.user_id_registration,
      c.date_time_registration,
      c.user_id_modification,
      c.date_time_modification
    FROM customers c
    WHERE c.phone_number = $1
  `;

  const result = await pool.query(query, [phoneNumber]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear un nuevo cliente
 * @param {Object} customerData - Datos del cliente
 * @returns {Promise<Object>} Cliente creado
 */
const createCustomer = async customerData => {
  const {
    user_id,
    phone_number,
    name,
    email,
    created_by,
    is_vip = false,
    notes,
    status = 'active',
    user_id_registration,
  } = customerData;

  const query = `
    INSERT INTO customers (
      user_id,
      phone_number,
      name,
      email,
      created_by,
      is_vip,
      notes,
      status,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    user_id,
    phone_number,
    name,
    email,
    created_by,
    is_vip,
    notes,
    status,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un cliente
 * @param {number} id - ID del cliente
 * @param {Object} customerData - Datos a actualizar
 * @returns {Promise<Object|null>} Cliente actualizado o null
 */
const updateCustomer = async (id, customerData) => {
  const { name, email, is_vip, notes, status, user_id_modification } = customerData;

  const query = `
    UPDATE customers
    SET name = COALESCE($1, name),
        email = COALESCE($2, email),
        is_vip = COALESCE($3, is_vip),
        notes = COALESCE($4, notes),
        status = COALESCE($5, status),
        user_id_modification = $6,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING *
  `;

  const result = await pool.query(query, [
    name,
    email,
    is_vip,
    notes,
    status,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Actualizar estadísticas de un cliente
 * @param {number} id - ID del cliente
 * @param {Object} stats - Estadísticas a actualizar
 * @returns {Promise<Object|null>} Cliente actualizado o null
 */
const updateCustomerStats = async (id, stats) => {
  const {
    total_reservations,
    total_hours,
    total_spent,
    earned_free_hours,
    used_free_hours,
    available_free_hours,
    last_reservation,
    user_id_modification,
  } = stats;

  const query = `
    UPDATE customers
    SET total_reservations = COALESCE($1, total_reservations),
        total_hours = COALESCE($2, total_hours),
        total_spent = COALESCE($3, total_spent),
        earned_free_hours = COALESCE($4, earned_free_hours),
        used_free_hours = COALESCE($5, used_free_hours),
        available_free_hours = COALESCE($6, available_free_hours),
        last_reservation = COALESCE($7, last_reservation),
        user_id_modification = $8,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *
  `;

  const result = await pool.query(query, [
    total_reservations,
    total_hours,
    total_spent,
    earned_free_hours,
    used_free_hours,
    available_free_hours,
    last_reservation,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar (soft delete) un cliente
 * @param {number} id - ID del cliente
 * @param {number} user_id_modification - ID del usuario que realiza la acción
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteCustomer = async (id, user_id_modification) => {
  const query = `
    UPDATE customers
    SET status = 'inactive',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0;
};

/**
 * Verificar si un número de teléfono ya existe
 * @param {string} phoneNumber - Número de teléfono
 * @param {number|null} excludeId - ID a excluir de la búsqueda (para updates)
 * @returns {Promise<boolean>} True si existe
 */
const phoneNumberExists = async (phoneNumber, excludeId = null) => {
  let query = `SELECT id FROM customers WHERE phone_number = $1`;
  const params = [phoneNumber];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Obtener clientes que han hecho reservas en las canchas de un admin
 * O que fueron creados directamente por el admin
 * @param {number} adminId - ID del administrador
 * @returns {Promise<Array>} Lista de clientes con estadísticas de reservas
 */
const getCustomersByFieldAdmin = async adminId => {
  const query = `
    SELECT DISTINCT
      c.id,
      c.user_id,
      c.phone_number,
      c.name,
      c.email,
      c.created_by,
      c.is_vip,
      c.notes,
      c.status,
      c.date_time_registration,
      -- Estadísticas calculadas de las reservas en las canchas del admin
      COUNT(r.id) FILTER (WHERE f.admin_id = $1 AND r.status != 'cancelled') as total_reservations,
      COALESCE(SUM(r.hours) FILTER (WHERE f.admin_id = $1 AND r.status != 'cancelled'), 0) as total_hours,
      COALESCE(SUM(r.total_price) FILTER (WHERE f.admin_id = $1 AND r.status != 'cancelled'), 0) as total_spent,
      MAX(r.date) FILTER (WHERE f.admin_id = $1 AND r.status != 'cancelled') as last_reservation,
      -- Estadísticas de promociones del cliente
      COALESCE(c.earned_free_hours, 0) as earned_free_hours,
      COALESCE(c.used_free_hours, 0) as used_free_hours,
      COALESCE(c.available_free_hours, 0) as available_free_hours
    FROM customers c
    LEFT JOIN reservations r ON c.id = r.customer_id
    LEFT JOIN fields f ON r.field_id = f.id
    WHERE c.status = 'active'
      AND (
        -- Clientes que han reservado en las canchas del admin
        EXISTS (
          SELECT 1 FROM reservations r2
          INNER JOIN fields f2 ON r2.field_id = f2.id
          WHERE r2.customer_id = c.id
            AND f2.admin_id = $1
            AND r2.status != 'cancelled'
        )
        -- O clientes creados directamente por el admin
        OR c.created_by = $1
      )
    GROUP BY c.id
    ORDER BY total_reservations DESC, c.name ASC
  `;

  const result = await pool.query(query, [adminId]);
  return result.rows;
};

/**
 * Obtener todos los clientes con estadísticas calculadas desde reservas
 * @returns {Promise<Array>} Lista de todos los clientes con estadísticas
 */
const getAllCustomersWithStats = async () => {
  const query = `
    SELECT DISTINCT
      c.id,
      c.user_id,
      c.phone_number,
      c.name,
      c.email,
      c.created_by,
      c.is_vip,
      c.notes,
      c.status,
      c.date_time_registration,
      -- Estadísticas calculadas de todas las reservas
      COUNT(r.id) as total_reservations,
      COALESCE(SUM(r.hours), 0) as total_hours,
      COALESCE(SUM(r.total_price), 0) as total_spent,
      MAX(r.date) as last_reservation,
      -- Estadísticas de promociones del cliente
      COALESCE(c.earned_free_hours, 0) as earned_free_hours,
      COALESCE(c.used_free_hours, 0) as used_free_hours,
      COALESCE(c.available_free_hours, 0) as available_free_hours
    FROM customers c
    LEFT JOIN reservations r ON c.id = r.customer_id AND r.status != 'cancelled'
    WHERE c.status = 'active'
    GROUP BY c.id
    ORDER BY total_reservations DESC, c.name ASC
  `;

  const result = await pool.query(query);
  return result.rows;
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  getCustomerByPhone,
  createCustomer,
  updateCustomer,
  updateCustomerStats,
  deleteCustomer,
  phoneNumberExists,
  getCustomersByFieldAdmin,
  getAllCustomersWithStats,
};
