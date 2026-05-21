/**
 * Controlador de Cancelación Pública
 *
 * Permite a los clientes cancelar sus reservas sin autenticación,
 * validando por número de teléfono + ID de reserva.
 *
 * Aplica las políticas de cancelación de cada cancha vía cancellationService.
 */

const { getReservationById } = require('../models/reservationsModel');
const {
  getCancellationPolicyByFieldId,
  validateCancellation,
} = require('../models/cancellationPoliciesModel');
const { cancelReservationWithPolicy } = require('../services/cancellationService');

const verifyPhoneOwnership = (reservation, phone_number) => {
  const customerPhone = reservation.customer_phone || reservation.customerPhone || '';
  const normalizedInputPhone = (phone_number || '').replace(/\D/g, '').slice(-9);
  const normalizedCustomerPhone = customerPhone.replace(/\D/g, '').slice(-9);
  return normalizedInputPhone === normalizedCustomerPhone;
};

/**
 * @route PUT /api/public/reservations/:id/cancel
 */
const cancelReservationPublic = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone_number, cancellation_reason } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el número de teléfono para verificar la identidad',
      });
    }

    const reservation = await getReservationById(id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada',
      });
    }

    if (!verifyPhoneOwnership(reservation, phone_number)) {
      return res.status(403).json({
        success: false,
        error: 'El número de teléfono no coincide con el registrado en la reserva',
      });
    }

    const result = await cancelReservationWithPolicy({
      reservationId: id,
      cancelledBy: 'customer',
      cancellationReason: cancellation_reason || 'Cancelada por el cliente',
      userId: null,
    });

    res.json({
      success: true,
      message: 'Reserva cancelada exitosamente',
      data: {
        reservation: {
          id: result.reservation.id,
          status: 'cancelled',
          cancelled_at: result.reservation.cancelled_at,
        },
        refund: result.refund
          ? {
              id: result.refund.id,
              amount: result.refundAmount,
              percentage: result.policy.refundPercentage,
              status: 'pending',
              message: `Se te reembolsará S/ ${result.refundAmount.toFixed(2)} (${result.policy.refundPercentage}% del adelanto). El administrador procesará tu reembolso pronto.`,
            }
          : null,
        advanceKept: result.advanceKept,
        freeHoursRestored: result.freeHoursRestored,
      },
    });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.code === 'CANCELLATION_NOT_ALLOWED') {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: 'CANCELLATION_NOT_ALLOWED',
      });
    }
    console.error('❌ Error al cancelar reserva públicamente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cancelar la reserva. Por favor, intenta nuevamente.',
    });
  }
};

/**
 * @route GET /api/public/reservations/:id/cancellation-info
 */
const getCancellationInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone_number } = req.query;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el número de teléfono para verificar la identidad',
      });
    }

    const reservation = await getReservationById(id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada',
      });
    }

    if (!verifyPhoneOwnership(reservation, phone_number)) {
      return res.status(403).json({
        success: false,
        error: 'El número de teléfono no coincide con el registrado en la reserva',
      });
    }

    const policy = await getCancellationPolicyByFieldId(reservation.field_id);
    const validation = validateCancellation(reservation, policy);

    res.json({
      success: true,
      data: {
        canCancel: validation.canCancel,
        reason: validation.reason,
        policy: {
          allowCancellation: policy.allow_cancellation,
          hoursBeforeEvent: policy.hours_before_event,
          refundPercentage: policy.refund_percentage,
        },
        refund: validation.canCancel
          ? {
              amount: validation.refundAmount,
              percentage: validation.refundPercentage,
            }
          : null,
        hoursUntilEvent: validation.hoursUntilEvent,
        reservation: {
          id: reservation.id,
          date: reservation.date,
          startTime: reservation.start_time,
          endTime: reservation.end_time,
          totalPrice: reservation.total_price,
          advancePayment: reservation.advance_payment,
          status: reservation.status,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error al obtener info de cancelación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener información de cancelación',
    });
  }
};

module.exports = {
  cancelReservationPublic,
  getCancellationInfo,
};
