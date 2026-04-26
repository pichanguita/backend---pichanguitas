/**
 * Constantes centralizadas para los estados de reserva y de pago.
 * Fuente única de verdad: cualquier comparación o asignación de status
 * debe usar estas constantes para evitar typos silenciosos.
 *
 * Mantener sincronizado con prisma/schema.prisma (model reservations) y con
 * frontend/src/constants/reservation.js.
 */

const RESERVATION_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
});

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PARTIALLY_PAID: 'partially_paid',
  FULLY_PAID: 'fully_paid',
  REFUNDED: 'refunded',
});

const PAYMENT_METHOD = Object.freeze({
  CASH: 'efectivo',
  CASH_ALT: 'cash',
  FREE_HOURS: 'free_hours',
});

/**
 * Estados de reserva que indican que el servicio NO se brindó (no cobrables).
 * Usado para excluir del saldo pendiente y de cómputos de "horas jugadas".
 */
const NON_BILLABLE_RESERVATION_STATUSES = Object.freeze([
  RESERVATION_STATUS.CANCELLED,
  RESERVATION_STATUS.NO_SHOW,
]);

const isCashPayment = method => method === PAYMENT_METHOD.CASH || method === PAYMENT_METHOD.CASH_ALT;

module.exports = {
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  NON_BILLABLE_RESERVATION_STATUSES,
  isCashPayment,
};
