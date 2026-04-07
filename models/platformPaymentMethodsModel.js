const pool = require('../config/db');

/**
 * Obtener todos los métodos de pago de la plataforma
 */
const getAllMethods = async (onlyActive = false) => {
  let query = `
    SELECT *
    FROM platform_payment_methods
    WHERE 1=1
  `;

  if (onlyActive) {
    query += ` AND is_active = true`;
  }

  query += ` ORDER BY order_index ASC, id ASC`;

  const result = await pool.query(query);
  return result.rows;
};

/**
 * Obtener un método de pago por ID
 */
const getMethodById = async id => {
  const result = await pool.query(`SELECT * FROM platform_payment_methods WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

/**
 * Crear un nuevo método de pago
 */
const createMethod = async (data, userId) => {
  const {
    method_type,
    name,
    bank_name,
    account_number,
    account_holder,
    cci_number,
    phone_number,
    qr_image_url,
    instructions,
    is_active = true,
    order_index = 0,
  } = data;

  const result = await pool.query(
    `
    INSERT INTO platform_payment_methods (
      method_type, name, bank_name, account_number, account_holder,
      cci_number, phone_number, qr_image_url, instructions,
      is_active, order_index,
      user_id_registration, date_time_registration
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
    RETURNING *
  `,
    [
      method_type,
      name,
      bank_name,
      account_number,
      account_holder,
      cci_number,
      phone_number,
      qr_image_url,
      instructions,
      is_active,
      order_index,
      userId,
    ]
  );

  return result.rows[0];
};

/**
 * Actualizar un método de pago
 */
const updateMethod = async (id, data, userId) => {
  const {
    method_type,
    name,
    bank_name,
    account_number,
    account_holder,
    cci_number,
    phone_number,
    qr_image_url,
    instructions,
    is_active,
    order_index,
  } = data;

  const result = await pool.query(
    `
    UPDATE platform_payment_methods SET
      method_type = COALESCE($1, method_type),
      name = COALESCE($2, name),
      bank_name = $3,
      account_number = $4,
      account_holder = $5,
      cci_number = $6,
      phone_number = $7,
      qr_image_url = $8,
      instructions = $9,
      is_active = COALESCE($10, is_active),
      order_index = COALESCE($11, order_index),
      user_id_modification = $12,
      date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $13
    RETURNING *
  `,
    [
      method_type,
      name,
      bank_name,
      account_number,
      account_holder,
      cci_number,
      phone_number,
      qr_image_url,
      instructions,
      is_active,
      order_index,
      userId,
      id,
    ]
  );

  return result.rows[0] || null;
};

/**
 * Eliminar un método de pago
 */
const deleteMethod = async id => {
  const result = await pool.query(
    `DELETE FROM platform_payment_methods WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Activar/Desactivar un método de pago
 */
const toggleMethodStatus = async (id, isActive, userId) => {
  const result = await pool.query(
    `
    UPDATE platform_payment_methods SET
      is_active = $1,
      user_id_modification = $2,
      date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `,
    [isActive, userId, id]
  );

  return result.rows[0] || null;
};

/**
 * Reordenar métodos de pago
 */
const reorderMethods = async (orderedIds, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `
        UPDATE platform_payment_methods SET
          order_index = $1,
          user_id_modification = $2,
          date_time_modification = CURRENT_TIMESTAMP
        WHERE id = $3
      `,
        [i, userId, orderedIds[i]]
      );
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

module.exports = {
  getAllMethods,
  getMethodById,
  createMethod,
  updateMethod,
  deleteMethod,
  toggleMethodStatus,
  reorderMethods,
};
