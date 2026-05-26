const pool = require('../config/db');

/**
 * Obtener todos los tipos de deportes
 * @param {boolean} onlyActive - Si es true, solo devuelve deportes activos
 * @returns {Promise<Array>} Lista de tipos de deportes
 */
const getAllSportTypes = async (onlyActive = false) => {
  let query = `
    SELECT
      id,
      name,
      icon,
      color,
      description,
      is_active,
      status,
      display_order,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM sport_types
  `;

  if (onlyActive) {
    query += ` WHERE is_active = true AND status = 'active'`;
  }

  // El orden lo define el superadministrador (display_order). Los deportes sin
  // orden asignado se ubican al final, con el nombre como criterio de desempate.
  query += ` ORDER BY display_order ASC NULLS LAST, name ASC`;

  const result = await pool.query(query);
  return result.rows;
};

/**
 * Obtener un tipo de deporte por ID
 * @param {number} id - ID del tipo de deporte
 * @returns {Promise<Object|null>} Tipo de deporte o null
 */
const getSportTypeById = async id => {
  const query = `
    SELECT
      id,
      name,
      icon,
      color,
      description,
      is_active,
      status,
      display_order,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM sport_types
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear un nuevo tipo de deporte
 * @param {Object} sportTypeData - Datos del tipo de deporte
 * @returns {Promise<Object>} Tipo de deporte creado
 */
const createSportType = async sportTypeData => {
  const {
    name,
    icon,
    color,
    description,
    is_active = true,
    status = 'active',
    user_id_registration,
  } = sportTypeData;

  // Los deportes nuevos se ubican al final del orden actual (MAX(display_order)+1).
  const query = `
    INSERT INTO sport_types (
      name,
      icon,
      color,
      description,
      is_active,
      status,
      display_order,
      user_id_registration,
      date_time_registration
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sport_types),
      $7, CURRENT_TIMESTAMP
    )
    RETURNING *
  `;

  const result = await pool.query(query, [
    name,
    icon,
    color,
    description,
    is_active,
    status,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un tipo de deporte
 * @param {number} id - ID del tipo de deporte
 * @param {Object} sportTypeData - Datos a actualizar
 * @returns {Promise<Object|null>} Tipo de deporte actualizado o null
 */
const updateSportType = async (id, sportTypeData) => {
  const { name, icon, color, description, is_active, status, user_id_modification } = sportTypeData;

  const query = `
    UPDATE sport_types
    SET name = COALESCE($1, name),
        icon = COALESCE($2, icon),
        color = COALESCE($3, color),
        description = COALESCE($4, description),
        is_active = COALESCE($5, is_active),
        status = COALESCE($6, status),
        user_id_modification = $7,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $8
    RETURNING *
  `;

  const result = await pool.query(query, [
    name,
    icon,
    color,
    description,
    is_active,
    status,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar (soft delete) un tipo de deporte
 * @param {number} id - ID del tipo de deporte
 * @param {number} user_id_modification - ID del usuario que realiza la acción
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteSportType = async (id, user_id_modification) => {
  const query = `
    UPDATE sport_types
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
 * Reordenar los tipos de deportes.
 * Asigna display_order según la posición de cada ID en el arreglo recibido
 * (posición 0 -> display_order 1, etc.). Se ejecuta en una transacción para
 * garantizar consistencia del orden completo.
 * @param {Array<number>} orderedIds - IDs en el nuevo orden deseado
 * @param {number} user_id_modification - ID del usuario que realiza la acción
 * @returns {Promise<boolean>} True si se reordenó correctamente
 */
const reorderSportTypes = async (orderedIds, user_id_modification) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let index = 0; index < orderedIds.length; index += 1) {
      await client.query(
        `UPDATE sport_types
         SET display_order = $1,
             user_id_modification = $2,
             date_time_modification = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [index + 1, user_id_modification, orderedIds[index]]
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

/**
 * Contar canchas únicas asociadas a un tipo de deporte.
 * Considera ambas fuentes de vínculo: fields.sport_type y field_sports.sport_id.
 * Excluye canchas lógicamente eliminadas (status='deleted').
 * @param {number} sportTypeId - ID del tipo de deporte
 * @returns {Promise<number>} Cantidad de canchas
 */
const countFieldsBySportType = async sportTypeId => {
  const query = `
    SELECT COUNT(DISTINCT f.id)::int AS count
    FROM fields f
    LEFT JOIN field_sports fs ON fs.field_id = f.id
    WHERE (f.sport_type = $1 OR fs.sport_id = $1)
      AND f.status != 'deleted'
  `;

  const result = await pool.query(query, [sportTypeId]);
  return result.rows[0]?.count || 0;
};

/**
 * Verificar si un nombre de deporte ya existe entre los deportes ACTIVOS.
 * Las filas soft-deleted (status='inactive') no se consideran, alineado con
 * el índice parcial sport_types_active_name_uk a nivel BD.
 * @param {string} name - Nombre del deporte
 * @param {number|null} excludeId - ID a excluir de la búsqueda (para updates)
 * @returns {Promise<boolean>} True si existe un activo con ese nombre
 */
const sportTypeNameExists = async (name, excludeId = null) => {
  let query = `SELECT id FROM sport_types WHERE LOWER(name) = LOWER($1) AND status = 'active'`;
  const params = [name];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

module.exports = {
  getAllSportTypes,
  getSportTypeById,
  createSportType,
  updateSportType,
  deleteSportType,
  reorderSportTypes,
  countFieldsBySportType,
  sportTypeNameExists,
};
