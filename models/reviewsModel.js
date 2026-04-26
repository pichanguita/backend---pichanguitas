const pool = require('../config/db');
const { checkAndAssignBadges } = require('../services/badgeAssignmentService');

/**
 * Obtener todas las reseñas con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de reseñas
 */
const getAllReviews = async (filters = {}) => {
  let query = `
    SELECT
      r.id,
      r.reservation_id,
      r.field_id,
      r.customer_id,
      r.customer_name,
      r.cleanliness,
      r.service,
      r.facilities,
      r.overall_rating,
      r.comment,
      r.is_visible,
      r.status,
      r.user_id_registration,
      r.date_time_registration,
      f.name AS field_name,
      c.phone_number AS customer_phone
    FROM reviews r
    LEFT JOIN fields f ON r.field_id = f.id
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND r.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Filtro por cliente
  if (filters.customer_id) {
    query += ` AND r.customer_id = $${paramCount}`;
    params.push(filters.customer_id);
    paramCount++;
  }

  // Filtro por visibilidad
  if (filters.is_visible !== undefined) {
    query += ` AND r.is_visible = $${paramCount}`;
    params.push(filters.is_visible);
    paramCount++;
  }

  // Filtro por estado
  if (filters.status) {
    query += ` AND r.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  query += ` ORDER BY r.date_time_registration DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener una reseña por ID
 * @param {number} id - ID de la reseña
 * @returns {Promise<Object|null>} Reseña o null
 */
const getReviewById = async id => {
  const query = `
    SELECT
      r.id,
      r.reservation_id,
      r.field_id,
      r.customer_id,
      r.customer_name,
      r.cleanliness,
      r.service,
      r.facilities,
      r.overall_rating,
      r.comment,
      r.is_visible,
      r.status,
      r.user_id_registration,
      r.date_time_registration,
      r.user_id_modification,
      r.date_time_modification,
      f.name AS field_name,
      f.address AS field_address,
      c.phone_number AS customer_phone,
      c.email AS customer_email
    FROM reviews r
    LEFT JOIN fields f ON r.field_id = f.id
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE r.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener una reseña por ID de reserva
 * @param {number} reservationId - ID de la reserva
 * @returns {Promise<Object|null>} Reseña o null
 */
const getReviewByReservationId = async reservationId => {
  const query = `
    SELECT
      r.*,
      f.name AS field_name,
      c.phone_number AS customer_phone
    FROM reviews r
    LEFT JOIN fields f ON r.field_id = f.id
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE r.reservation_id = $1
  `;

  const result = await pool.query(query, [reservationId]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear una nueva reseña
 * @param {Object} reviewData - Datos de la reseña
 * @returns {Promise<Object>} Reseña creada
 */
const createReview = async reviewData => {
  const {
    reservation_id,
    field_id,
    customer_id,
    customer_name,
    cleanliness,
    service,
    facilities,
    overall_rating,
    comment,
    is_visible = true,
    status = 'active',
    user_id_registration,
  } = reviewData;

  const query = `
    INSERT INTO reviews (
      reservation_id,
      field_id,
      customer_id,
      customer_name,
      cleanliness,
      service,
      facilities,
      overall_rating,
      comment,
      is_visible,
      status,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    reservation_id,
    field_id,
    customer_id,
    customer_name,
    cleanliness,
    service,
    facilities,
    overall_rating,
    comment,
    is_visible,
    status,
    user_id_registration,
  ]);

  const newReview = result.rows[0];

  // Verificar y asignar insignias automáticamente (criterio total_reviews)
  if (customer_id && is_visible && status === 'active') {
    try {
      const newBadges = await checkAndAssignBadges(customer_id, user_id_registration || 1);
      if (newBadges.length > 0) {
        console.log(
          `🏆 ${newBadges.length} insignia(s) nueva(s) asignada(s) al cliente ${customer_id} tras reseña`
        );
      }
    } catch (badgeError) {
      console.error('Error asignando insignias tras reseña:', badgeError);
    }
  }

  return newReview;
};

/**
 * Actualizar una reseña
 * @param {number} id - ID de la reseña
 * @param {Object} reviewData - Datos a actualizar
 * @returns {Promise<Object|null>} Reseña actualizada o null
 */
const updateReview = async (id, reviewData) => {
  const {
    cleanliness,
    service,
    facilities,
    overall_rating,
    comment,
    is_visible,
    status,
    user_id_modification,
  } = reviewData;

  const query = `
    UPDATE reviews
    SET cleanliness = COALESCE($1, cleanliness),
        service = COALESCE($2, service),
        facilities = COALESCE($3, facilities),
        overall_rating = COALESCE($4, overall_rating),
        comment = COALESCE($5, comment),
        is_visible = COALESCE($6, is_visible),
        status = COALESCE($7, status),
        user_id_modification = $8,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *
  `;

  const result = await pool.query(query, [
    cleanliness,
    service,
    facilities,
    overall_rating,
    comment,
    is_visible,
    status,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Cambiar visibilidad de una reseña
 * @param {number} id - ID de la reseña
 * @param {boolean} isVisible - Nueva visibilidad
 * @param {number} user_id_modification - ID del usuario que modifica
 * @returns {Promise<Object|null>} Reseña actualizada o null
 */
const toggleReviewVisibility = async (id, isVisible, user_id_modification) => {
  const query = `
    UPDATE reviews
    SET is_visible = $1,
        user_id_modification = $2,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [isVisible, user_id_modification, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar (soft delete) una reseña
 * @param {number} id - ID de la reseña
 * @param {number} user_id_modification - ID del usuario que realiza la acción
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteReview = async (id, user_id_modification) => {
  const query = `
    UPDATE reviews
    SET status = 'inactive',
        is_visible = false,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0;
};

/**
 * Obtener estadísticas de reseñas de una cancha
 * @param {number} fieldId - ID de la cancha
 * @returns {Promise<Object>} Estadísticas
 */
const getFieldReviewStats = async fieldId => {
  const query = `
    SELECT
      COUNT(*) AS total_reviews,
      ROUND(AVG(overall_rating), 2) AS average_rating,
      ROUND(AVG(cleanliness), 2) AS average_cleanliness,
      ROUND(AVG(service), 2) AS average_service,
      ROUND(AVG(facilities), 2) AS average_facilities,
      COUNT(*) FILTER (WHERE overall_rating >= 4) AS positive_reviews,
      COUNT(*) FILTER (WHERE overall_rating < 3) AS negative_reviews
    FROM reviews
    WHERE field_id = $1
      AND is_visible = true
      AND status = 'active'
  `;

  const result = await pool.query(query, [fieldId]);
  return result.rows[0];
};

/**
 * Verificar si una reserva ya tiene reseña
 * @param {number} reservationId - ID de la reserva
 * @returns {Promise<boolean>} True si ya tiene reseña
 */
const reservationHasReview = async reservationId => {
  const query = `SELECT id FROM reviews WHERE reservation_id = $1`;
  const result = await pool.query(query, [reservationId]);
  return result.rows.length > 0;
};

module.exports = {
  getAllReviews,
  getReviewById,
  getReviewByReservationId,
  createReview,
  updateReview,
  toggleReviewVisibility,
  deleteReview,
  getFieldReviewStats,
  reservationHasReview,
};
