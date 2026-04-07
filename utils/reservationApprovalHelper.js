/**
 * Helper para Aprobación Segura de Reservas
 *
 * Este módulo proporciona funciones utilitarias para manejar la aprobación
 * de reservas de manera segura, incluyendo validaciones, bloqueo optimista,
 * y auditoría.
 *
 * @module reservationApprovalHelper
 */

const { getReservationById, updateReservation } = require('../models/reservationsModel');
const { getFieldById } = require('../models/fieldsModel');

/**
 * Validar que un admin tenga permiso para aprobar una reserva
 * @param {number} reservationId - ID de la reserva
 * @param {number} adminId - ID del administrador
 * @param {string} adminRole - Rol del administrador ('admin' o 'super_admin')
 * @returns {Promise<{valid: boolean, error?: string, reservation?: Object}>}
 */
const validateApprovalPermission = async (reservationId, adminId, adminRole) => {
  // Obtener la reserva
  const reservation = await getReservationById(reservationId);

  if (!reservation) {
    return {
      valid: false,
      error: 'Reserva no encontrada',
    };
  }

  // Super admins pueden aprobar cualquier reserva
  if (adminRole === 'super_admin') {
    return {
      valid: true,
      reservation,
    };
  }

  // Admins de cancha solo pueden aprobar reservas de SUS canchas
  if (adminRole === 'admin') {
    const field = await getFieldById(reservation.field_id);

    if (!field) {
      return {
        valid: false,
        error: 'Cancha no encontrada',
      };
    }

    if (field.admin_id !== adminId) {
      return {
        valid: false,
        error: 'No autorizado - No puedes aprobar reservas de otras canchas',
      };
    }

    return {
      valid: true,
      reservation,
    };
  }

  return {
    valid: false,
    error: 'Rol no autorizado para aprobar reservas',
  };
};

/**
 * Validar que una reserva pueda ser aprobada (estado correcto)
 * @param {Object} reservation - Objeto de reserva
 * @returns {{valid: boolean, error?: string}}
 */
const validateApprovalState = reservation => {
  const currentStatus = reservation.status;

  // Solo se pueden aprobar reservas en estado 'pending'
  if (currentStatus !== 'pending') {
    return {
      valid: false,
      error: `No se puede aprobar una reserva en estado '${currentStatus}'. Solo se pueden aprobar reservas 'pending'.`,
    };
  }

  // Verificar que no esté ya aprobada
  if (reservation.approved_by || reservation.approved_at) {
    return {
      valid: false,
      error: 'Esta reserva ya fue aprobada anteriormente',
    };
  }

  return { valid: true };
};

/**
 * Aprobar una reserva de manera segura
 * @param {number} reservationId - ID de la reserva
 * @param {number} adminId - ID del administrador que aprueba
 * @param {string} adminRole - Rol del administrador
 * @param {Object} options - Opciones de aprobación
 * @param {boolean} options.paymentReceived - Si el pago fue recibido
 * @param {string} options.expectedStatus - Estado esperado (para bloqueo optimista)
 * @returns {Promise<{success: boolean, error?: string, data?: Object}>}
 */
const approveReservationSafely = async (reservationId, adminId, adminRole, options = {}) => {
  const { paymentReceived = false, expectedStatus = 'pending' } = options;

  try {
    // 1. Validar permisos
    const permissionCheck = await validateApprovalPermission(reservationId, adminId, adminRole);
    if (!permissionCheck.valid) {
      return {
        success: false,
        error: permissionCheck.error,
      };
    }

    const reservation = permissionCheck.reservation;

    // 2. Validar estado
    const stateCheck = validateApprovalState(reservation);
    if (!stateCheck.valid) {
      return {
        success: false,
        error: stateCheck.error,
      };
    }

    // 3. Preparar datos de actualización
    const updateData = {
      status: 'confirmed',
      approved_by: adminId,
      approved_at: new Date(),
      expected_status: expectedStatus,
      user_id_modification: adminId,
    };

    // 4. Actualizar payment_status solo si se confirma pago
    if (paymentReceived) {
      updateData.payment_status = 'partially_paid';
    }

    // 5. Ejecutar actualización con bloqueo optimista
    const updatedReservation = await updateReservation(reservationId, updateData);

    if (!updatedReservation) {
      return {
        success: false,
        error: 'No se pudo actualizar la reserva',
      };
    }

    return {
      success: true,
      data: updatedReservation,
    };
  } catch (error) {
    // Manejo específico de errores conocidos
    if (error.message?.includes('CONCURRENT_MODIFICATION')) {
      return {
        success: false,
        error: 'Otra persona modificó esta reserva. Por favor, recarga e intenta nuevamente.',
        code: 'CONCURRENT_MODIFICATION',
      };
    }

    if (error.message?.includes('INVALID_STATE_TRANSITION')) {
      return {
        success: false,
        error: error.message.replace('INVALID_STATE_TRANSITION: ', ''),
        code: 'INVALID_STATE',
      };
    }

    // Error genérico
    console.error('Error en approveReservationSafely:', error);
    return {
      success: false,
      error: 'Error al aprobar la reserva',
    };
  }
};

