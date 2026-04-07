const pool = require('../config/db');

/**
 * Obtener política de cancelación de una cancha
 * @param {number} fieldId - ID de la cancha
 * @returns {Promise<Object|null>} Política de cancelación o null
 */
const getCancellationPolicyByFieldId = async fieldId => {
  const query = `
    SELECT
      id,
      field_id,
      allow_cancellation,
      hours_before_event,
      refund_percentage,
      date_time_registration,
      date_time_modification
    FROM field_cancellation_policies
    WHERE field_id = $1
  `;

  const result = await pool.query(query, [fieldId]);

  if (result.rows.length === 0) {
    // Retornar política por defecto si no existe
    return {
      field_id: fieldId,
      allow_cancellation: true,
      hours_before_event: 24,
      refund_percentage: 100.0,
      is_default: true,
    };
  }

  return result.rows[0];
};

/**
 * Validar si una reserva puede ser cancelada según la política
 * @param {Object} reservation - Reserva a validar
 * @param {Object} policy - Política de cancelación
 * @returns {Object} { canCancel, reason, refundPercentage, refundAmount }
 */
const validateCancellation = (reservation, policy) => {
  // Verificar si la cancha permite cancelaciones
  if (!policy.allow_cancellation) {
    return {
      canCancel: false,
      reason: 'Esta cancha no permite cancelaciones',
      refundPercentage: 0,
      refundAmount: 0,
    };
  }

  // Verificar estado de la reserva
  if (reservation.status === 'cancelled') {
    return {
      canCancel: false,
      reason: 'La reserva ya está cancelada',
      refundPercentage: 0,
      refundAmount: 0,
    };
  }

  if (reservation.status === 'completed') {
    return {
      canCancel: false,
      reason: 'No se puede cancelar una reserva completada',
      refundPercentage: 0,
      refundAmount: 0,
    };
  }

  if (reservation.status === 'no_show') {
    return {
      canCancel: false,
      reason: 'No se puede cancelar una reserva marcada como no-show',
      refundPercentage: 0,
      refundAmount: 0,
    };
  }

  // Verificar si el pago ya fue aprobado/completado
  if (reservation.payment_status === 'fully_paid') {
    return {
      canCancel: false,
      reason:
        'El pago ya fue aprobado por el administrador. Contacta al administrador para solicitar cancelación.',
      refundPercentage: 0,
      refundAmount: 0,
    };
  }

  // Calcular tiempo hasta el evento
  const now = new Date();

  // Parsear la fecha correctamente en zona horaria local
  // new Date('YYYY-MM-DD') interpreta en UTC, lo cual causa bugs de timezone
  const dateParts = reservation.date.split('T')[0].split('-');
  const startTimeParts = (reservation.start_time || '00:00').split(':');

  const reservationDate = new Date(
    parseInt(dateParts[0], 10), // año
    parseInt(dateParts[1], 10) - 1, // mes (0-indexado)
    parseInt(dateParts[2], 10), // día
    parseInt(startTimeParts[0], 10) || 0, // hora
    parseInt(startTimeParts[1], 10) || 0, // minutos
    0, // segundos
    0 // milisegundos
  );

  const hoursUntilEvent = (reservationDate - now) / (1000 * 60 * 60);
  const hoursRequired = policy.hours_before_event || 24;

  if (hoursUntilEvent < 0) {
    return {
      canCancel: false,
      reason: 'No se puede cancelar una reserva cuya fecha ya pasó',
      refundPercentage: 0,
      refundAmount: 0,
    };
  }

  if (hoursUntilEvent < hoursRequired) {
    return {
      canCancel: false,
      reason: `Debes cancelar con al menos ${hoursRequired} horas de anticipación. Faltan ${hoursUntilEvent.toFixed(1)} horas.`,
      refundPercentage: 0,
      refundAmount: 0,
    };
  }

  // Calcular reembolso
  const advancePayment = parseFloat(reservation.advance_payment) || 0;
  const refundPercentage = parseFloat(policy.refund_percentage) || 0;
  const refundAmount = (advancePayment * refundPercentage) / 100;

  return {
    canCancel: true,
    reason: null,
    refundPercentage,
    refundAmount: Math.round(refundAmount * 100) / 100,
    hoursUntilEvent: Math.round(hoursUntilEvent * 10) / 10,
  };
};

/**
 * Crear o actualizar política de cancelación
 * @param {Object} policyData - Datos de la política
 * @returns {Promise<Object>} Política creada/actualizada
 */
const upsertCancellationPolicy = async policyData => {
  const {
    field_id,
    allow_cancellation = true,
    hours_before_event = 24,
    refund_percentage = 100.0,
    user_id_registration,
  } = policyData;

  // Verificar si ya existe
  const existing = await pool.query(
    'SELECT id FROM field_cancellation_policies WHERE field_id = $1',
    [field_id]
  );

  if (existing.rows.length > 0) {
    // Actualizar
    const updateQuery = `
      UPDATE field_cancellation_policies
      SET allow_cancellation = $1,
          hours_before_event = $2,
          refund_percentage = $3,
          user_id_modification = $4,
          date_time_modification = CURRENT_TIMESTAMP
      WHERE field_id = $5
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [
      allow_cancellation,
      hours_before_event,
      refund_percentage,
      user_id_registration,
      field_id,
    ]);
    return result.rows[0];
  } else {
    // Crear
    const insertQuery = `
      INSERT INTO field_cancellation_policies (
        field_id,
        allow_cancellation,
        hours_before_event,
        refund_percentage,
        user_id_registration,
        date_time_registration
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [
      field_id,
      allow_cancellation,
      hours_before_event,
      refund_percentage,
      user_id_registration,
    ]);
    return result.rows[0];
  }
};

module.exports = {
  getCancellationPolicyByFieldId,
  validateCancellation,
  upsertCancellationPolicy,
};
