const pool = require('../config/db');

/**
 * Obtener todas las reglas de canchas con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de reglas
 */
const getAllFieldRules = async (filters = {}) => {
  let query = `
    SELECT
      fr.id,
      fr.field_id,
      fr.rule,
      fr.user_id_registration,
      fr.date_time_registration,
      fr.user_id_modification,
      fr.date_time_modification,
      f.name AS field_name
    FROM field_rules fr
    LEFT JOIN fields f ON fr.field_id = f.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND fr.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Búsqueda por contenido de la regla
  if (filters.search) {
    query += ` AND fr.rule ILIKE $${paramCount}`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` ORDER BY fr.field_id, fr.id ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener una regla por ID
 * @param {number} id - ID de la regla
 * @returns {Promise<Object|null>} Regla o null
 */
const getFieldRuleById = async id => {
  const query = `
    SELECT
      fr.*,
      f.name AS field_name
    FROM field_rules fr
    LEFT JOIN fields f ON fr.field_id = f.id
    WHERE fr.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener reglas de una cancha específica
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<Array>} Lista de reglas
 */
const getRulesByFieldId = async field_id => {
  const query = `
    SELECT
      id,
      field_id,
      rule,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM field_rules
    WHERE field_id = $1
    ORDER BY id ASC
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows;
};

/**
 * Crear una nueva regla
 * @param {Object} ruleData - Datos de la regla
 * @returns {Promise<Object>} Regla creada
 */
const createFieldRule = async ruleData => {
  const { field_id, rule, user_id_registration } = ruleData;

  const query = `
    INSERT INTO field_rules (
      field_id,
      rule,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [field_id, rule, user_id_registration]);

  return result.rows[0];
};

/**
 * Actualizar una regla
 * @param {number} id - ID de la regla
 * @param {Object} ruleData - Datos a actualizar
 * @returns {Promise<Object|null>} Regla actualizada o null
 */
const updateFieldRule = async (id, ruleData) => {
  const { rule, user_id_modification } = ruleData;

  const query = `
    UPDATE field_rules
    SET rule = COALESCE($1, rule),
        user_id_modification = $2,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [rule, user_id_modification, id]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar una regla
 * @param {number} id - ID de la regla
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteFieldRule = async id => {
  const query = `
    DELETE FROM field_rules
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Crear múltiples reglas para una cancha (batch)
 * @param {number} field_id - ID de la cancha
 * @param {Array<string>} rules - Array de reglas
 * @param {number} user_id_registration - ID del usuario
 * @returns {Promise<Array>} Reglas creadas
 */
const createMultipleRules = async (field_id, rules, user_id_registration) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const createdRules = [];

    for (const rule of rules) {
      const query = `
        INSERT INTO field_rules (
          field_id,
          rule,
          user_id_registration,
          date_time_registration
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await client.query(query, [field_id, rule, user_id_registration]);

      createdRules.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return createdRules;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Eliminar todas las reglas de una cancha
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<number>} Cantidad de reglas eliminadas
 */
const deleteAllRulesByFieldId = async field_id => {
  const query = `
    DELETE FROM field_rules
    WHERE field_id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows.length;
};

module.exports = {
  getAllFieldRules,
  getFieldRuleById,
  getRulesByFieldId,
  createFieldRule,
  updateFieldRule,
  deleteFieldRule,
  createMultipleRules,
  deleteAllRulesByFieldId,
};
