const pool = require('../config/db');

/**
 * Estados de pago:
 * - pending: Pendiente de pago
 * - reported: Admin reportó el pago, esperando confirmación del super_admin
 * - paid: Pago confirmado por super_admin
 * - overdue: Vencido (calculado dinámicamente)
 */

/**
 * Obtener cobros pendientes y pagados para un mes/año
 * Combina configuraciones activas con pagos realizados
 */
const getMonthlyPaymentStatus = async (filters = {}) => {
  const { month, year, admin_id, status } = filters;

  // Query que combina payment_configs con monthly_payments
  // Solo incluye configs cuya fecha de vigencia es anterior o igual al mes consultado
  let query = `
    SELECT
      pc.id AS config_id,
      pc.field_id,
      pc.admin_id,
      pc.monthly_fee AS amount,
      pc.due_day,
      pc.effective_from,
      f.name AS field_name,
      f.address AS field_address,
      u.name AS admin_name,
      u.phone AS admin_phone,
      u.email AS admin_email,
      mp.id AS payment_id,
      mp.status AS payment_status,
      mp.paid_at,
      mp.paid_amount,
      mp.payment_method,
      mp.payment_reference,
      mp.payment_voucher_url,
      mp.notes,
      mp.reported_by,
      mp.reported_at,
      mp.confirmed_by,
      mp.confirmed_at,
      reported_user.name AS reported_by_name,
      confirmed_user.name AS confirmed_by_name,
      MAKE_DATE($2::int, $1::int, pc.due_day) AS due_date
    FROM payment_configs pc
    JOIN fields f ON pc.field_id = f.id
    JOIN users u ON pc.admin_id = u.id
    LEFT JOIN monthly_payments mp ON mp.field_id = pc.field_id
      AND mp.month = $1 AND mp.year = $2
    LEFT JOIN users reported_user ON mp.reported_by = reported_user.id
    LEFT JOIN users confirmed_user ON mp.confirmed_by = confirmed_user.id
    WHERE pc.is_active = true
      AND pc.effective_from <= MAKE_DATE($2::int, $1::int, pc.due_day)
  `;

  const params = [month, year]; // $1 = month, $2 = year
  let paramCount = 3;

  if (admin_id) {
    query += ` AND pc.admin_id = $${paramCount}`;
    params.push(admin_id);
    paramCount++;
  }

  query += ` ORDER BY u.name, f.name`;

  const result = await pool.query(query, params);

  // Filtrar por status si se especificó
  let rows = result.rows.map(row => {
    // Usar fechas UTC para consistencia entre local y producción (Railway)
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dueDate = new Date(Date.UTC(year, month - 1, row.due_day));

    let calculatedStatus = 'pending';
    if (row.payment_status === 'paid') {
      calculatedStatus = 'paid';
    } else if (row.payment_status === 'reported') {
      calculatedStatus = 'reported';
    } else if (todayUTC > dueDate) {
      // Solo marcar como overdue si la fecha de vigencia es anterior o igual al vencimiento
      const effFrom = new Date(row.effective_from);
      const effFromUTC = new Date(Date.UTC(effFrom.getUTCFullYear(), effFrom.getUTCMonth(), effFrom.getUTCDate()));
      if (effFromUTC <= dueDate) {
        calculatedStatus = 'overdue';
      }
      // Si la vigencia es posterior al vencimiento, queda como 'pending'
    }

    return {
      ...row,
      status: calculatedStatus,
      due_date: dueDate.toISOString(),
    };
  });

  if (status && status !== 'all') {
    rows = rows.filter(r => r.status === status);
  }

  return rows;
};

/**
 * Obtener historial de pagos realizados
 */
