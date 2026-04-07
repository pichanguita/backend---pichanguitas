const express = require('express');

const router = express.Router();
const {
  getRefunds,
  getRefund,
  createNewRefund,
  updateExistingRefund,
  processExistingRefund,
  rejectExistingRefund,
  deleteRefundById,
  getStats,
} = require('../controllers/refundsController');
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

// GET /api/refunds - Obtener todos los reembolsos (con filtros)
router.get('/', verificarToken, verificarRolesPermitidos, getRefunds);

// GET /api/refunds/stats - Obtener estadísticas
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/refunds/:id - Obtener un reembolso por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getRefund);

// POST /api/refunds - Crear un nuevo reembolso
router.post('/', verificarToken, verificarRolesPermitidos, createNewRefund);

// PUT /api/refunds/:id - Actualizar un reembolso
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingRefund);

// PUT /api/refunds/:id/process - Procesar un reembolso
router.put('/:id/process', verificarToken, verificarRolesPermitidos, processExistingRefund);

// PUT /api/refunds/:id/reject - Rechazar un reembolso
router.put('/:id/reject', verificarToken, verificarRolesPermitidos, rejectExistingRefund);

// DELETE /api/refunds/:id - Eliminar un reembolso
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteRefundById);

module.exports = router;
