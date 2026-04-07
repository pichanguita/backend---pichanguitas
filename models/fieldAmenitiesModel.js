const pool = require('../config/db');

/**
 * Obtener todas las amenidades con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de amenidades
 */
const getAllFieldAmenities = async (filters = {}) => {
  let query = `
    SELECT
      fa.id,
      fa.field_id,
      fa.amenity,
      fa.user_id_registration,
      fa.date_time_registration,
      fa.user_id_modification,
      fa.date_time_modification,
      f.name AS field_name
    FROM field_amenities fa
    LEFT JOIN fields f ON fa.field_id = f.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND fa.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Filtro por búsqueda de amenidad
  if (filters.search) {
    query += ` AND fa.amenity ILIKE $${paramCount}`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` ORDER BY fa.field_id, fa.amenity ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener una amenidad por ID
 * @param {number} id - ID de la amenidad
 * @returns {Promise<Object|null>} Amenidad o null
 */
const getFieldAmenityById = async id => {
  const query = `
    SELECT
      fa.*,
      f.name AS field_name
    FROM field_amenities fa
    LEFT JOIN fields f ON fa.field_id = f.id
    WHERE fa.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener amenidades de una cancha específica
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<Array>} Lista de amenidades
 */
const getAmenitiesByFieldId = async field_id => {
  const query = `
    SELECT
      id,
      field_id,
      amenity,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM field_amenities
    WHERE field_id = $1
    ORDER BY amenity ASC
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows;
};

/**
 * Crear una nueva amenidad
 * @param {Object} amenityData - Datos de la amenidad
 * @returns {Promise<Object>} Amenidad creada
 */
const createFieldAmenity = async amenityData => {
  const { field_id, amenity, user_id_registration } = amenityData;

  const query = `
    INSERT INTO field_amenities (
      field_id,
      amenity,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [field_id, amenity, user_id_registration]);

  return result.rows[0];
};

/**
 * Actualizar una amenidad
 * @param {number} id - ID de la amenidad
 * @param {Object} amenityData - Datos a actualizar
 * @returns {Promise<Object|null>} Amenidad actualizada o null
 */
const updateFieldAmenity = async (id, amenityData) => {
  const { amenity, user_id_modification } = amenityData;

  const query = `
    UPDATE field_amenities
    SET amenity = COALESCE($1, amenity),
        user_id_modification = $2,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [amenity, user_id_modification, id]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar una amenidad
 * @param {number} id - ID de la amenidad
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteFieldAmenity = async id => {
  const query = `
    DELETE FROM field_amenities
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Verificar si una amenidad ya existe para una cancha
 * @param {number} field_id - ID de la cancha
 * @param {string} amenity - Nombre de la amenidad
 * @param {number|null} excludeId - ID a excluir de la búsqueda
 * @returns {Promise<boolean>} True si existe
 */
const amenityExistsForField = async (field_id, amenity, excludeId = null) => {
  let query = `
    SELECT id FROM field_amenities
    WHERE field_id = $1 AND LOWER(amenity) = LOWER($2)
  `;
  const params = [field_id, amenity];

  if (excludeId) {
    query += ` AND id != $3`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Crear múltiples amenidades para una cancha (batch)
 * @param {number} field_id - ID de la cancha
 * @param {Array<string>} amenities - Array de nombres de amenidades
 * @param {number} user_id_registration - ID del usuario
 * @returns {Promise<Array>} Amenidades creadas
 */
const createMultipleAmenities = async (field_id, amenities, user_id_registration) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const createdAmenities = [];

    for (const amenity of amenities) {
      const query = `
        INSERT INTO field_amenities (
          field_id,
          amenity,
          user_id_registration,
          date_time_registration
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await client.query(query, [field_id, amenity, user_id_registration]);

      createdAmenities.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return createdAmenities;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Eliminar todas las amenidades de una cancha
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<number>} Cantidad de amenidades eliminadas
 */
const deleteAllAmenitiesByFieldId = async field_id => {
  const query = `
    DELETE FROM field_amenities
    WHERE field_id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows.length;
};

module.exports = {
  getAllFieldAmenities,
  getFieldAmenityById,
  getAmenitiesByFieldId,
  createFieldAmenity,
  updateFieldAmenity,
  deleteFieldAmenity,
  amenityExistsForField,
  createMultipleAmenities,
  deleteAllAmenitiesByFieldId,
};
