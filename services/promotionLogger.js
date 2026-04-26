/**
 * Logger estructurado para el flujo de promociones / horas gratis.
 *
 * Todos los eventos relevantes (canje manual, canje automático, descuento al
 * crear reserva, refund al cancelar, errores) se emiten con un prefijo común
 * y un payload JSON consistente, facilitando filtrado en producción.
 *
 * Formato: [PROMO][evento] {json}
 */

const PROMO_PREFIX = '[PROMO]';

const emit = (event, payload) => {
  try {
    const safePayload = payload || {};
    console.log(`${PROMO_PREFIX}[${event}]`, JSON.stringify(safePayload));
  } catch {
    console.log(`${PROMO_PREFIX}[${event}] <unserializable payload>`);
  }
};

const emitError = (event, payload, err) => {
  const errMsg = err?.message || String(err || 'unknown_error');
  try {
    console.error(`${PROMO_PREFIX}[${event}][ERROR]`, JSON.stringify({ ...payload, error: errMsg }));
  } catch {
    console.error(`${PROMO_PREFIX}[${event}][ERROR]`, errMsg);
  }
};

const promotionLogger = {
  redemptionManual: ({ customerId, promotionRuleId, hoursEarned, userId }) =>
    emit('redemption_manual', { customerId, promotionRuleId, hoursEarned, userId }),

  redemptionAuto: ({ customerId, promotionRuleId, hoursEarned, triggerReservationId }) =>
    emit('redemption_auto', { customerId, promotionRuleId, hoursEarned, triggerReservationId }),

  freeHoursDiscount: ({ customerId, reservationId, requested, applied, available }) =>
    emit('free_hours_discount', { customerId, reservationId, requested, applied, available }),

  freeHoursRefund: ({ customerId, reservationId, restoredHours }) =>
    emit('free_hours_refund', { customerId, reservationId, restoredHours }),

  validationFailed: ({ customerId, reason, requested, available }) =>
    emit('validation_failed', { customerId, reason, requested, available }),

  error: (event, payload, err) => emitError(event, payload, err),
};

module.exports = promotionLogger;
