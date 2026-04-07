const {
  getAllPaymentConfigs,
  getPaymentConfigById,
  getPaymentConfigByFieldId,
  createPaymentConfig,
  updatePaymentConfig,
  updatePaymentConfigByFieldId,
  deletePaymentConfig,
} = require('../models/paymentConfigsModel');

/**
 * Obtener todas las configuraciones de pago
 */
const getPaymentConfigs = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      admin_id: req.query.admin_id,
      is_active: req.query.is_active,
    };

    const configs = await getAllPaymentConfigs(filters);

    res.json({
      success: true,
      data: configs,
      count: configs.length,
    });
  } catch (error) {
    console.error('Error al obtener configuraciones de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuraciones de pago',
    });
  }
};

/**
 * Obtener una configuración de pago por ID
 */
const getPaymentConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const config = await getPaymentConfigById(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada',
      });
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración',
    });
  }
};

/**
 * Obtener configuración de pago por field_id
 */
const getPaymentConfigByField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const config = await getPaymentConfigByFieldId(fieldId);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada',
      });
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración',
    });
  }
};

/**
 * Crear o actualizar configuración de pago
 */
const upsertPaymentConfig = async (req, res) => {
  try {
    const { field_id, admin_id, monthly_fee, due_day, effective_from, is_active } = req.body;

    // Validaciones
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

    if (!monthly_fee || monthly_fee <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto mensual debe ser mayor a 0',
      });
    }

    if (!due_day || due_day < 1 || due_day > 28) {
      return res.status(400).json({
        success: false,
        error: 'El día de vencimiento debe estar entre 1 y 28',
      });
    }

    // Verificar si ya existe configuración para esta cancha
    const existingConfig = await getPaymentConfigByFieldId(field_id);

    let result;
    if (existingConfig) {
      // Actualizar configuración existente
      result = await updatePaymentConfigByFieldId(field_id, {
        monthly_fee,
        due_day,
        effective_from: effective_from || undefined,
        is_active: is_active !== undefined ? is_active : true,
        status: 'active',
        user_id_modification: req.user?.id || 1,
      });

      res.json({
        success: true,
        message: 'Configuración actualizada exitosamente',
        data: result,
      });
    } else {
      // Crear nueva configuración
      result = await createPaymentConfig({
        field_id,
        admin_id,
        monthly_fee,
        due_day,
        effective_from: effective_from || null,
        is_active: is_active !== undefined ? is_active : true,
        user_id_registration: req.user?.id || 1,
      });

      res.status(201).json({
        success: true,
        message: 'Configuración creada exitosamente',
        data: result,
      });
    }
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al guardar configuración',
    });
  }
};

/**
 * Actualizar configuración de pago existente
 */
const updateExistingPaymentConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { monthly_fee, due_day, effective_from, is_active, status } = req.body;

    // Verificar si existe
    const existingConfig = await getPaymentConfigById(id);
    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada',
      });
    }

    // Validaciones opcionales
    if (monthly_fee !== undefined && monthly_fee <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto mensual debe ser mayor a 0',
      });
    }

    if (due_day !== undefined && (due_day < 1 || due_day > 28)) {
      return res.status(400).json({
        success: false,
        error: 'El día de vencimiento debe estar entre 1 y 28',
      });
    }

    const updatedConfig = await updatePaymentConfig(id, {
      monthly_fee,
      due_day,
      effective_from: effective_from || undefined,
      is_active,
      status,
      user_id_modification: req.user?.id || 1,
    });

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: updatedConfig,
    });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar configuración',
    });
  }
};

/**
 * Eliminar configuración de pago
 */
const deletePaymentConfigById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si existe
    const existingConfig = await getPaymentConfigById(id);
    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada',
      });
    }

    const deleted = await deletePaymentConfig(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Configuración eliminada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar la configuración',
      });
    }
  } catch (error) {
    console.error('Error al eliminar configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar configuración',
    });
  }
};

module.exports = {
  getPaymentConfigs,
  getPaymentConfig,
  getPaymentConfigByField,
  upsertPaymentConfig,
  updateExistingPaymentConfig,
  deletePaymentConfigById,
};
