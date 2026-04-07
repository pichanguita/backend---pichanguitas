const pool = require('../config/db');

/**
 * Obtener todos los equipamientos con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de equipamientos
 */
const getAllFieldEquipment = async (filters = {}) => {
  let query = `
    SELECT
      fe.id,
      fe.field_id,
      fe.has_jersey_rental,
      fe.jersey_price,
      fe.has_ball_rental,
      fe.ball_rental_price,
      fe.has_scoreboard,
      fe.has_nets,
      fe.has_goals,
      fe.user_id_registration,
      fe.date_time_registration,
      fe.user_id_modification,
      fe.date_time_modification,
      f.name AS field_name
    FROM field_equipment fe
    LEFT JOIN fields f ON fe.field_id = f.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND fe.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Filtro por equipamiento específico
  if (filters.has_jersey_rental !== undefined) {
    query += ` AND fe.has_jersey_rental = $${paramCount}`;
    params.push(filters.has_jersey_rental);
    paramCount++;
  }

  if (filters.has_ball_rental !== undefined) {
    query += ` AND fe.has_ball_rental = $${paramCount}`;
    params.push(filters.has_ball_rental);
    paramCount++;
  }

  if (filters.has_scoreboard !== undefined) {
    query += ` AND fe.has_scoreboard = $${paramCount}`;
    params.push(filters.has_scoreboard);
    paramCount++;
  }

  query += ` ORDER BY fe.field_id ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener equipamiento por ID
 * @param {number} id - ID del equipamiento
 * @returns {Promise<Object|null>} Equipamiento o null
 */
const getFieldEquipmentById = async id => {
  const query = `
    SELECT
      fe.*,
      f.name AS field_name
    FROM field_equipment fe
    LEFT JOIN fields f ON fe.field_id = f.id
    WHERE fe.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener equipamiento de una cancha específica
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<Object|null>} Equipamiento o null
 */
const getEquipmentByFieldId = async field_id => {
  const query = `
    SELECT
      fe.*,
      f.name AS field_name
    FROM field_equipment fe
    LEFT JOIN fields f ON fe.field_id = f.id
    WHERE fe.field_id = $1
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Verificar si ya existe equipamiento para una cancha
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<boolean>} True si existe
 */
const equipmentExistsForField = async field_id => {
  const query = `SELECT id FROM field_equipment WHERE field_id = $1`;
  const result = await pool.query(query, [field_id]);
  return result.rows.length > 0;
};

/**
 * Crear un nuevo registro de equipamiento
 * @param {Object} equipmentData - Datos del equipamiento
 * @returns {Promise<Object>} Equipamiento creado
 */
const createFieldEquipment = async equipmentData => {
  const {
    field_id,
    has_jersey_rental,
    jersey_price,
    has_ball_rental,
    ball_rental_price,
    has_scoreboard,
    has_nets,
    has_goals,
    user_id_registration,
  } = equipmentData;

  const query = `
    INSERT INTO field_equipment (
      field_id,
      has_jersey_rental,
      jersey_price,
      has_ball_rental,
      ball_rental_price,
      has_scoreboard,
      has_nets,
      has_goals,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    field_id,
    has_jersey_rental || false,
    jersey_price || null,
    has_ball_rental || false,
    ball_rental_price || null,
    has_scoreboard || false,
    has_nets !== undefined ? has_nets : true,
    has_goals !== undefined ? has_goals : true,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar equipamiento
 * @param {number} id - ID del equipamiento
 * @param {Object} equipmentData - Datos a actualizar
 * @returns {Promise<Object|null>} Equipamiento actualizado o null
 */
const updateFieldEquipment = async (id, equipmentData) => {
  const {
    has_jersey_rental,
    jersey_price,
    has_ball_rental,
    ball_rental_price,
    has_scoreboard,
    has_nets,
    has_goals,
    user_id_modification,
  } = equipmentData;

  const query = `
    UPDATE field_equipment
    SET has_jersey_rental = COALESCE($1, has_jersey_rental),
        jersey_price = COALESCE($2, jersey_price),
        has_ball_rental = COALESCE($3, has_ball_rental),
        ball_rental_price = COALESCE($4, ball_rental_price),
        has_scoreboard = COALESCE($5, has_scoreboard),
        has_nets = COALESCE($6, has_nets),
        has_goals = COALESCE($7, has_goals),
        user_id_modification = $8,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *
  `;

  const result = await pool.query(query, [
    has_jersey_rental,
    jersey_price,
    has_ball_rental,
    ball_rental_price,
    has_scoreboard,
    has_nets,
    has_goals,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar equipamiento
 * @param {number} id - ID del equipamiento
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteFieldEquipment = async id => {
  const query = `
    DELETE FROM field_equipment
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Eliminar equipamiento por field_id
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteEquipmentByFieldId = async field_id => {
  const query = `
    DELETE FROM field_equipment
    WHERE field_id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows.length > 0;
};

module.exports = {
  getAllFieldEquipment,
  getFieldEquipmentById,
  getEquipmentByFieldId,
  equipmentExistsForField,
  createFieldEquipment,
  updateFieldEquipment,
  deleteFieldEquipment,
  deleteEquipmentByFieldId,
};
