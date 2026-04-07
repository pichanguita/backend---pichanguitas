const express = require('express');

const router = express.Router();
const {
  getReviews,
  getReview,
  createNewReview,
  updateExistingReview,
  toggleVisibility,
  deleteReviewById,
  getFieldStats,
} = require('../controllers/reviewsController');
// Importar middleware de autenticación
const verificarToken = require('../middleware/authMiddleware');

// Middleware para validar los roles permitidos
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2, 3].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// GET /api/reviews - Obtener todas las reseñas (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getReviews);

// GET /api/reviews/stats/:field_id - Obtener estadísticas de reseñas por cancha
router.get('/stats/:field_id', verificarToken, verificarRolesPermitidos, getFieldStats);

// GET /api/reviews/:id - Obtener una reseña por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getReview);

// POST /api/reviews - Crear una nueva reseña
router.post('/', verificarToken, verificarRolesPermitidos, createNewReview);

// PUT /api/reviews/:id - Actualizar una reseña
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingReview);

// PUT /api/reviews/:id/visibility - Cambiar visibilidad de una reseña
router.put('/:id/visibility', verificarToken, verificarRolesPermitidos, toggleVisibility);

// DELETE /api/reviews/:id - Eliminar una reseña (soft delete)
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteReviewById);

module.exports = router;