const getPaymentHistory = async (filters = {}) => {
  let query = `
    SELECT
      mp.*,
      f.name AS field_name,
      f.address AS field_address,
      u.name AS admin_name,
      u.phone AS admin_phone,
      u.email AS admin_email,
      reported_user.name AS reported_by_name,
      confirmed_user.name AS confirmed_by_name
    FROM monthly_payments mp
    JOIN fields f ON mp.field_id = f.id
    JOIN users u ON mp.admin_id = u.id
    LEFT JOIN users reported_user ON mp.reported_by = reported_user.id
    LEFT JOIN users confirmed_user ON mp.confirmed_by = confirmed_user.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  if (filters.admin_id) {
    query += ` AND mp.admin_id = $${paramCount}`;
    params.push(filters.admin_id);
    paramCount++;
  }

  if (filters.field_id) {
    query += ` AND mp.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  if (filters.year) {
    query += ` AND mp.year = $${paramCount}`;
    params.push(filters.year);
    paramCount++;
  }

  if (filters.status) {
    query += ` AND mp.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  query += ` ORDER BY mp.year DESC, mp.month DESC, mp.paid_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Registrar un pago directamente como pagado (usado por super_admin)
 */
const createPayment = async (paymentData, userId) => {
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
  } = paymentData;

  // Verificar que no exista pago para ese mes
  const existing = await pool.query(
    `SELECT id FROM monthly_payments WHERE field_id = $1 AND month = $2 AND year = $3`,
    [field_id, month, year]
  );

  if (existing.rows.length > 0) {
    throw new Error('Ya existe un pago registrado para este mes');
  }

  // Calcular due_date
  const dueDate = new Date(year, month - 1, due_day || 10);

  const result = await pool.query(
    `
    INSERT INTO monthly_payments (
      field_id, admin_id, payment_config_id, month, year,
      amount, paid_amount, due_date, status, paid_at,
      payment_method, payment_reference, notes,
      generated_by, confirmed_by, confirmed_at,
      user_id_registration, date_time_registration
    )
    VALUES ($1, $2, $3, $4, $5, $6, $6, $7, 'paid', CURRENT_TIMESTAMP, $8, $9, $10, $11, $11, CURRENT_TIMESTAMP, $11, CURRENT_TIMESTAMP)
    RETURNING *
  `,
    [
      field_id,
      admin_id,
      config_id,
      month,
      year,
      amount,
      dueDate,
      payment_method || null,
      payment_reference || null,
      notes || null,
      userId,
    ]
  );

  return result.rows[0];
};

/**
 * Reportar un pago (usado por admin de cancha)
 * Crea o actualiza un registro con status 'reported'
 */
const reportPayment = async (paymentData, userId) => {
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
    payment_voucher_url,
    notes,
  } = paymentData;

  // Verificar si ya existe un registro para ese mes
  const existing = await pool.query(
    `SELECT id, status FROM monthly_payments WHERE field_id = $1 AND month = $2 AND year = $3`,
    [field_id, month, year]
  );

  // Calcular due_date
  const dueDate = new Date(year, month - 1, due_day || 10);

  if (existing.rows.length > 0) {
    // Si ya existe y está pagado, no permitir reportar de nuevo
    if (existing.rows[0].status === 'paid') {
      throw new Error('Este pago ya fue confirmado');
    }

    // Actualizar el registro existente
    const result = await pool.query(
      `
      UPDATE monthly_payments SET
        status = 'reported',
        payment_method = $1,
        payment_reference = $2,
        payment_voucher_url = $3,
        notes = $4,
        reported_by = $5,
        reported_at = CURRENT_TIMESTAMP,
        user_id_modification = $5,
        date_time_modification = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `,
      [payment_method, payment_reference, payment_voucher_url, notes, userId, existing.rows[0].id]
    );

    return result.rows[0];
  }

  // Crear nuevo registro con status 'reported'
  const result = await pool.query(
    `
    INSERT INTO monthly_payments (
      field_id, admin_id, payment_config_id, month, year,
      amount, due_date, status,
      payment_method, payment_reference, payment_voucher_url, notes,
      reported_by, reported_at,
      user_id_registration, date_time_registration
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'reported', $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $12, CURRENT_TIMESTAMP)
    RETURNING *
  `,
    [
      field_id,
      admin_id,
      config_id,
      month,
      year,
      amount,
      dueDate,
      payment_method,
      payment_reference,
      payment_voucher_url,
      notes,
      userId,
    ]
  );

  return result.rows[0];
};

/**
 * Confirmar un pago reportado (usado por super_admin)
 */
const confirmPayment = async (paymentId, userId, notes = null) => {
  // Verificar que el pago exista y esté en status 'reported'
  const existing = await pool.query(`SELECT * FROM monthly_payments WHERE id = $1`, [paymentId]);

  if (existing.rows.length === 0) {
    throw new Error('Pago no encontrado');
  }

  if (existing.rows[0].status === 'paid') {
    throw new Error('Este pago ya fue confirmado');
  }

  const result = await pool.query(
    `
    UPDATE monthly_payments SET
      status = 'paid',
      paid_at = CURRENT_TIMESTAMP,
      paid_amount = amount,
      confirmed_by = $1,
      confirmed_at = CURRENT_TIMESTAMP,
      notes = COALESCE($2, notes),
      user_id_modification = $1,
      date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `,
    [userId, notes, paymentId]
  );

  return result.rows[0];
};

/**
 * Rechazar un pago reportado (usado por super_admin)
 */
