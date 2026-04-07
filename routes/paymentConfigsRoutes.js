const express = require('express');

const {
  getPaymentConfigs,
  getPaymentConfig,
  getPaymentConfigByField,
  upsertPaymentConfig,
  updateExistingPaymentConfig,
  deletePaymentConfigById,
} = require('../controllers/paymentConfigsController');
const verificarToken = require('../middleware/authMiddleware');

const router = express.Router();

// Middleware para validar los roles permitidos (solo super admin)
const verificarSuperAdmin = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Solo Super Admin' });
  }
  next();
};

// Middleware para SuperAdmin o Admin (puede ver sus propias configuraciones)
const verificarAdminOSuperAdmin = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado' });
  }
  next();
};

// ==================== RUTAS PROTEGIDAS ====================

// GET /api/payment-configs - Obtener configuraciones (SuperAdmin ve todas, Admin ve las suyas)
router.get('/', verificarToken, verificarAdminOSuperAdmin, getPaymentConfigs);

// GET /api/payment-configs/field/:fieldId - Obtener configuración por field_id
router.get('/field/:fieldId', verificarToken, verificarAdminOSuperAdmin, getPaymentConfigByField);

// GET /api/payment-configs/:id - Obtener configuración por ID
router.get('/:id', verificarToken, verificarAdminOSuperAdmin, getPaymentConfig);

// POST /api/payment-configs - Crear o actualizar configuración (upsert)
router.post('/', verificarToken, verificarSuperAdmin, upsertPaymentConfig);

// PUT /api/payment-configs/:id - Actualizar configuración existente
router.put('/:id', verificarToken, verificarSuperAdmin, updateExistingPaymentConfig);

// DELETE /api/payment-configs/:id - Eliminar configuración
router.delete('/:id', verificarToken, verificarSuperAdmin, deletePaymentConfigById);

module.exports = router;
