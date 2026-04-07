const pool = require('../config/db');

/**
 * Obtener todos los videos con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de videos
 */
const getAllFieldVideos = async (filters = {}) => {
  let query = `
    SELECT
      fv.id,
      fv.field_id,
      fv.video_url,
      fv.title,
      fv.description,
      fv.user_id_registration,
      fv.date_time_registration,
      fv.user_id_modification,
      fv.date_time_modification,
      f.name AS field_name
    FROM field_videos fv
    LEFT JOIN fields f ON fv.field_id = f.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND fv.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Búsqueda por título
  if (filters.search) {
    query += ` AND fv.title ILIKE $${paramCount}`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` ORDER BY fv.field_id, fv.date_time_registration DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un video por ID
 * @param {number} id - ID del video
 * @returns {Promise<Object|null>} Video o null
 */
const getFieldVideoById = async id => {
  const query = `
    SELECT
      fv.*,
      f.name AS field_name
    FROM field_videos fv
    LEFT JOIN fields f ON fv.field_id = f.id
    WHERE fv.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener videos de una cancha específica
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<Array>} Lista de videos
 */
const getVideosByFieldId = async field_id => {
  const query = `
    SELECT
      id,
      field_id,
      video_url,
      title,
      description,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM field_videos
    WHERE field_id = $1
    ORDER BY date_time_registration DESC
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows;
};

/**
 * Crear un nuevo video
 * @param {Object} videoData - Datos del video
 * @returns {Promise<Object>} Video creado
 */
const createFieldVideo = async videoData => {
  const { field_id, video_url, title, description, user_id_registration } = videoData;

  const query = `
    INSERT INTO field_videos (
      field_id,
      video_url,
      title,
      description,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    field_id,
    video_url,
    title,
    description,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un video
 * @param {number} id - ID del video
 * @param {Object} videoData - Datos a actualizar
 * @returns {Promise<Object|null>} Video actualizado o null
 */
const updateFieldVideo = async (id, videoData) => {
  const { video_url, title, description, user_id_modification } = videoData;

  const query = `
    UPDATE field_videos
    SET video_url = COALESCE($1, video_url),
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        user_id_modification = $4,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `;

  const result = await pool.query(query, [video_url, title, description, user_id_modification, id]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar un video
 * @param {number} id - ID del video
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteFieldVideo = async id => {
  const query = `
    DELETE FROM field_videos
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Eliminar todos los videos de una cancha
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<number>} Cantidad de videos eliminados
 */
const deleteAllVideosByFieldId = async field_id => {
  const query = `
    DELETE FROM field_videos
    WHERE field_id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows.length;
};

module.exports = {
  getAllFieldVideos,
  getFieldVideoById,
  getVideosByFieldId,
  createFieldVideo,
  updateFieldVideo,
  deleteFieldVideo,
  deleteAllVideosByFieldId,
};
