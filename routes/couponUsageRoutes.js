const express = require('express');

const router = express.Router();
const {
  getCouponUsages,
  getCouponUsage,
  getUsagesByCoupon,
  getUsagesByCustomer,
  recordUsage,
  deleteCouponUsageById,
  getStats,
} = require('../controllers/couponUsageController');
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

// GET /api/coupon-usage - Obtener todos los registros (con filtros)
router.get('/', verificarToken, verificarRolesPermitidos, getCouponUsages);

// GET /api/coupon-usage/stats - Obtener estadísticas
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/coupon-usage/coupon/:coupon_id - Obtener usos de un cupón
router.get('/coupon/:coupon_id', verificarToken, verificarRolesPermitidos, getUsagesByCoupon);

// GET /api/coupon-usage/customer/:customer_id - Obtener usos de un cliente
router.get('/customer/:customer_id', verificarToken, verificarRolesPermitidos, getUsagesByCustomer);

// GET /api/coupon-usage/:id - Obtener un registro por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getCouponUsage);

// POST /api/coupon-usage - Registrar uso de un cupón
router.post('/', verificarToken, verificarRolesPermitidos, recordUsage);

// DELETE /api/coupon-usage/:id - Eliminar un registro
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteCouponUsageById);

module.exports = router;
