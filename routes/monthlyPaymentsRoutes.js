const express = require('express');

const router = express.Router();
const {
  getAll,
  getHistory,
  pay,
  report,
  confirm,
  reject,
  remove,
  getStats,
  getOne,
  getMyStatus,
  generate,
} = require('../controllers/monthlyPaymentsController');
const verificarToken = require('../middleware/authMiddleware');
const { uploadMonthlyVoucher } = require('../middleware/uploadMiddleware');

// Todas las rutas requieren autenticación
router.use(verificarToken);

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

// Middleware para verificar rol admin o super_admin (role_id = 1 o 2)
const verificarAdmin = (req, res, next) => {
  if (![1, 2].includes(req.user?.id_rol)) {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado: Se requiere rol de administrador',
    });
  }
  next();
};

// ============= RUTAS PARA CUALQUIER ADMIN =============

// GET /api/monthly-payments/my-status - Estado de pago del admin logueado
router.get('/my-status', getMyStatus);

// GET /api/monthly-payments - Estado de cobros del mes (pendientes + pagados)
router.get('/', getAll);

// GET /api/monthly-payments/stats - Estadísticas del mes
router.get('/stats', getStats);

// GET /api/monthly-payments/history - Historial de pagos realizados
router.get('/history', getHistory);

// GET /api/monthly-payments/:id - Obtener un pago por ID
router.get('/:id', getOne);

// ============= RUTAS PARA ADMIN DE CANCHA =============

// POST /api/monthly-payments/report - Reportar un pago (admin de cancha)
router.post('/report', verificarAdmin, uploadMonthlyVoucher.single('voucher'), report);

// ============= RUTAS PARA SUPER_ADMIN =============

// POST /api/monthly-payments/generate - Generar pagos mensuales automáticamente (super_admin)
router.post('/generate', verificarSuperAdmin, generate);

// POST /api/monthly-payments/pay - Registrar un pago directamente (super_admin)
router.post('/pay', verificarSuperAdmin, pay);

// PUT /api/monthly-payments/:id/confirm - Confirmar un pago reportado (super_admin)
router.put('/:id/confirm', verificarSuperAdmin, confirm);

// PUT /api/monthly-payments/:id/reject - Rechazar un pago reportado (super_admin)
router.put('/:id/reject', verificarSuperAdmin, reject);

// DELETE /api/monthly-payments/:id - Eliminar pago (revertir a pendiente) (super_admin)
router.delete('/:id', verificarSuperAdmin, remove);

module.exports = router;
