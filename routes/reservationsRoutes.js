const express = require('express');

const {
  getReservations,
  getReservation,
  createNewReservation,
  updateExistingReservation,
  cancelReservationById,
  completeReservationById,
  markReservationAsNoShow,
  checkFieldAvailability,
  getFieldStats,
  uploadPaymentVoucher,
  getMetrics,
} = require('../controllers/reservationsController');
const verificarToken = require('../middleware/authMiddleware');
const { verificarTokenOpcional } = require('../middleware/authMiddleware');
const { uploadReservationVoucher } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Middleware para validar los roles permitidos
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2, 3].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// ==================== RUTAS PUBLICAS (Sin autenticacion) ====================

// GET /api/reservations/check-availability - Verificar disponibilidad de una cancha
router.get('/check-availability', checkFieldAvailability);

// POST /api/reservations - Crear una nueva reserva
router.post('/', verificarTokenOpcional, createNewReservation);

// POST /api/reservations/upload-voucher - Subir voucher de pago
router.post('/upload-voucher', uploadReservationVoucher.single('voucher'), uploadPaymentVoucher);

// ==================== RUTAS PROTEGIDAS (Requieren autenticacion) ====================

router.get('/', verificarToken, verificarRolesPermitidos, getReservations);
router.get('/metrics', verificarToken, verificarRolesPermitidos, getMetrics);
router.get('/stats/:field_id', verificarToken, verificarRolesPermitidos, getFieldStats);
router.get('/:id', verificarToken, verificarRolesPermitidos, getReservation);
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingReservation);
router.put('/:id/cancel', verificarToken, verificarRolesPermitidos, cancelReservationById);
router.put('/:id/complete', verificarToken, verificarRolesPermitidos, completeReservationById);
router.put('/:id/no-show', verificarToken, verificarRolesPermitidos, markReservationAsNoShow);

module.exports = router;
