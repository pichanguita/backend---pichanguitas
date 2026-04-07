/**
 * Controlador de Cancelación Pública
 *
 * Permite a los clientes cancelar sus reservas sin autenticación,
 * validando por número de teléfono + ID de reserva.
 *
 * Aplica las políticas de cancelación de cada cancha.
 */

const pool = require('../config/db');
const { getReservationById, cancelReservation } = require('../models/reservationsModel');
const {
  getCancellationPolicyByFieldId,
  validateCancellation,
} = require('../models/cancellationPoliciesModel');
const { createRefund, refundExistsForReservation } = require('../models/refundsModel');

/**
 * Cancelar reserva públicamente (sin autenticación)
 * Valida por teléfono del cliente y aplica política de cancelación
 *
 * @route PUT /api/public/reservations/:id/cancel
 */
const cancelReservationPublic = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { phone_number, cancellation_reason } = req.body;

    // Validación básica
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el número de teléfono para verificar la identidad',
      });
    }

    // Obtener la reserva
    const reservation = await getReservationById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada',
      });
    }

    // Verificar que el teléfono coincide con el cliente de la reserva
    const customerPhone = reservation.customer_phone || reservation.customerPhone;
    const normalizedInputPhone = phone_number.replace(/\D/g, '').slice(-9);
    const normalizedCustomerPhone = (customerPhone || '').replace(/\D/g, '').slice(-9);

    if (normalizedInputPhone !== normalizedCustomerPhone) {
      return res.status(403).json({
        success: false,
        error: 'El número de teléfono no coincide con el registrado en la reserva',
      });
    }

    // Obtener política de cancelación de la cancha
    const policy = await getCancellationPolicyByFieldId(reservation.field_id);

    // Validar si puede cancelar
    const validation = validateCancellation(reservation, policy);

    if (!validation.canCancel) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
        code: 'CANCELLATION_NOT_ALLOWED',
      });
    }

    // Iniciar transacción
    await client.query('BEGIN');

    // Calcular montos
    const advancePayment = parseFloat(reservation.advance_payment) || 0;
    const advanceKept = advancePayment - validation.refundAmount;
    const lostRevenue = parseFloat(reservation.total_price) || 0;

    // Cancelar la reserva
    const cancellationData = {
      cancelled_by: 'customer',
      cancellation_reason: cancellation_reason || 'Cancelada por el cliente',
      advance_kept: advanceKept,
      lost_revenue: lostRevenue,
      user_id_modification: 1, // Sistema
    };

    const cancelledReservation = await cancelReservation(id, cancellationData);

    // Si hay reembolso y no existe ya uno, crear registro de refund
    let refundCreated = null;
    if (validation.refundAmount > 0) {
      const refundExists = await refundExistsForReservation(parseInt(id));

      if (!refundExists) {
        refundCreated = await createRefund({
          reservation_id: parseInt(id),
          customer_id: reservation.customer_id,
          customer_name: reservation.customer_name || 'Cliente',
          phone_number: customerPhone,
          field_id: reservation.field_id,
          refund_amount: validation.refundAmount,
          status: 'pending',
          cancelled_at: new Date(),
          cancellation_reason: cancellation_reason || 'Cancelada por el cliente',
          user_id_registration: 1, // Sistema
        });

        console.log('📝 Refund creado automáticamente:', {
          refundId: refundCreated.id,
          reservationId: id,
          amount: validation.refundAmount,
        });
      }
    }

    // Restaurar horas gratis si se usaron
    if (reservation.free_hours_used > 0 && reservation.customer_id) {
      await client.query(
        `UPDATE customers
         SET available_free_hours = COALESCE(available_free_hours, 0) + $1,
             used_free_hours = COALESCE(used_free_hours, 0) - $1,
             date_time_modification = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [reservation.free_hours_used, reservation.customer_id]
      );
      console.log(
        `♻️ Restauradas ${reservation.free_hours_used} horas gratis al cliente ${reservation.customer_id}`
      );
    }

    await client.query('COMMIT');

    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Reserva cancelada exitosamente',
      data: {
        reservation: {
          id: cancelledReservation.id,
          status: 'cancelled',
          cancelled_at: cancelledReservation.cancelled_at,
        },
        refund: refundCreated
          ? {
              id: refundCreated.id,
              amount: validation.refundAmount,
              percentage: validation.refundPercentage,
              status: 'pending',
              message: `Se te reembolsará S/ ${validation.refundAmount.toFixed(2)} (${validation.refundPercentage}% del adelanto). El administrador procesará tu reembolso pronto.`,
            }
          : null,
        advanceKept: advanceKept,
        freeHoursRestored: reservation.free_hours_used || 0,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al cancelar reserva públicamente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cancelar la reserva. Por favor, intenta nuevamente.',
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener información de cancelación de una reserva (sin cancelar)
 * Permite al cliente ver si puede cancelar y el monto de reembolso
 *
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

    // Obtener la reserva
    const reservation = await getReservationById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada',
      });
    }

    // Verificar que el teléfono coincide
    const customerPhone = reservation.customer_phone || reservation.customerPhone;
    const normalizedInputPhone = phone_number.replace(/\D/g, '').slice(-9);
    const normalizedCustomerPhone = (customerPhone || '').replace(/\D/g, '').slice(-9);

    if (normalizedInputPhone !== normalizedCustomerPhone) {
      return res.status(403).json({
        success: false,
        error: 'El número de teléfono no coincide con el registrado en la reserva',
      });
    }

    // Obtener política de cancelación
    const policy = await getCancellationPolicyByFieldId(reservation.field_id);

    // Validar cancelación
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
