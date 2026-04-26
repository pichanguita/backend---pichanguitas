const pool = require('../config/db');
const { weekDayOrderSql } = require('../utils/fieldSchedule');

/**
 * Obtener todos los horarios de canchas con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de horarios
 */
const getAllFieldSchedules = async (filters = {}) => {
  let query = `
    SELECT
      fs.id,
      fs.field_id,
      fs.day_of_week,
      fs.is_open,
      fs.open_time,
      fs.close_time,
      fs.user_id_registration,
      fs.date_time_registration,
      fs.user_id_modification,
      fs.date_time_modification,
      f.name AS field_name
    FROM field_schedules fs
    LEFT JOIN fields f ON fs.field_id = f.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND fs.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Filtro por día de la semana
  if (filters.day_of_week) {
    query += ` AND fs.day_of_week = $${paramCount}`;
    params.push(filters.day_of_week);
    paramCount++;
  }

  // Filtro por estado (abierto/cerrado)
  if (filters.is_open !== undefined) {
    query += ` AND fs.is_open = $${paramCount}`;
    params.push(filters.is_open);
    paramCount++;
  }

  query += ` ORDER BY fs.field_id, ${weekDayOrderSql('fs.day_of_week')}`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un horario por ID
 * @param {number} id - ID del horario
 * @returns {Promise<Object|null>} Horario o null
 */
const getFieldScheduleById = async id => {
  const query = `
    SELECT
      fs.*,
      f.name AS field_name
    FROM field_schedules fs
    LEFT JOIN fields f ON fs.field_id = f.id
    WHERE fs.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener horarios de una cancha específica
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<Array>} Lista de horarios por día
 */
const getSchedulesByFieldId = async field_id => {
  const query = `
    SELECT
      id,
      field_id,
      day_of_week,
      is_open,
      open_time,
      close_time,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM field_schedules
    WHERE field_id = $1
    ORDER BY ${weekDayOrderSql()}
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows;
};

/**
 * Crear un nuevo horario
 * @param {Object} scheduleData - Datos del horario
 * @returns {Promise<Object>} Horario creado
 */
const createFieldSchedule = async scheduleData => {
  const {
    field_id,
    day_of_week,
    is_open = true,
    open_time,
    close_time,
    user_id_registration,
  } = scheduleData;

  const query = `
    INSERT INTO field_schedules (
      field_id,
      day_of_week,
      is_open,
      open_time,
      close_time,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    field_id,
    day_of_week,
    is_open,
    open_time,
    close_time,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un horario
 * @param {number} id - ID del horario
 * @param {Object} scheduleData - Datos a actualizar
 * @returns {Promise<Object|null>} Horario actualizado o null
 */
const updateFieldSchedule = async (id, scheduleData) => {
  const { day_of_week, is_open, open_time, close_time, user_id_modification } = scheduleData;

  const query = `
    UPDATE field_schedules
    SET day_of_week = COALESCE($1, day_of_week),
        is_open = COALESCE($2, is_open),
        open_time = COALESCE($3, open_time),
        close_time = COALESCE($4, close_time),
        user_id_modification = $5,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `;

  const result = await pool.query(query, [
    day_of_week,
    is_open,
    open_time,
    close_time,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar un horario
 * @param {number} id - ID del horario
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteFieldSchedule = async id => {
  const query = `
    DELETE FROM field_schedules
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Verificar si ya existe un horario para una cancha en un día específico
 * @param {number} field_id - ID de la cancha
 * @param {string} day_of_week - Día de la semana
 * @param {number|null} excludeId - ID a excluir de la búsqueda
 * @returns {Promise<boolean>} True si existe
 */
const scheduleExistsForDay = async (field_id, day_of_week, excludeId = null) => {
  let query = `
    SELECT id FROM field_schedules
    WHERE field_id = $1 AND day_of_week = $2
  `;
  const params = [field_id, day_of_week];

  if (excludeId) {
    query += ` AND id != $3`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Crear horarios para toda la semana (batch)
 * @param {number} field_id - ID de la cancha
 * @param {Array} schedules - Array de horarios para cada día
 * @param {number} user_id_registration - ID del usuario
 * @returns {Promise<Array>} Horarios creados
 */
const createWeekSchedules = async (field_id, schedules, user_id_registration) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const createdSchedules = [];

    for (const schedule of schedules) {
      const query = `
        INSERT INTO field_schedules (
          field_id,
          day_of_week,
          is_open,
          open_time,
          close_time,
          user_id_registration,
          date_time_registration
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await client.query(query, [
        field_id,
        schedule.day_of_week,
        schedule.is_open !== undefined ? schedule.is_open : true,
        schedule.open_time,
        schedule.close_time,
        user_id_registration,
      ]);

      createdSchedules.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return createdSchedules;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllFieldSchedules,
  getFieldScheduleById,
  getSchedulesByFieldId,
  createFieldSchedule,
  updateFieldSchedule,
  deleteFieldSchedule,
  scheduleExistsForDay,
  createWeekSchedules,
};
