const {
  getAllAlerts,
  getAlertById,
  createAlert,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteAlert,
  deleteMultipleAlerts,
  getUnreadCount,
  getAlertStats,
} = require('../models/alertsModel');

/**
 * Obtener todas las alertas con filtros
 * SuperAdmin (role_id=1) ve todas, Admin (role_id=2) solo las suyas
 */
const getAlerts = async (req, res) => {
  try {
    const user = req.user;
    const isSuperAdmin = user?.id_rol === 1;

    const filters = {
      // Si es admin, solo ver sus alertas. Si es superadmin, ver todas o filtrar por admin_id si se especifica
      admin_id: isSuperAdmin
        ? req.query.admin_id
          ? parseInt(req.query.admin_id)
          : null
        : user?.id,
      type: req.query.type,
      status: req.query.status,
      priority: req.query.priority,
      field_id: req.query.field_id ? parseInt(req.query.field_id) : null,
    };

    const alerts = await getAllAlerts(filters);

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener alertas',
    });
  }
};

/**
 * Obtener una alerta por ID
 */
const getAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await getAlertById(id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alerta no encontrada',
      });
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    console.error('Error al obtener alerta:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener alerta',
    });
  }
};

/**
 * Crear una nueva alerta
 */
const createNewAlert = async (req, res) => {
  try {
    const {
      type,
      title,
      message,
      field_id,
      customer_id,
      reservation_id,
      user_id,
      status,
      priority,
      admin_id,
      reservation_data,
    } = req.body;

    // Validaciones básicas
    if (!type || !type.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El tipo de alerta es requerido',
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El título es requerido',
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El mensaje es requerido',
      });
    }

    if (!admin_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID del admin es requerido',
      });
    }

    const alertData = {
      type: type.trim(),
      title: title.trim(),
      message: message.trim(),
      field_id,
      customer_id,
      reservation_id,
      user_id,
      status,
      priority,
      admin_id,
      reservation_data,
      user_id_registration: req.user?.id || admin_id,
    };

    const newAlert = await createAlert(alertData);

    res.status(201).json({
      success: true,
      message: 'Alerta creada exitosamente',
      data: newAlert,
    });
  } catch (error) {
    console.error('Error al crear alerta:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear alerta',
    });
  }
};

/**
 * Marcar una alerta como leída
 */
const markAlertAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la alerta existe
    const existingAlert = await getAlertById(id);
    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: 'Alerta no encontrada',
      });
    }

    const user_id = req.user?.id || 1;
    const updatedAlert = await markAsRead(id, user_id);

    res.json({
      success: true,
      message: 'Alerta marcada como leída',
      data: updatedAlert,
    });
  } catch (error) {
    console.error('Error al marcar alerta como leída:', error);
    res.status(500).json({
      success: false,
      error: 'Error al marcar alerta como leída',
    });
  }
};

/**
 * Marcar múltiples alertas como leídas
 */
const markMultipleAlertsAsRead = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de IDs no vacío',
      });
    }

    const user_id = req.user?.id || 1;
    const count = await markMultipleAsRead(ids, user_id);

    res.json({
      success: true,
      message: `${count} alerta(s) marcada(s) como leída(s)`,
      count,
    });
  } catch (error) {
    console.error('Error al marcar alertas como leídas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al marcar alertas como leídas',
    });
  }
};

/**
 * Marcar TODAS las alertas como leídas
 * SuperAdmin marca todas, Admin solo las suyas
 */
const markAllAlertsAsRead = async (req, res) => {
  try {
    const user = req.user;
    const isSuperAdmin = user?.id_rol === 1;

    // Si es admin, solo marcar las suyas. Si es superadmin, marcar todas
    const adminId = isSuperAdmin ? null : user?.id;
    const user_id = user?.id || 1;

    const count = await markAllAsRead(adminId, user_id);

    res.json({
      success: true,
      message: `${count} alerta(s) marcada(s) como leída(s)`,
      count,
    });
  } catch (error) {
    console.error('Error al marcar todas las alertas como leídas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al marcar todas las alertas como leídas',
    });
  }
};

/**
 * Eliminar una alerta
 */
const deleteAlertById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la alerta existe
    const existingAlert = await getAlertById(id);
    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: 'Alerta no encontrada',
      });
    }

    const deleted = await deleteAlert(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Alerta eliminada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar la alerta',
      });
    }
  } catch (error) {
    console.error('Error al eliminar alerta:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar alerta',
    });
  }
};

/**
 * Eliminar múltiples alertas
 */
const deleteMultipleAlertsById = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de IDs no vacío',
      });
    }

    const count = await deleteMultipleAlerts(ids);

    res.json({
      success: true,
      message: `${count} alerta(s) eliminada(s)`,
      count,
    });
  } catch (error) {
    console.error('Error al eliminar alertas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar alertas',
    });
  }
};

/**
 * Obtener conteo de alertas no leídas
 */
const getUnreadAlertCount = async (req, res) => {
  try {
    const { admin_id } = req.params;

    const count = await getUnreadCount(parseInt(admin_id));

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Error al obtener conteo de alertas no leídas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener conteo de alertas no leídas',
    });
  }
};

/**
 * Obtener estadísticas de alertas
 */
const getStats = async (req, res) => {
  try {
    const { admin_id } = req.params;

    const stats = await getAlertStats(parseInt(admin_id));

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de alertas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de alertas',
    });
  }
};

module.exports = {
  getAlerts,
  getAlert,
  createNewAlert,
  markAlertAsRead,
  markMultipleAlertsAsRead,
  markAllAlertsAsRead,
  deleteAlertById,
  deleteMultipleAlertsById,
  getUnreadAlertCount,
  getStats,
};
