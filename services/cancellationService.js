const pool = require('../config/db');
const { getReservationById, cancelReservation } = require('../models/reservationsModel');
const {
  getCancellationPolicyByFieldId,
  validateCancellation,
} = require('../models/cancellationPoliciesModel');
const { createRefund, refundExistsForReservation } = require('../models/refundsModel');

/**
 * Cancela una reserva aplicando la política de cancelación del field.
 * Se usa tanto desde el flujo público (cliente) como desde el flujo admin.
 *
 * @param {Object} params
 * @param {number|string} params.reservationId  ID de la reserva a cancelar.
 * @param {'customer'|'admin'} params.cancelledBy  Quién cancela.
 * @param {string} [params.cancellationReason]   Motivo opcional.
 * @param {number} [params.userId]               ID del usuario que ejecuta (auditoría).
 * @returns {Promise<{
 *   reservation: Object,
 *   refund: Object|null,
 *   refundAmount: number,
 *   advanceKept: number,
 *   freeHoursRestored: number,
 *   policy: { refundPercentage:number }
 * }>}
 * @throws {Error} con `code` ('NOT_FOUND' | 'CANCELLATION_NOT_ALLOWED').
 */
async function cancelReservationWithPolicy({
  reservationId,
  cancelledBy,
  cancellationReason,
  userId,
}) {
  const reservation = await getReservationById(reservationId);
  if (!reservation) {
    const err = new Error('Reserva no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const policy = await getCancellationPolicyByFieldId(reservation.field_id);
  const validation = validateCancellation(reservation, policy);

  if (!validation.canCancel) {
    const err = new Error(validation.reason);
    err.code = 'CANCELLATION_NOT_ALLOWED';
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const advancePayment = parseFloat(reservation.advance_payment) || 0;
    const refundAmount = parseFloat(validation.refundAmount) || 0;
    const advanceKept = advancePayment - refundAmount;
    const lostRevenue = parseFloat(reservation.total_price) || 0;

    const cancelledReservation = await cancelReservation(reservationId, {
      cancelled_by: cancelledBy,
      cancellation_reason:
        cancellationReason ||
        (cancelledBy === 'admin' ? 'Cancelada por el administrador' : 'Cancelada por el cliente'),
      advance_kept: advanceKept,
      lost_revenue: lostRevenue,
      user_id_modification: userId || null,
    });

    let refundCreated = null;
    if (refundAmount > 0) {
      const exists = await refundExistsForReservation(parseInt(reservationId, 10));
      if (!exists) {
        refundCreated = await createRefund({
          reservation_id: parseInt(reservationId, 10),
          customer_id: reservation.customer_id,
          customer_name: reservation.customer_name || 'Cliente',
          phone_number: reservation.customer_phone || reservation.phone_number,
          field_id: reservation.field_id,
          refund_amount: refundAmount,
          status: 'pending',
          cancelled_at: new Date(),
          cancellation_reason: cancellationReason || null,
          user_id_registration: userId || null,
        });
      }
    }

    let freeHoursRestored = 0;
    if (reservation.free_hours_used > 0 && reservation.customer_id) {
      await client.query(
        `UPDATE customers
         SET available_free_hours = COALESCE(available_free_hours, 0) + $1,
             used_free_hours = COALESCE(used_free_hours, 0) - $1,
             date_time_modification = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [reservation.free_hours_used, reservation.customer_id]
      );
      freeHoursRestored = reservation.free_hours_used;
    }

    await client.query('COMMIT');

    return {
      reservation: cancelledReservation,
      refund: refundCreated,
      refundAmount,
      advanceKept,
      freeHoursRestored,
      policy: { refundPercentage: validation.refundPercentage },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { cancelReservationWithPolicy };
