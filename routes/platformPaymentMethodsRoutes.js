const express = require('express');

const router = express.Router();
const {
  getAll,
  getOne,
  create,
  update,
  remove,
  toggle,
  reorder,
} = require('../controllers/platformPaymentMethodsController');
const verificarToken = require('../middleware/authMiddleware');

// Middleware para verificar rol super_admin (role_id = 1)
const verificarSuperAdmin = (req, res, next) => {
  if (req.user?.id_rol !== 1) {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado: Se requiere rol de super administrador',
    });
  }
  next();
};

// ============= RUTAS PÚBLICAS (para que admins vean donde pagar) =============

// GET /api/platform-payment-methods - Obtener métodos de pago activos (público para admins autenticados)
router.get('/', verificarToken, getAll);

// GET /api/platform-payment-methods/:id - Obtener un método de pago
router.get('/:id', verificarToken, getOne);

// ============= RUTAS PARA SUPER_ADMIN =============

// POST /api/platform-payment-methods - Crear método de pago
router.post('/', verificarToken, verificarSuperAdmin, create);

// PUT /api/platform-payment-methods/:id - Actualizar método de pago
router.put('/:id', verificarToken, verificarSuperAdmin, update);

// PATCH /api/platform-payment-methods/:id/toggle - Activar/Desactivar
router.patch('/:id/toggle', verificarToken, verificarSuperAdmin, toggle);

// POST /api/platform-payment-methods/reorder - Reordenar métodos
router.post('/reorder', verificarToken, verificarSuperAdmin, reorder);

// DELETE /api/platform-payment-methods/:id - Eliminar método de pago
router.delete('/:id', verificarToken, verificarSuperAdmin, remove);

module.exports = router;
