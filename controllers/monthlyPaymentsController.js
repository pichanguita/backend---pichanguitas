const {
  getMonthlyPaymentStatus,
  getPaymentHistory,
  createPayment,
  reportPayment,
  confirmPayment,
  rejectPayment,
  deletePayment,
  generateMonthlyPayments,
  getMonthlyStats,
  getPaymentById,
  getAdminCurrentPaymentStatus,
} = require('../models/monthlyPaymentsModel');
const pool = require('../config/db');
const { uploadFile, deleteFileByUrl, toProxyUrl } = require('../services/wasabiService');
const { WASABI_FOLDERS } = require('../config/storage');

/**
 * Crear una alerta para notificar eventos de pago
 */
const createPaymentAlert = async (type, title, message, adminId, fieldId = null, userId = null) => {
  try {
    await pool.query(
      `
      INSERT INTO alerts (type, title, message, admin_id, field_id, user_id, status, priority, user_id_registration, date_time_registration)
      VALUES ($1, $2, $3, $4, $5, $6, 'unread', 'high', $6, CURRENT_TIMESTAMP)
    `,
      [type, title, message, adminId, fieldId, userId]
    );
  } catch (error) {
    console.error('Error creando alerta de pago:', error);
  }
};

/**
 * Obtener estado de pagos para un mes/año
 * GET /api/monthly-payments
 * Combina configs activas + pagos realizados
 */
const getAll = async (req, res) => {
  try {
    const { admin_id, status, month, year } = req.query;

    const currentDate = new Date();
    const filters = {
      month: month ? parseInt(month) : currentDate.getMonth() + 1,
      year: year ? parseInt(year) : currentDate.getFullYear(),
      admin_id: admin_id ? parseInt(admin_id) : null,
      status: status || null,
    };

    const payments = await getMonthlyPaymentStatus(filters);
    const paymentsWithProxy = payments.map(p => ({
      ...p,
      payment_voucher_url: toProxyUrl(p.payment_voucher_url),
    }));

    res.json({
      success: true,
      data: paymentsWithProxy,
    });
  } catch (error) {
    console.error('Error obteniendo pagos mensuales:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pagos mensuales',
    });
  }
};

/**
 * Obtener historial de pagos realizados
 * GET /api/monthly-payments/history
 */
const getHistory = async (req, res) => {
  try {
    const { admin_id, field_id, year, status } = req.query;

    const filters = {};
    if (admin_id) filters.admin_id = parseInt(admin_id);
    if (field_id) filters.field_id = parseInt(field_id);
    if (year) filters.year = parseInt(year);
    if (status) filters.status = status;

    const history = await getPaymentHistory(filters);
    const historyWithProxy = history.map(p => ({
      ...p,
      payment_voucher_url: toProxyUrl(p.payment_voucher_url),
    }));

    res.json({
      success: true,
      data: historyWithProxy,
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial de pagos',
    });
  }
};

/**
 * Registrar un pago directamente como pagado (super_admin)
 * POST /api/monthly-payments/pay
 */
const pay = async (req, res) => {
  try {
    const {
      config_id,
      field_id,
      admin_id,
      month,
      year,
      amount,
      due_day,
      payment_method,
      payment_reference,
      notes,
    } = req.body;
    const userId = req.user?.id || 1;

    if (!config_id || !field_id || !admin_id || !month || !year || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos',
      });
    }

    const payment = await createPayment(
      {
        config_id,
        field_id,
        admin_id,
        month,
        year,
        amount,
        due_day: due_day || 10,
        payment_method,
        payment_reference,
        notes,
      },
      userId
    );

    // Crear alerta para el admin de cancha
    await createPaymentAlert(
      'payment_confirmed',
      'Pago Confirmado',
      `Tu pago del mes ${month}/${year} ha sido confirmado.`,
      admin_id,
      field_id,
      userId
    );

    res.json({
      success: true,
      message: 'Pago registrado exitosamente',
      data: payment,
    });
  } catch (error) {
    console.error('Error registrando pago:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al registrar pago',
    });
  }
};

/**
 * Reportar un pago (admin de cancha)
 * POST /api/monthly-payments/report
 */
const report = async (req, res) => {
  try {
    const {
      config_id,
      field_id,
      admin_id,
      month,
      year,
      amount,
      due_day,
      payment_method,
      payment_reference,
      notes,
    } = req.body;
    const userId = req.user?.id;

    if (!config_id || !field_id || !month || !year || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos',
      });
    }

    // Verificar que el usuario sea el admin de la cancha
    const adminIdParsed = parseInt(admin_id);
    if (req.user?.id_rol !== 1 && req.user?.id !== adminIdParsed) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para reportar este pago',
      });
    }

    // Subir voucher a Wasabi si se envio archivo
    let payment_voucher_url = null;
    if (req.file) {
      const result = await uploadFile({
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        folder: `${WASABI_FOLDERS.MONTHLY_VOUCHERS}/${admin_id}/${field_id}`,
        customFilename: `voucher_${year}_${month}_${Date.now()}`,
      });
      payment_voucher_url = result.url;
    }

    const payment = await reportPayment(
      {
        config_id,
        field_id,
        admin_id: adminIdParsed || userId,
        month,
        year,
        amount,
        due_day: due_day || 10,
        payment_method,
        payment_reference,
        payment_voucher_url,
        notes,
      },
      userId
    );

    // Crear alerta para el super_admin (role_id = 1)
    // Buscar super_admins para notificarles
    const superAdmins = await pool.query(
      `SELECT id FROM users WHERE role_id = 1 AND is_active = true`
    );
    for (const superAdmin of superAdmins.rows) {
      await createPaymentAlert(
        'payment_reported',
        'Pago Reportado',
        `El admin ${req.user?.name || 'Administrador'} ha reportado un pago del mes ${month}/${year}. Requiere confirmación.`,
        superAdmin.id,
        field_id,
        userId
      );
    }

    res.json({
      success: true,
      message: 'Pago reportado exitosamente. Esperando confirmación del administrador.',
      data: payment,
    });
  } catch (error) {
    console.error('Error reportando pago:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al reportar pago',
    });
  }
};