const rejectPayment = async (paymentId, userId, reason) => {
  const existing = await pool.query(`SELECT * FROM monthly_payments WHERE id = $1`, [paymentId]);

  if (existing.rows.length === 0) {
    throw new Error('Pago no encontrado');
  }

  if (existing.rows[0].status === 'paid') {
    throw new Error('No se puede rechazar un pago ya confirmado');
  }

  // Volver a pending y limpiar datos de reporte
  const result = await pool.query(
    `
    UPDATE monthly_payments SET
      status = 'pending',
      payment_method = NULL,
      payment_reference = NULL,
      payment_voucher_url = NULL,
      reported_by = NULL,
      reported_at = NULL,
      notes = $1,
      user_id_modification = $2,
      date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `,
    [reason, userId, paymentId]
  );

  return result.rows[0];
};

/**
 * Obtener un pago por ID
 */
const getPaymentById = async paymentId => {
  const result = await pool.query(
    `
    SELECT
      mp.*,
      f.name AS field_name,
      f.address AS field_address,
      u.name AS admin_name,
      u.phone AS admin_phone,
      u.email AS admin_email,
      reported_user.name AS reported_by_name,
      confirmed_user.name AS confirmed_by_name
    FROM monthly_payments mp
    JOIN fields f ON mp.field_id = f.id
    JOIN users u ON mp.admin_id = u.id
    LEFT JOIN users reported_user ON mp.reported_by = reported_user.id
    LEFT JOIN users confirmed_user ON mp.confirmed_by = confirmed_user.id
    WHERE mp.id = $1
  `,
    [paymentId]
  );

  return result.rows[0] || null;
};

/**
 * Obtener estado de pago actual del admin (para AdminPaymentStatus)
 */
const getAdminCurrentPaymentStatus = async adminId => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const result = await pool.query(
    `
    SELECT
      pc.id AS config_id,
      pc.field_id,
      pc.admin_id,
      pc.monthly_fee AS amount,
      pc.due_day,
      pc.effective_from,
      f.name AS field_name,
      mp.id AS payment_id,
      mp.status AS payment_status,
      mp.paid_at,
      mp.payment_method,
      mp.payment_reference,
      mp.payment_voucher_url,
      mp.reported_at,
      mp.notes,
      MAKE_DATE($2::int, $1::int, pc.due_day) AS due_date
    FROM payment_configs pc
    JOIN fields f ON pc.field_id = f.id
    LEFT JOIN monthly_payments mp ON mp.field_id = pc.field_id
      AND mp.month = $1 AND mp.year = $2
    WHERE pc.admin_id = $3 AND pc.is_active = true
      AND pc.effective_from <= MAKE_DATE($2::int, $1::int, pc.due_day)
    ORDER BY f.name
  `,
    [currentMonth, currentYear, adminId]
  );

  return result.rows.map(row => {
    // Usar fechas UTC para consistencia entre local y producción (Railway)
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dueDate = new Date(Date.UTC(currentYear, currentMonth - 1, row.due_day));

    let status = 'pending';

    if (row.payment_status === 'paid') {
      status = 'paid';
    } else if (row.payment_status === 'reported') {
      status = 'reported';
    } else if (todayUTC > dueDate) {
      // Solo overdue si la fecha de vigencia es anterior o igual al vencimiento
      const effFrom = new Date(row.effective_from);
      const effFromUTC = new Date(Date.UTC(effFrom.getUTCFullYear(), effFrom.getUTCMonth(), effFrom.getUTCDate()));
      if (effFromUTC <= dueDate) {
        status = 'overdue';
      }
    }

    return {
      ...row,
      status,
      due_date: dueDate.toISOString(),
      month: currentMonth,
      year: currentYear,
    };
  });
};

/**
 * Generar pagos mensuales automáticamente para todas las configuraciones activas
 * @param {Number} month - Mes (1-12)
 * @param {Number} year - Año
 * @param {Number} userId - ID del usuario que genera (super_admin)
 * @returns {Object} Resumen de pagos generados
 */
