/**
 * Rutas Públicas
 *
 * Endpoints que no requieren autenticación.
 * Usados principalmente por clientes para:
 * - Consultar disponibilidad de canchas
 * - Consultar y cancelar reservas
 * - Verificar información de canchas
 */

const express = require('express');

const router = express.Router();
const {
  cancelReservationPublic,
  getCancellationInfo,
} = require('../controllers/publicCancellationController');
const { getFieldAvailability } = require('../controllers/publicAvailabilityController');

// ==================== DISPONIBILIDAD DE CANCHAS ====================

/**
 * GET /api/public/fields/:fieldId/availability
 * Obtener horarios ocupados de una cancha para una fecha específica
 * Query params: date (requerido, formato YYYY-MM-DD)
 *
 * Ejemplo: GET /api/public/fields/1/availability?date=2026-02-15
 *
 * Respuesta:
 * {
 *   success: true,
 *   data: {
 *     fieldId: 1,
 *     date: "2026-02-15",
 *     occupiedSlots: [
 *       { startTime: "10:00", endTime: "11:00" },
 *       { startTime: "14:00", endTime: "16:00" }
 *     ],
 *     totalOccupied: 2
 *   }
 * }
 */
router.get('/fields/:fieldId/availability', getFieldAvailability);

// ==================== CANCELACIÓN DE RESERVAS ====================

/**
 * GET /api/public/reservations/:id/cancellation-info
 * Obtener información sobre si una reserva puede ser cancelada
 * Query params: phone_number (requerido para verificar identidad)
 */
router.get('/reservations/:id/cancellation-info', getCancellationInfo);

/**
 * PUT /api/public/reservations/:id/cancel
 * Cancelar una reserva públicamente
 * Body: { phone_number, cancellation_reason }
 */
router.put('/reservations/:id/cancel', cancelReservationPublic);

module.exports = router;
