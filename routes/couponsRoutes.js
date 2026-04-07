const express = require('express');

const router = express.Router();
const {
  getCoupons,
  getCoupon,
  createNewCoupon,
  updateExistingCoupon,
  deleteCouponById,
  validateCouponCode,
  getStats,
} = require('../controllers/couponsController');
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

// ==================== RUTAS PÚBLICAS (Sin autenticación) ====================

// POST /api/coupons/validate - Validar un cupón
// PÚBLICO: Permite validar cupones durante el proceso de reserva
// IMPORTANTE: Esta ruta debe ir ANTES de otras para evitar conflictos
router.post('/validate', validateCouponCode);

// ==================== RUTAS PROTEGIDAS (Requieren autenticación) ====================

// GET /api/coupons - Obtener todos los cupones (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getCoupons);

// GET /api/coupons/stats - Obtener estadísticas generales de cupones
// IMPORTANTE: Esta ruta debe ir ANTES de '/:id' para evitar conflictos
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/coupons/stats/:id - Obtener estadísticas de un cupón específico
router.get('/stats/:id', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/coupons/:id - Obtener un cupón por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getCoupon);

// POST /api/coupons - Crear un nuevo cupón
router.post('/', verificarToken, verificarRolesPermitidos, createNewCoupon);

// PUT /api/coupons/:id - Actualizar un cupón
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingCoupon);

// DELETE /api/coupons/:id - Eliminar un cupón (soft delete)
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteCouponById);

module.exports = router;
