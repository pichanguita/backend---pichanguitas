const pool = require('../config/db');

/**
 * Obtener todas las imágenes con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de imágenes
 */
const getAllFieldImages = async (filters = {}) => {
  let query = `
    SELECT
      fi.id,
      fi.field_id,
      fi.image_url,
      fi.category,
      fi.is_primary,
      fi.order_index,
      fi.user_id_registration,
      fi.date_time_registration,
      fi.user_id_modification,
      fi.date_time_modification,
      f.name AS field_name
    FROM field_images fi
    LEFT JOIN fields f ON fi.field_id = f.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND fi.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Filtro por categoría
  if (filters.category) {
    query += ` AND fi.category = $${paramCount}`;
    params.push(filters.category);
    paramCount++;
  }

  // Filtro por imagen principal
  if (filters.is_primary !== undefined) {
    query += ` AND fi.is_primary = $${paramCount}`;
    params.push(filters.is_primary);
    paramCount++;
  }

  query += ` ORDER BY fi.field_id, fi.is_primary DESC, fi.order_index ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener una imagen por ID
 * @param {number} id - ID de la imagen
 * @returns {Promise<Object|null>} Imagen o null
 */
const getFieldImageById = async id => {
  const query = `
    SELECT
      fi.*,
      f.name AS field_name
    FROM field_images fi
    LEFT JOIN fields f ON fi.field_id = f.id
    WHERE fi.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener imágenes de una cancha específica
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<Array>} Lista de imágenes
 */
const getImagesByFieldId = async field_id => {
  const query = `
    SELECT
      id,
      field_id,
      image_url,
      category,
      is_primary,
      order_index,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM field_images
    WHERE field_id = $1
    ORDER BY is_primary DESC, order_index ASC
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows;
};

/**
 * Obtener la imagen principal de una cancha
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<Object|null>} Imagen principal o null
 */
const getPrimaryImageByFieldId = async field_id => {
  const query = `
    SELECT * FROM field_images
    WHERE field_id = $1 AND is_primary = true
    LIMIT 1
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear una nueva imagen
 * @param {Object} imageData - Datos de la imagen
 * @returns {Promise<Object>} Imagen creada
 */
const createFieldImage = async imageData => {
  const {
    field_id,
    image_url,
    category,
    is_primary = false,
    order_index = 0,
    user_id_registration,
  } = imageData;

  // Si la nueva imagen es principal, primero quitar el flag de la anterior
  if (is_primary) {
    await pool.query(
      'UPDATE field_images SET is_primary = false WHERE field_id = $1 AND is_primary = true',
      [field_id]
    );
  }

  const query = `
    INSERT INTO field_images (
      field_id,
      image_url,
      category,
      is_primary,
      order_index,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    field_id,
    image_url,
    category,
    is_primary,
    order_index,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar una imagen
 * @param {number} id - ID de la imagen
 * @param {Object} imageData - Datos a actualizar
 * @returns {Promise<Object|null>} Imagen actualizada o null
 */
const updateFieldImage = async (id, imageData) => {
  const { image_url, category, is_primary, order_index, user_id_modification } = imageData;

  // Obtener la imagen actual para conocer el field_id
  const currentImage = await getFieldImageById(id);
  if (!currentImage) {
    return null;
  }

  // Si se marca como principal, quitar el flag de las demás
  if (is_primary === true) {
    await pool.query(
      'UPDATE field_images SET is_primary = false WHERE field_id = $1 AND id != $2 AND is_primary = true',
      [currentImage.field_id, id]
    );
  }

  const query = `
    UPDATE field_images
    SET image_url = COALESCE($1, image_url),
        category = COALESCE($2, category),
        is_primary = COALESCE($3, is_primary),
        order_index = COALESCE($4, order_index),
        user_id_modification = $5,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `;

  const result = await pool.query(query, [
    image_url,
    category,
    is_primary,
    order_index,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Marcar una imagen como principal
 * @param {number} id - ID de la imagen
 * @param {number} user_id_modification - ID del usuario
 * @returns {Promise<Object|null>} Imagen actualizada o null
 */
const setPrimaryImage = async (id, user_id_modification) => {
  // Obtener la imagen
  const image = await getFieldImageById(id);
  if (!image) {
    return null;
  }

  // Quitar el flag de la imagen principal actual
  await pool.query(
    'UPDATE field_images SET is_primary = false WHERE field_id = $1 AND is_primary = true',
    [image.field_id]
  );

  // Marcar esta imagen como principal
  const query = `
    UPDATE field_images
    SET is_primary = true,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar una imagen
 * @param {number} id - ID de la imagen
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteFieldImage = async id => {
  const query = `
    DELETE FROM field_images
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Eliminar todas las imágenes de una cancha
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<number>} Cantidad de imágenes eliminadas
 */
const deleteAllImagesByFieldId = async field_id => {
  const query = `
    DELETE FROM field_images
    WHERE field_id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows.length;
};

/**
 * Reordenar imágenes de una cancha
 * @param {Array} imageOrders - Array de {id, order_index}
 * @param {number} user_id_modification - ID del usuario
 * @returns {Promise<boolean>} True si se actualizó correctamente
 */
const reorderImages = async (imageOrders, user_id_modification) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of imageOrders) {
      await client.query(
        `UPDATE field_images
         SET order_index = $1,
             user_id_modification = $2,
             date_time_modification = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [item.order_index, user_id_modification, item.id]
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
  getAllFieldImages,
  getFieldImageById,
  getImagesByFieldId,
  getPrimaryImageByFieldId,
  createFieldImage,
  updateFieldImage,
  setPrimaryImage,
  deleteFieldImage,
  deleteAllImagesByFieldId,
  reorderImages,
};
