const {
  getAllReviews,
  getReviewById,
  createReview,
  updateReview,
  toggleReviewVisibility,
  deleteReview,
  getFieldReviewStats,
  reservationHasReview,
} = require('../models/reviewsModel');
const pool = require('../config/db');

/**
 * Obtener todas las reseñas con filtros
 */
const getReviews = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id ? parseInt(req.query.field_id) : null,
      customer_id: req.query.customer_id ? parseInt(req.query.customer_id) : null,
      is_visible:
        req.query.is_visible === 'true'
          ? true
          : req.query.is_visible === 'false'
            ? false
            : undefined,
      status: req.query.status,
    };

    const reviews = await getAllReviews(filters);

    res.json({
      success: true,
      data: reviews,
      count: reviews.length,
    });
  } catch (error) {
    console.error('Error al obtener reseñas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reseñas',
    });
  }
};

/**
 * Obtener una reseña por ID
 */
const getReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await getReviewById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Reseña no encontrada',
      });
    }

    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error('Error al obtener reseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reseña',
    });
  }
};

/**
 * Crear una nueva reseña
 */
const createNewReview = async (req, res) => {
  try {
    const {
      reservation_id,
      field_id,
      customer_id,
      customer_name,
      cleanliness,
      service,
      facilities,
      comment,
      is_visible,
      status,
    } = req.body;

    // Validaciones básicas
    if (!reservation_id || !field_id || !customer_id || !customer_name) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: reservation_id, field_id, customer_id, customer_name',
      });
    }

    if (!cleanliness || !service || !facilities) {
      return res.status(400).json({
        success: false,
        error: 'Todas las calificaciones son requeridas: cleanliness, service, facilities',
      });
    }

    // Validar que las calificaciones estén en el rango correcto (1-5)
    if (
      cleanliness < 1 ||
      cleanliness > 5 ||
      service < 1 ||
      service > 5 ||
      facilities < 1 ||
      facilities > 5
    ) {
      return res.status(400).json({
        success: false,
        error: 'Las calificaciones deben estar entre 1 y 5',
      });
    }

    // Verificar si la reserva ya tiene reseña
    const hasReview = await reservationHasReview(reservation_id);
    if (hasReview) {
      return res.status(409).json({
        success: false,
        error: 'Esta reserva ya tiene una reseña',
      });
    }

    // Calcular calificación general
    const overall_rating = ((cleanliness + service + facilities) / 3).toFixed(2);

    const reviewData = {
      reservation_id,
      field_id,
      customer_id,
      customer_name: customer_name.trim(),
      cleanliness,
      service,
      facilities,
      overall_rating: parseFloat(overall_rating),
      comment: comment?.trim(),
      is_visible,
      status,
      user_id_registration: req.user?.id || customer_id,
    };

    const newReview = await createReview(reviewData);

    // Actualizar la reserva para marcarla como reseñada
    await pool.query('UPDATE reservations SET reviewed = true, review_id = $1 WHERE id = $2', [
      newReview.id,
      reservation_id,
    ]);

    res.status(201).json({
      success: true,
      message: 'Reseña creada exitosamente',
      data: newReview,
    });
  } catch (error) {
    console.error('Error al crear reseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear reseña',
    });
  }
};

/**
 * Actualizar una reseña
 */
const updateExistingReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { cleanliness, service, facilities, comment, is_visible, status } = req.body;

    // Verificar si la reseña existe
    const existingReview = await getReviewById(id);
    if (!existingReview) {
      return res.status(404).json({
        success: false,
        error: 'Reseña no encontrada',
      });
    }

    // Validar calificaciones si se proporcionan
    if (cleanliness && (cleanliness < 1 || cleanliness > 5)) {
      return res.status(400).json({
        success: false,
        error: 'La calificación de limpieza debe estar entre 1 y 5',
      });
    }

    if (service && (service < 1 || service > 5)) {
      return res.status(400).json({
        success: false,
        error: 'La calificación de servicio debe estar entre 1 y 5',
      });
    }

    if (facilities && (facilities < 1 || facilities > 5)) {
      return res.status(400).json({
        success: false,
        error: 'La calificación de instalaciones debe estar entre 1 y 5',
      });
    }

    // Recalcular overall_rating si se actualizan las calificaciones
    let overall_rating = null;
    if (cleanliness || service || facilities) {
      const newCleanliness = cleanliness || existingReview.cleanliness;
      const newService = service || existingReview.service;
      const newFacilities = facilities || existingReview.facilities;
      overall_rating = parseFloat(((newCleanliness + newService + newFacilities) / 3).toFixed(2));
    }

    const reviewData = {
      cleanliness,
      service,
      facilities,
      overall_rating,
      comment: comment?.trim(),
      is_visible,
      status,
      user_id_modification: req.user?.id || 1,
    };

    const updatedReview = await updateReview(id, reviewData);

    res.json({
      success: true,
      message: 'Reseña actualizada exitosamente',
      data: updatedReview,
    });
  } catch (error) {
    console.error('Error al actualizar reseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar reseña',
    });
  }
};

/**
 * Cambiar visibilidad de una reseña
 */
const toggleVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_visible } = req.body;

    if (is_visible === undefined) {
      return res.status(400).json({
        success: false,
        error: 'El campo is_visible es requerido',
      });
    }

    // Verificar si la reseña existe
    const existingReview = await getReviewById(id);
    if (!existingReview) {
      return res.status(404).json({
        success: false,
        error: 'Reseña no encontrada',
      });
    }

    const user_id = req.user?.id || 1;
    const updatedReview = await toggleReviewVisibility(id, is_visible, user_id);

    res.json({
      success: true,
      message: `Reseña ${is_visible ? 'publicada' : 'ocultada'} exitosamente`,
      data: updatedReview,
    });
  } catch (error) {
    console.error('Error al cambiar visibilidad de reseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar visibilidad de reseña',
    });
  }
};

/**
 * Eliminar una reseña (soft delete)
 */
const deleteReviewById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la reseña existe
    const existingReview = await getReviewById(id);
    if (!existingReview) {
      return res.status(404).json({
        success: false,
        error: 'Reseña no encontrada',
      });
    }

    const user_id = req.user?.id || 1;
    const deleted = await deleteReview(id, user_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Reseña eliminada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar la reseña',
      });
    }
  } catch (error) {
    console.error('Error al eliminar reseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar reseña',
    });
  }
};

/**
 * Obtener estadísticas de reseñas de una cancha
 */
const getFieldStats = async (req, res) => {
  try {
    const { field_id } = req.params;

    const stats = await getFieldReviewStats(parseInt(field_id));

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de reseñas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de reseñas',
    });
  }
};

module.exports = {
  getReviews,
  getReview,
  createNewReview,
  updateExistingReview,
  toggleVisibility,
  deleteReviewById,
  getFieldStats,
};