const generateMonthlyPayments = async (month, year, userId) => {
  // Validar parámetros
  if (!month || month < 1 || month > 12) {
    throw new Error('Mes inválido. Debe estar entre 1 y 12');
  }
  if (!year || year < 2000) {
    throw new Error('Año inválido');
  }
  if (!userId) {
    throw new Error('Usuario requerido');
  }

  // Obtener todas las configuraciones activas
  const configsResult = await pool.query(`
    SELECT
      pc.id AS config_id,
      pc.field_id,
      pc.admin_id,
      pc.monthly_fee,
      pc.due_day,
      f.name AS field_name,
      u.name AS admin_name
    FROM payment_configs pc
    JOIN fields f ON pc.field_id = f.id
    JOIN users u ON pc.admin_id = u.id
    WHERE pc.is_active = true
    ORDER BY u.name, f.name
  `);

  const configs = configsResult.rows;
  const results = {
    total_configs: configs.length,
    generated: 0,
    already_exists: 0,
    errors: 0,
    details: [],
  };

  // Para cada configuración, intentar crear el pago
  for (const config of configs) {
    try {
      // Verificar si ya existe un pago para este mes
      const existing = await pool.query(
        `SELECT id FROM monthly_payments WHERE field_id = $1 AND month = $2 AND year = $3`,
        [config.field_id, month, year]
      );

      if (existing.rows.length > 0) {
        results.already_exists++;
        results.details.push({
          field_name: config.field_name,
          admin_name: config.admin_name,
          status: 'already_exists',
          message: 'Ya existe un registro de pago para este mes',
        });
        continue;
      }

      // Calcular fecha de vencimiento
      const dueDate = new Date(year, month - 1, config.due_day);

      // Crear el registro de pago pendiente
      await pool.query(
        `
        INSERT INTO monthly_payments (
          field_id, admin_id, payment_config_id, month, year,
          amount, due_date, status,
          generated_by,
          user_id_registration, date_time_registration
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $8, CURRENT_TIMESTAMP)
      `,
        [
          config.field_id,
          config.admin_id,
          config.config_id,
          month,
          year,
          config.monthly_fee,
          dueDate,
          userId,
        ]
      );

      results.generated++;
      results.details.push({
        field_name: config.field_name,
        admin_name: config.admin_name,
        amount: config.monthly_fee,
        status: 'generated',
        message: 'Pago generado exitosamente',
      });
    } catch (error) {
      results.errors++;
      results.details.push({
        field_name: config.field_name,
        admin_name: config.admin_name,
        status: 'error',
        message: error.message,
      });
    }
  }

  return results;
};

/**
 * Eliminar un pago (revertir a pendiente)
 */
const deletePayment = async paymentId => {
  const result = await pool.query(`DELETE FROM monthly_payments WHERE id = $1 RETURNING *`, [
    paymentId,
  ]);
  return result.rows[0] || null;
};

/**
 * Obtener estadísticas para un mes/año
 */
const getMonthlyStats = async (month, year) => {
  // Obtener configuraciones activas cuya vigencia es anterior o igual al mes consultado
  const configsResult = await pool.query(`
    SELECT pc.id, pc.field_id, pc.monthly_fee, pc.due_day, pc.effective_from
    FROM payment_configs pc
    WHERE pc.is_active = true
      AND pc.effective_from <= MAKE_DATE($1::int, $2::int, pc.due_day)
  `, [year, month]);

  // Obtener pagos del mes con su status
  const paymentsResult = await pool.query(
    `
    SELECT field_id, paid_amount, status
    FROM monthly_payments
    WHERE month = $1 AND year = $2
  `,
    [month, year]
  );

  const paymentsMap = new Map(paymentsResult.rows.map(p => [p.field_id, p]));
  // Usar fechas UTC para consistencia entre local y producción (Railway)
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const totalConfigs = configsResult.rows.length;
  let paid = 0;
  let pending = 0;
  let overdue = 0;
  let reported = 0;
  let totalAmount = 0;
  let pendingAmount = 0;
  let overdueAmount = 0;
  let reportedAmount = 0;
  let collectedAmount = 0;

  for (const config of configsResult.rows) {
    const amount = parseFloat(config.monthly_fee) || 0;
    totalAmount += amount;

    const payment = paymentsMap.get(config.field_id);
    const dueDate = new Date(Date.UTC(year, month - 1, config.due_day));

    // Verificar si la fecha de vigencia es anterior o igual al vencimiento
    const effFrom = new Date(config.effective_from);
    const effFromUTC = new Date(Date.UTC(effFrom.getUTCFullYear(), effFrom.getUTCMonth(), effFrom.getUTCDate()));
    const canBeOverdue = effFromUTC <= dueDate;

    if (payment) {
      if (payment.status === 'paid') {
        paid++;
        collectedAmount += parseFloat(payment.paid_amount) || amount;
      } else if (payment.status === 'reported') {
        reported++;
        reportedAmount += amount;
      } else {
        if (todayUTC > dueDate && canBeOverdue) {
          overdue++;
          overdueAmount += amount;
        } else {
          pending++;
          pendingAmount += amount;
        }
      }
    } else {
      if (todayUTC > dueDate && canBeOverdue) {
        overdue++;
        overdueAmount += amount;
      } else {
        pending++;
        pendingAmount += amount;
      }
    }
  }

  return {
    total_payments: totalConfigs,
    paid,
    pending,
    overdue,
    reported,
    cancelled: 0,
    total_amount: totalAmount,
    pending_amount: pendingAmount,
    overdue_amount: overdueAmount,
    reported_amount: reportedAmount,
    collected_amount: collectedAmount,
  };
};

module.exports = {
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
};
