const {
  getAllRefunds,
  getRefundById,
  createRefund,
  updateRefund,
  processRefund,
  rejectRefund,
  deleteRefund,
  refundExistsForReservation,
  getRefundStats,
} = require('../models/refundsModel');

/**
 * Obtener todos los reembolsos con filtros
 */
const getRefunds = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      customer_id: req.query.customer_id,
      field_id: req.query.field_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      pending_only: req.query.pending_only,
    };

    const refunds = await getAllRefunds(filters);

    res.json({
      success: true,
      data: refunds,
      count: refunds.length,
    });
  } catch (error) {
    console.error('Error al obtener reembolsos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reembolsos',
    });
  }
};

/**
 * Obtener un reembolso por ID
 */
const getRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const refund = await getRefundById(id);

    if (!refund) {
      return res.status(404).json({
        success: false,
        error: 'Reembolso no encontrado',
      });
    }

    res.json({
      success: true,
      data: refund,
    });
  } catch (error) {
    console.error('Error al obtener reembolso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reembolso',
    });
  }
};

/**
 * Crear un nuevo reembolso
 */
const createNewRefund = async (req, res) => {
  try {
    const {
      reservation_id,
      customer_id,
      customer_name,
      phone_number,
      field_id,
      refund_amount,
      status,
      cancelled_at,
      cancellation_reason,
    } = req.body;

    // Validaciones básicas
    if (!reservation_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la reserva es requerido',
      });
    }

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID del cliente es requerido',
      });
    }

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre del cliente es requerido',
      });
    }

    if (!phone_number || !phone_number.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El teléfono es requerido',
      });
    }

    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!refund_amount || refund_amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto del reembolso debe ser mayor a 0',
      });
    }

    if (!cancelled_at) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de cancelación es requerida',
      });
    }

    // Verificar si ya existe un reembolso para esta reserva
    const exists = await refundExistsForReservation(reservation_id);
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un reembolso para esta reserva',
      });
    }

    const refundData = {
      reservation_id,
      customer_id,
      customer_name: customer_name.trim(),
      phone_number: phone_number.trim(),
      field_id,
      refund_amount,
      status,
      cancelled_at,
      cancellation_reason: cancellation_reason?.trim(),
      user_id_registration: req.user?.id || 1,
    };

    const newRefund = await createRefund(refundData);

    res.status(201).json({
      success: true,
      message: 'Reembolso creado exitosamente',
      data: newRefund,
    });
  } catch (error) {
    console.error('Error al crear reembolso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear reembolso',
    });
  }
};

/**
 * Actualizar un reembolso
 */
const updateExistingRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { refund_amount, status, cancellation_reason } = req.body;

    // Verificar si el reembolso existe
    const existingRefund = await getRefundById(id);
    if (!existingRefund) {
      return res.status(404).json({
        success: false,
        error: 'Reembolso no encontrado',
      });
    }

    // No se puede actualizar un reembolso ya procesado o rechazado
    if (existingRefund.status === 'processed' || existingRefund.status === 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'No se puede actualizar un reembolso ya procesado o rechazado',
      });
    }

    if (refund_amount !== undefined && refund_amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto del reembolso debe ser mayor a 0',
      });
    }

    const refundData = {
      refund_amount,
      status,
      cancellation_reason: cancellation_reason?.trim(),
      user_id_modification: req.user?.id || 1,
    };

    const updatedRefund = await updateRefund(id, refundData);

    res.json({
      success: true,
      message: 'Reembolso actualizado exitosamente',
      data: updatedRefund,
    });
  } catch (error) {
    console.error('Error al actualizar reembolso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar reembolso',
    });
  }
};

/**
 * Procesar un reembolso
 */
const processExistingRefund = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📝 Procesando reembolso ID:', id);

    // Verificar si el reembolso existe
    const existingRefund = await getRefundById(id);
    console.log('📝 Reembolso encontrado:', existingRefund ? 'Sí' : 'No');

    if (!existingRefund) {
      return res.status(404).json({
        success: false,
        error: 'Reembolso no encontrado',
      });
    }

    console.log('📝 Estado actual:', existingRefund.status);

    // Verificar que esté pendiente
    if (existingRefund.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden procesar reembolsos pendientes',
      });
    }

    const processed_by = req.user?.id || 1;
    console.log('📝 Procesado por usuario:', processed_by);

    const processedRefund = await processRefund(id, processed_by);
    console.log('✅ Reembolso procesado exitosamente');

    res.json({
      success: true,
      message: 'Reembolso procesado exitosamente',
      data: processedRefund,
    });
  } catch (error) {
    console.error('❌ Error al procesar reembolso:', error.message);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Error al procesar reembolso',
      details: error.message,
    });
  }
};

/**
 * Rechazar un reembolso
 */
const rejectExistingRefund = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el reembolso existe
    const existingRefund = await getRefundById(id);
    if (!existingRefund) {
      return res.status(404).json({
        success: false,
        error: 'Reembolso no encontrado',
      });
    }

    // Verificar que esté pendiente
    if (existingRefund.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden rechazar reembolsos pendientes',
      });
    }

    const processed_by = req.user?.id || 1;
    const rejectedRefund = await rejectRefund(id, processed_by);

    res.json({
      success: true,
      message: 'Reembolso rechazado exitosamente',
      data: rejectedRefund,
    });
  } catch (error) {
    console.error('Error al rechazar reembolso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al rechazar reembolso',
    });
  }
};

/**
 * Eliminar un reembolso
 */
const deleteRefundById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el reembolso existe
    const existingRefund = await getRefundById(id);
    if (!existingRefund) {
      return res.status(404).json({
        success: false,
        error: 'Reembolso no encontrado',
      });
    }

    const deleted = await deleteRefund(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Reembolso eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el reembolso',
      });
    }
  } catch (error) {
    console.error('Error al eliminar reembolso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar reembolso',
    });
  }
};

/**
 * Obtener estadísticas de reembolsos
 */
const getStats = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
    };

    const stats = await getRefundStats(filters);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de reembolsos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de reembolsos',
    });
  }
};

module.exports = {
  getRefunds,
  getRefund,
  createNewRefund,
  updateExistingRefund,
  processExistingRefund,
  rejectExistingRefund,
  deleteRefundById,
  getStats,
};
