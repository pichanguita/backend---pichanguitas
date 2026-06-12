/**
 * Controlador Público de Reseñas
 *
 * Expone reseñas visibles sin requerir autenticación, para que la landing y el
 * flujo de reserva del cliente puedan mostrarlas. Toda la lógica de filtrado
 * (solo visibles + activas) vive en el modelo, que es la fuente única.
 */

const {
  getPublicFieldReviews,
  getPublicFieldReviewsCount,
  getFeaturedReviews,
} = require('../models/reviewsModel');

// Límites técnicos de paginación. No son datos de negocio: acotan el tamaño de
// respuesta y evitan abusos del endpoint público.
const DEFAULT_FIELD_REVIEWS_LIMIT = 5;
const MAX_FIELD_REVIEWS_LIMIT = 50;
const DEFAULT_FEATURED_LIMIT = 6;
const MAX_FEATURED_LIMIT = 20;

const clampLimit = (raw, fallback, max) => {
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

/**
 * GET /api/public/fields/:fieldId/reviews
 * Reseñas visibles de una cancha, paginadas (las más recientes primero).
 */
const getFieldReviewsPublic = async (req, res) => {
  try {
    const fieldId = parseInt(req.params.fieldId, 10);
    if (Number.isNaN(fieldId)) {
      return res.status(400).json({
        success: false,
        error: 'El identificador de la cancha no es válido',
      });
    }

    const limit = clampLimit(req.query.limit, DEFAULT_FIELD_REVIEWS_LIMIT, MAX_FIELD_REVIEWS_LIMIT);
    const offsetRaw = parseInt(req.query.offset, 10);
    const offset = Number.isNaN(offsetRaw) || offsetRaw < 0 ? 0 : offsetRaw;

    const [reviews, total] = await Promise.all([
      getPublicFieldReviews(fieldId, limit, offset),
      getPublicFieldReviewsCount(fieldId),
    ]);

    res.json({
      success: true,
      data: reviews,
      total,
    });
  } catch (error) {
    console.error('Error al obtener reseñas públicas de la cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reseñas',
    });
  }
};

/**
 * GET /api/public/reviews/featured
 * Reseñas destacadas globales para la sección de la landing.
 */
const getFeaturedReviewsPublic = async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, DEFAULT_FEATURED_LIMIT, MAX_FEATURED_LIMIT);
    const reviews = await getFeaturedReviews(limit);

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    console.error('Error al obtener reseñas destacadas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reseñas destacadas',
    });
  }
};

module.exports = {
  getFieldReviewsPublic,
  getFeaturedReviewsPublic,
};
