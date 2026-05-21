const pool = require('../config/db');

/**
 * Obtener todos los tutoriales (activos por defecto, ordenados).
 */
const getAllVideoTutorials = async (onlyActive = true) => {
  const result = await pool.query(
    `SELECT id, slug, title, description, video_url, sort_order, is_active
     FROM video_tutorials
     ${onlyActive ? 'WHERE is_active = TRUE' : ''}
     ORDER BY sort_order ASC, id ASC`
  );
  return result.rows;
};

/**
 * Obtener un tutorial por slug.
 */
const getVideoTutorialBySlug = async (slug) => {
  const result = await pool.query(
    `SELECT id, slug, title, description, video_url, sort_order, is_active
     FROM video_tutorials
     WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
};

/**
 * Actualizar título, descripción y/o URL de un tutorial por slug.
 * Solo aplica los campos enviados (no requiere todos).
 */
const updateVideoTutorialBySlug = async (slug, { title, description, video_url, user_id }) => {
  const result = await pool.query(
    `UPDATE video_tutorials
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         video_url = COALESCE($3, video_url),
         user_id_modification = $4,
         date_time_modification = CURRENT_TIMESTAMP
     WHERE slug = $5
     RETURNING id, slug, title, description, video_url, sort_order, is_active`,
    [title ?? null, description ?? null, video_url ?? null, user_id ?? null, slug]
  );
  return result.rows[0] || null;
};

module.exports = {
  getAllVideoTutorials,
  getVideoTutorialBySlug,
  updateVideoTutorialBySlug,
};
