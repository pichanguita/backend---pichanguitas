const pool = require('../config/db');

/**
 * Obtener todos los programas de mantenimiento con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de programas de mantenimiento
 */
const getAllFieldMaintenanceSchedules = async (filters = {}) => {
  let query = `
    SELECT
      fms.id,
      fms.field_id,
      fms.start_date,
      fms.end_date,
      fms.start_time,
      fms.end_time,
      fms.reason,
      fms.is_recurring,
      fms.recurrence_pattern,
      fms.user_id_registration,
      fms.date_time_registration,
      fms.user_id_modification,
      fms.date_time_modification,
      f.name AS field_name
    FROM field_maintenance_schedules fms
    LEFT JOIN fields f ON fms.field_id = f.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND fms.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Filtro por mantenimientos activos (en curso o futuros)
  if (filters.active_only === 'true') {
    query += ` AND fms.end_date >= CURRENT_DATE`;
  }

  // Filtro por mantenimientos en curso
  if (filters.current_only === 'true') {
    query += ` AND fms.start_date <= CURRENT_DATE AND fms.end_date >= CURRENT_DATE`;
  }

  // Filtro por mantenimientos futuros
  if (filters.future_only === 'true') {
    query += ` AND fms.start_date > CURRENT_DATE`;
  }

  // Filtro por mantenimientos recurrentes
  if (filters.is_recurring !== undefined) {
    query += ` AND fms.is_recurring = $${paramCount}`;
    params.push(filters.is_recurring);
    paramCount++;
  }

  query += ` ORDER BY fms.start_date DESC, fms.start_time DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un programa de mantenimiento por ID
 * @param {number} id - ID del programa
 * @returns {Promise<Object|null>} Programa o null
 */
const getFieldMaintenanceScheduleById = async id => {
  const query = `
    SELECT
      fms.*,
      f.name AS field_name
    FROM field_maintenance_schedules fms
    LEFT JOIN fields f ON fms.field_id = f.id
    WHERE fms.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener programas de mantenimiento de una cancha específica
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<Array>} Lista de programas
 */
const getMaintenanceSchedulesByFieldId = async field_id => {
  const query = `
    SELECT
      id,
      field_id,
      start_date,
      end_date,
      start_time,
      end_time,
      reason,
      is_recurring,
      recurrence_pattern,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM field_maintenance_schedules
    WHERE field_id = $1
    ORDER BY start_date DESC, start_time DESC
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows;
};

/**
 * Crear un nuevo programa de mantenimiento
 * @param {Object} scheduleData - Datos del programa
 * @returns {Promise<Object>} Programa creado
 */
const createFieldMaintenanceSchedule = async scheduleData => {
  const {
    field_id,
    start_date,
    end_date,
    start_time,
    end_time,
    reason,
    is_recurring = false,
    recurrence_pattern,
    user_id_registration,
  } = scheduleData;

  const query = `
    INSERT INTO field_maintenance_schedules (
      field_id,
      start_date,
      end_date,
      start_time,
      end_time,
      reason,
      is_recurring,
      recurrence_pattern,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    field_id,
    start_date,
    end_date,
    start_time,
    end_time,
    reason,
    is_recurring,
    recurrence_pattern,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un programa de mantenimiento
 * @param {number} id - ID del programa
 * @param {Object} scheduleData - Datos a actualizar
 * @returns {Promise<Object|null>} Programa actualizado o null
 */
const updateFieldMaintenanceSchedule = async (id, scheduleData) => {
  const {
    start_date,
    end_date,
    start_time,
    end_time,
    reason,
    is_recurring,
    recurrence_pattern,
    user_id_modification,
  } = scheduleData;

  const query = `
    UPDATE field_maintenance_schedules
    SET start_date = COALESCE($1, start_date),
        end_date = COALESCE($2, end_date),
        start_time = COALESCE($3, start_time),
        end_time = COALESCE($4, end_time),
        reason = COALESCE($5, reason),
        is_recurring = COALESCE($6, is_recurring),
        recurrence_pattern = COALESCE($7, recurrence_pattern),
        user_id_modification = $8,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *
  `;

  const result = await pool.query(query, [
    start_date,
    end_date,
    start_time,
    end_time,
    reason,
    is_recurring,
    recurrence_pattern,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar un programa de mantenimiento
 * @param {number} id - ID del programa
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteFieldMaintenanceSchedule = async id => {
  const query = `
    DELETE FROM field_maintenance_schedules
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Verificar si hay conflictos de mantenimiento para una cancha en un rango de fechas
 * @param {number} field_id - ID de la cancha
 * @param {string} start_date - Fecha de inicio
 * @param {string} end_date - Fecha de fin
 * @param {number|null} excludeId - ID a excluir de la búsqueda
 * @returns {Promise<Array>} Lista de conflictos
 */
const checkMaintenanceConflicts = async (field_id, start_date, end_date, excludeId = null) => {
  let query = `
    SELECT * FROM field_maintenance_schedules
    WHERE field_id = $1
      AND (
        (start_date <= $3 AND end_date >= $2)
      )
  `;
  const params = [field_id, start_date, end_date];

  if (excludeId) {
    query += ` AND id != $4`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener programas de mantenimiento para una fecha específica
 * @param {number} field_id - ID de la cancha
 * @param {string} date - Fecha a verificar
 * @returns {Promise<Array>} Lista de programas activos en esa fecha
 */
const getMaintenanceForDate = async (field_id, date) => {
  const query = `
    SELECT * FROM field_maintenance_schedules
    WHERE field_id = $1
      AND start_date <= $2
      AND end_date >= $2
    ORDER BY start_time
  `;

  const result = await pool.query(query, [field_id, date]);
  return result.rows;
};

/**
 * Obtener estadísticas de mantenimiento
 * @param {number|null} field_id - ID de la cancha (opcional)
 * @returns {Promise<Object>} Estadísticas
 */
const getMaintenanceStats = async (field_id = null) => {
  let query = `
    SELECT
      COUNT(*) AS total_schedules,
      COUNT(*) FILTER (WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE) AS current_maintenance,
      COUNT(*) FILTER (WHERE start_date > CURRENT_DATE) AS future_maintenance,
      COUNT(*) FILTER (WHERE end_date < CURRENT_DATE) AS past_maintenance,
      COUNT(*) FILTER (WHERE is_recurring = true) AS recurring_schedules
    FROM field_maintenance_schedules
  `;

  const params = [];
  if (field_id) {
    query += ` WHERE field_id = $1`;
    params.push(field_id);
  }

  const result = await pool.query(query, params);
  return result.rows[0];
};

module.exports = {
  getAllFieldMaintenanceSchedules,
  getFieldMaintenanceScheduleById,
  getMaintenanceSchedulesByFieldId,
  createFieldMaintenanceSchedule,
  updateFieldMaintenanceSchedule,
  deleteFieldMaintenanceSchedule,
  checkMaintenanceConflicts,
  getMaintenanceForDate,
  getMaintenanceStats,
};