/**
 * Confirmar un pago reportado (super_admin)
 * PUT /api/monthly-payments/:id/confirm
 */
const confirm = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.id;

    const payment = await confirmPayment(id, userId, notes);

    // Notificar al admin de cancha
    await createPaymentAlert(
      'payment_confirmed',
      'Pago Confirmado',
      `Tu pago del mes ${payment.month}/${payment.year} ha sido confirmado.`,
      payment.admin_id,
      payment.field_id,
      userId
    );

    res.json({
      success: true,
      message: 'Pago confirmado exitosamente',
      data: payment,
    });
  } catch (error) {
    console.error('Error confirmando pago:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al confirmar pago',
    });
  }
};

/**
 * Rechazar un pago reportado (super_admin)
 * PUT /api/monthly-payments/:id/reject
 */
const reject = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar una razón para el rechazo',
      });
    }

    const payment = await rejectPayment(id, userId, reason);

    // Limpieza: el voucher del reporte rechazado queda obsoleto
    if (payment?.previous_payment_voucher_url) {
      await deleteFileByUrl(payment.previous_payment_voucher_url);
    }

    // Notificar al admin de cancha
    await createPaymentAlert(
      'payment_rejected',
      'Pago Rechazado',
      `Tu reporte de pago del mes ${payment.month}/${payment.year} ha sido rechazado. Razón: ${reason}`,
      payment.admin_id,
      payment.field_id,
      userId
    );

    res.json({
      success: true,
      message: 'Pago rechazado. El admin ha sido notificado.',
      data: payment,
    });
  } catch (error) {
    console.error('Error rechazando pago:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al rechazar pago',
    });
  }
};

/**
 * Eliminar un pago (revertir a pendiente)
 * DELETE /api/monthly-payments/:id
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await deletePayment(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado',
      });
    }

    // Limpieza: eliminar voucher en Wasabi
    if (deleted.payment_voucher_url) {
      await deleteFileByUrl(deleted.payment_voucher_url);
    }

    res.json({
      success: true,
      message: 'Pago eliminado, cobro vuelve a estar pendiente',
      data: deleted,
    });
  } catch (error) {
    console.error('Error eliminando pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar pago',
    });
  }
};

/**
 * Obtener estadísticas del mes
 * GET /api/monthly-payments/stats
 */
const getStats = async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const stats = await getMonthlyStats(month, year);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
    });
  }
};

/**
 * Obtener un pago por ID
 * GET /api/monthly-payments/:id
 */
const getOne = async (req, res) => {
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
      data: { ...payment, payment_voucher_url: toProxyUrl(payment.payment_voucher_url) },
    });
  } catch (error) {
    console.error('Error obteniendo pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pago',
    });
  }
};

/**
 * Obtener estado de pago actual del admin logueado
 * GET /api/monthly-payments/my-status
 */
const getMyStatus = async (req, res) => {
  try {
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    const status = await getAdminCurrentPaymentStatus(adminId);

    const applyProxy = p => (p ? { ...p, payment_voucher_url: toProxyUrl(p.payment_voucher_url) } : p);
    const normalized = Array.isArray(status)
      ? status.map(applyProxy)
      : status && typeof status === 'object'
        ? applyProxy(status)
        : status;

    res.json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    console.error('Error obteniendo estado de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de pago',
    });
  }
};

/**
 * Generar pagos mensuales automáticamente
 * POST /api/monthly-payments/generate
 * Solo para super_admin
 */
const generate = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    const { month, year } = req.body;

    // Si no se especifica, usar mes/año actual
    const currentDate = new Date();
    const targetMonth = month || currentDate.getMonth() + 1;
    const targetYear = year || currentDate.getFullYear();

    const results = await generateMonthlyPayments(targetMonth, targetYear, userId);

    res.json({
      success: true,
      message: `Generación de pagos completada para ${targetMonth}/${targetYear}`,
      data: results,
    });
  } catch (error) {
    console.error('Error generando pagos mensuales:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al generar pagos mensuales',
    });
  }
};

module.exports = {
  getAll,
  getHistory,
  pay,
  report,
  confirm,
  reject,
  remove,
  getStats,
  getOne,
  getMyStatus,
  generate,
};
