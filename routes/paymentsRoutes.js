const express = require('express');

const router = express.Router();
const {
  getPayments,
  getPayment,
  createNewPayment,
  updateExistingPayment,
  markPaymentAsPaid,
  cancelExistingPayment,
  deletePaymentById,
  getStats,
  updateOverdue,
} = require('../controllers/paymentsController');
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

// POST /api/payments - Crear un nuevo pago
// PÚBLICO: Permite crear pagos durante el proceso de reserva
router.post('/', createNewPayment);

// ==================== RUTAS PROTEGIDAS (Requieren autenticación) ====================

// GET /api/payments - Obtener todos los pagos (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getPayments);

// GET /api/payments/stats - Obtener estadísticas de pagos
// IMPORTANTE: Esta ruta debe ir ANTES de '/:id' para evitar conflictos
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// POST /api/payments/update-overdue - Actualizar pagos vencidos (CRON job)
router.post('/update-overdue', verificarToken, verificarRolesPermitidos, updateOverdue);

// GET /api/payments/:id - Obtener un pago por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getPayment);

// PUT /api/payments/:id - Actualizar un pago
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingPayment);

// PUT /api/payments/:id/mark-paid - Marcar un pago como pagado
router.put('/:id/mark-paid', verificarToken, verificarRolesPermitidos, markPaymentAsPaid);

// PUT /api/payments/:id/cancel - Cancelar un pago
router.put('/:id/cancel', verificarToken, verificarRolesPermitidos, cancelExistingPayment);

// DELETE /api/payments/:id - Eliminar un pago
router.delete('/:id', verificarToken, verificarRolesPermitidos, deletePaymentById);

module.exports = router;
