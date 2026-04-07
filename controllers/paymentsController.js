const {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  markAsPaid,
  cancelPayment,
  deletePayment,
  paymentExistsForMonth,
  getPaymentStats,
  updateOverduePayments,
} = require('../models/paymentsModel');

/**
 * Obtener todos los pagos con filtros
 */
const getPayments = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      admin_id: req.query.admin_id,
      status: req.query.status,
      month: req.query.month,
      year: req.query.year,
      overdue: req.query.overdue,
    };

    const payments = await getAllPayments(filters);

    res.json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pagos',
    });
  }
};

/**
 * Obtener un pago por ID
 */
const getPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await getPaymentById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado',
      });
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error('Error al obtener pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pago',
    });
  }
};

/**
 * Crear un nuevo pago
 */
const createNewPayment = async (req, res) => {
  try {
    const {
      field_id,
      admin_id,
      month,
      due_date,
      amount,
      status,
      payment_method,
      operation_number,
      notes,
    } = req.body;

    // Validaciones básicas
    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!admin_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID del administrador es requerido',
      });
    }

    if (!month || !month.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El mes es requerido (formato: YYYY-MM)',
      });
    }

    // Validar formato de mes (YYYY-MM)
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de mes inválido (debe ser YYYY-MM)',
      });
    }

    if (!due_date) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de vencimiento es requerida',
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto debe ser mayor a 0',
      });
    }

    // Verificar si ya existe un pago para esta cancha en este mes
    const exists = await paymentExistsForMonth(field_id, month);
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un pago registrado para esta cancha en este mes',
      });
    }

    const paymentData = {
      field_id,
      admin_id,
      month: month.trim(),
      due_date,
      amount,
      status,
      payment_method: payment_method?.trim(),
      operation_number: operation_number?.trim(),
      notes: notes?.trim(),
      registered_by: req.user?.id || 1,
      user_id_registration: req.user?.id || 1,
    };

    const newPayment = await createPayment(paymentData);

    res.status(201).json({
      success: true,
      message: 'Pago creado exitosamente',
      data: newPayment,
    });
  } catch (error) {
    console.error('Error al crear pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear pago',
    });
  }
};

/**
 * Actualizar un pago
 */
const updateExistingPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      field_id,
      admin_id,
      month,
      due_date,
      amount,
      status,
      payment_method,
      operation_number,
      notes,
    } = req.body;

    // Verificar si el pago existe
    const existingPayment = await getPaymentById(id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado',
      });
    }

    // Validar formato de mes si se proporciona
    if (month && month.trim()) {
      const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
      if (!monthRegex.test(month)) {
        return res.status(400).json({
          success: false,
          error: 'Formato de mes inválido (debe ser YYYY-MM)',
        });
      }

      // Verificar duplicados si se cambia el mes o la cancha
      const newFieldId = field_id || existingPayment.field_id;
      const newMonth = month.trim();
      if (newFieldId !== existingPayment.field_id || newMonth !== existingPayment.month) {
        const exists = await paymentExistsForMonth(newFieldId, newMonth, id);
        if (exists) {
          return res.status(409).json({
            success: false,
            error: 'Ya existe un pago registrado para esta cancha en este mes',
          });
        }
      }
    }

    if (amount && amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto debe ser mayor a 0',
      });
    }

    const paymentData = {
      field_id,
      admin_id,
      month: month?.trim(),
      due_date,
      amount,
      status,
      payment_method: payment_method?.trim(),
      operation_number: operation_number?.trim(),
      notes: notes?.trim(),
      user_id_modification: req.user?.id || 1,
    };

    const updatedPayment = await updatePayment(id, paymentData);

    res.json({
      success: true,
      message: 'Pago actualizado exitosamente',
      data: updatedPayment,
    });
  } catch (error) {
    console.error('Error al actualizar pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar pago',
    });
  }
};

/**
 * Marcar un pago como pagado
 */
const markPaymentAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, operation_number, notes } = req.body;

    if (!payment_method || !payment_method.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El método de pago es requerido',
      });
    }

    // Verificar si el pago existe
    const existingPayment = await getPaymentById(id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado',
      });
    }

    // Verificar que no esté ya pagado
    if (existingPayment.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'El pago ya está marcado como pagado',
      });
    }

    const paymentInfo = {
      payment_method: payment_method.trim(),
      operation_number: operation_number?.trim(),
      notes: notes?.trim(),
      user_id_modification: req.user?.id || 1,
    };

    const updatedPayment = await markAsPaid(id, paymentInfo);

    res.json({
      success: true,
      message: 'Pago marcado como pagado exitosamente',
      data: updatedPayment,
    });
  } catch (error) {
    console.error('Error al marcar pago como pagado:', error);
    res.status(500).json({
      success: false,
      error: 'Error al marcar pago como pagado',
    });
  }
};

/**
 * Cancelar un pago
 */
const cancelExistingPayment = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el pago existe
    const existingPayment = await getPaymentById(id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado',
      });
    }

    // Verificar que no esté ya pagado
    if (existingPayment.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar un pago que ya está pagado',
      });
    }

    const user_id = req.user?.id || 1;
    const cancelledPayment = await cancelPayment(id, user_id);

    res.json({
      success: true,
      message: 'Pago cancelado exitosamente',
      data: cancelledPayment,
    });
  } catch (error) {
    console.error('Error al cancelar pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cancelar pago',
    });
  }
};

/**
 * Eliminar un pago
 */
const deletePaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el pago existe
    const existingPayment = await getPaymentById(id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado',
      });
    }

    const deleted = await deletePayment(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Pago eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el pago',
      });
    }
  } catch (error) {
    console.error('Error al eliminar pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar pago',
    });
  }
};

/**
 * Obtener estadísticas de pagos
 */
const getStats = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      admin_id: req.query.admin_id,
      year: req.query.year,
    };

    const stats = await getPaymentStats(filters);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de pagos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de pagos',
    });
  }
};

/**
 * Actualizar pagos vencidos (CRON job endpoint)
 */
const updateOverdue = async (req, res) => {
  try {
    const updatedCount = await updateOverduePayments();

    res.json({
      success: true,
      message: `Se actualizaron ${updatedCount} pagos vencidos`,
      count: updatedCount,
    });
  } catch (error) {
    console.error('Error al actualizar pagos vencidos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar pagos vencidos',
    });
  }
};

module.exports = {
  getPayments,
  getPayment,
  createNewPayment,
  updateExistingPayment,
  markPaymentAsPaid,
  cancelExistingPayment,
  deletePaymentById,
  getStats,
  updateOverdue,
};