/**
 * Rechazar una reserva de manera segura
 * @param {number} reservationId - ID de la reserva
 * @param {number} adminId - ID del administrador que rechaza
 * @param {string} adminRole - Rol del administrador
 * @param {string} reason - Motivo del rechazo
 * @returns {Promise<{success: boolean, error?: string, data?: Object}>}
 */
const rejectReservationSafely = async (reservationId, adminId, adminRole, reason = '') => {
  try {
    // 1. Validar permisos
    const permissionCheck = await validateApprovalPermission(reservationId, adminId, adminRole);
    if (!permissionCheck.valid) {
      return {
        success: false,
        error: permissionCheck.error,
      };
    }

    const reservation = permissionCheck.reservation;

    // 2. Validar que esté en estado pending
    if (reservation.status !== 'pending') {
      return {
        success: false,
        error: `No se puede rechazar una reserva en estado '${reservation.status}'.`,
      };
    }

    // 3. Preparar datos de actualización
    const updateData = {
      status: 'rejected',
      rejected_by: adminId,
      rejected_at: new Date(),
      cancellation_reason: reason,
      expected_status: 'pending',
      user_id_modification: adminId,
    };

    // 4. Ejecutar actualización
    const updatedReservation = await updateReservation(reservationId, updateData);

    if (!updatedReservation) {
      return {
        success: false,
        error: 'No se pudo actualizar la reserva',
      };
    }

    return {
      success: true,
      data: updatedReservation,
    };
  } catch (error) {
    console.error('Error en rejectReservationSafely:', error);
    return {
      success: false,
      error: 'Error al rechazar la reserva',
    };
  }
};

/**
 * Confirmar que un pago fue recibido
 * @param {number} reservationId - ID de la reserva
 * @param {number} adminId - ID del administrador
 * @param {string} paymentStatus - Estado del pago ('partially_paid' o 'fully_paid')
 * @returns {Promise<{success: boolean, error?: string, data?: Object}>}
 */
const confirmPaymentReceived = async (reservationId, adminId, paymentStatus = 'partially_paid') => {
  try {
    // Validar paymentStatus
    const validStatuses = ['partially_paid', 'fully_paid'];
    if (!validStatuses.includes(paymentStatus)) {
      return {
        success: false,
        error: `Estado de pago inválido: ${paymentStatus}. Debe ser 'partially_paid' o 'fully_paid'.`,
      };
    }

    // Obtener reserva
    const reservation = await getReservationById(reservationId);
    if (!reservation) {
      return {
        success: false,
        error: 'Reserva no encontrada',
      };
    }

    // Solo se puede confirmar pago de reservas confirmadas
    if (reservation.status !== 'confirmed' && reservation.status !== 'completed') {
      return {
        success: false,
        error: 'Solo se puede confirmar pago de reservas confirmadas o completadas',
      };
    }

    // Actualizar payment_status
    const updateData = {
      payment_status: paymentStatus,
      user_id_modification: adminId,
    };

    const updatedReservation = await updateReservation(reservationId, updateData);

    return {
      success: true,
      data: updatedReservation,
    };
  } catch (error) {
    console.error('Error en confirmPaymentReceived:', error);
    return {
      success: false,
      error: 'Error al confirmar el pago',
    };
  }
};

/**
 * Obtener estadísticas de aprobación de un admin
 * @param {number} adminId - ID del administrador
 * @returns {Promise<Object>} Estadísticas de aprobación
 */
const getAdminApprovalStats = async adminId => {
  const pool = require('../config/db');

  const query = `
    SELECT
      COUNT(*) as total_approved,
      COUNT(*) FILTER (WHERE DATE(approved_at) = CURRENT_DATE) as approved_today,
      AVG(EXTRACT(EPOCH FROM (approved_at - date_time_registration))/60) as avg_approval_minutes,
      MIN(approved_at) as first_approval,
      MAX(approved_at) as last_approval
    FROM reservations
    WHERE approved_by = $1
  `;

  const result = await pool.query(query, [adminId]);
  return result.rows[0];
};

module.exports = {
  validateApprovalPermission,
  validateApprovalState,
  approveReservationSafely,
  rejectReservationSafely,
  confirmPaymentReceived,
  getAdminApprovalStats,
};
