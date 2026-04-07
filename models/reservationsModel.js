const pool = require('../config/db');
const { checkAndAssignBadges } = require('../services/badgeAssignmentService');

/**
 * Obtener todas las reservas con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de reservas
 */
const getAllReservations = async (filters = {}) => {
  let query = `
    SELECT
      r.id,
      r.field_id,
      r.customer_id,
      r.date,
      r.start_time,
      r.end_time,
      r.subtotal,
      r.discount,
      r.total_price,
      r.advance_payment,
      r.remaining_payment,
      r.payment_method,
      r.payment_status,
      r.payment_voucher_url,
      r.status,
      r.type,
      r.hours,
      r.coupon_id,
      r.coupon_discount,
      r.free_hours_used,
      r.free_hours_discount,
      r.reviewed,
      r.review_id,
      r.cancelled_by,
      r.cancellation_reason,
      r.advance_kept,
      r.lost_revenue,
      r.completed_at,
      r.cancelled_at,
      r.no_show_date,
      r.user_id_registration,
      r.date_time_registration,
      r.approved_by,
      r.approved_at,
      r.rejected_by,
      r.rejected_at,
      f.name AS field_name,
      f.admin_id AS field_admin_id,
      c.name AS customer_name,
      c.phone_number AS customer_phone,
      -- Datos del reembolso (si existe)
      ref.id AS refund_id,
      ref.refund_amount,
      ref.status AS refund_status,
      ref.processed_at AS refund_processed_at
    FROM reservations r
    LEFT JOIN fields f ON r.field_id = f.id
    LEFT JOIN customers c ON r.customer_id = c.id
    LEFT JOIN refunds ref ON r.id = ref.reservation_id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // SEGURIDAD CRÍTICA: Filtrar por admin_id si es un admin de cancha
  // Esto previene que un admin vea/apruebe reservas de canchas que no administra
  if (filters.admin_id) {
    query += ` AND f.admin_id = $${paramCount}`;
    params.push(filters.admin_id);
    paramCount++;
  }

  // Filtro por cancha
  if (filters.field_id) {
    query += ` AND r.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  // Filtro por cliente
  if (filters.customer_id) {
    query += ` AND r.customer_id = $${paramCount}`;
    params.push(filters.customer_id);
    paramCount++;
  }

  // Filtro por fecha
  if (filters.date) {
    query += ` AND r.date = $${paramCount}`;
    params.push(filters.date);
    paramCount++;
  }

  // Filtro por rango de fechas
  if (filters.date_from) {
    query += ` AND r.date >= $${paramCount}`;
    params.push(filters.date_from);
    paramCount++;
  }

  if (filters.date_to) {
    query += ` AND r.date <= $${paramCount}`;
    params.push(filters.date_to);
    paramCount++;
  }

  // Filtro por estado
  if (filters.status) {
    query += ` AND r.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por estado de pago
  if (filters.payment_status) {
    query += ` AND r.payment_status = $${paramCount}`;
    params.push(filters.payment_status);
    paramCount++;
  }

  // Filtro por tipo
  if (filters.type) {
    query += ` AND r.type = $${paramCount}`;
    params.push(filters.type);
    paramCount++;
  }

  query += ` ORDER BY r.date DESC, r.start_time DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener una reserva por ID con todos sus detalles
 * @param {number} id - ID de la reserva
 * @returns {Promise<Object|null>} Reserva o null
 */
const getReservationById = async id => {
  const query = `
    SELECT
      r.id,
      r.field_id,
      r.customer_id,
      r.date,
      r.start_time,
      r.end_time,
      r.subtotal,
      r.discount,
      r.total_price,
      r.advance_payment,
      r.remaining_payment,
      r.payment_method,
      r.payment_status,
      r.payment_voucher_url,
      r.status,
      r.type,
      r.hours,
      r.coupon_id,
      r.coupon_discount,
      r.free_hours_used,
      r.free_hours_discount,
      r.reviewed,
      r.review_id,
      r.cancelled_by,
      r.cancellation_reason,
      r.advance_kept,
      r.lost_revenue,
      r.completed_at,
      r.cancelled_at,
      r.no_show_date,
      r.user_id_registration,
      r.date_time_registration,
      f.name AS field_name,
      f.address AS field_address,
      f.phone AS field_phone,
      c.name AS customer_name,
      c.phone_number AS customer_phone,
      c.email AS customer_email,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', rts.id,
            'time_slot', rts.time_slot
          )
        ) FILTER (WHERE rts.id IS NOT NULL),
        '[]'
      ) AS time_slots
    FROM reservations r
    LEFT JOIN fields f ON r.field_id = f.id
    LEFT JOIN customers c ON r.customer_id = c.id
    LEFT JOIN reservation_time_slots rts ON r.id = rts.reservation_id
    WHERE r.id = $1
    GROUP BY r.id, f.name, f.address, f.phone, c.name, c.phone_number, c.email
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear una nueva reserva
 * @param {Object} reservationData - Datos de la reserva
 * @returns {Promise<Object>} Reserva creada
 */
const createReservation = async reservationData => {
  const {
    field_id,
    customer_id,
    date,
    start_time,
    end_time,
    subtotal,
    discount = 0,
    total_price,
    advance_payment = 0,
    remaining_payment = 0,
    payment_method,
    payment_status = 'pending',
    payment_voucher_url,
    status = 'pending',
    type = 'customer_booking',
    hours,
    coupon_id,
    coupon_discount = 0,
    free_hours_used = 0,
    free_hours_discount = 0,
    user_id_registration,
  } = reservationData;

  // Validar que start_time sea menor que end_time
  if (start_time && end_time && start_time >= end_time) {
    throw new Error(
      `Horario inválido: start_time (${start_time}) debe ser menor que end_time (${end_time})`
    );
  }

  const client = await pool.connect();

  // Variables para las horas gratis realmente usadas (pueden ajustarse)
  let actualFreeHoursUsed = free_hours_used;
  let actualFreeHoursDiscount = free_hours_discount;

  try {
    await client.query('BEGIN');

    // Si se intentan usar horas gratis, verificar disponibilidad del cliente
    if (free_hours_used > 0 && customer_id) {
      const customerResult = await client.query(
        'SELECT available_free_hours FROM customers WHERE id = $1',
        [customer_id]
      );

      const availableHours =
        customerResult.rows.length > 0
          ? parseFloat(customerResult.rows[0].available_free_hours) || 0
          : 0;

      // Si el cliente no tiene suficientes horas, ajustar al máximo disponible
      if (free_hours_used > availableHours) {
        console.log(
          `⚠️ Cliente ${customer_id} tiene ${availableHours} horas gratis, se solicitaron ${free_hours_used}. Ajustando...`
        );
        actualFreeHoursUsed = availableHours;
        // Recalcular el descuento proporcionalmente
        if (free_hours_used > 0) {
          actualFreeHoursDiscount = (free_hours_discount / free_hours_used) * actualFreeHoursUsed;
        } else {
          actualFreeHoursDiscount = 0;
        }
      }

      // Solo descontar si hay horas que usar
      if (actualFreeHoursUsed > 0) {
        await client.query(
          `UPDATE customers
           SET used_free_hours = COALESCE(used_free_hours, 0) + $1,
               available_free_hours = COALESCE(available_free_hours, 0) - $1
           WHERE id = $2`,
          [actualFreeHoursUsed, customer_id]
        );
        console.log(
          `✅ Descontadas ${actualFreeHoursUsed} horas gratis del cliente ${customer_id}`
        );
      }
    }

    const query = `
      INSERT INTO reservations (
        field_id,
        customer_id,
        date,
        start_time,
        end_time,
        subtotal,
        discount,
        total_price,
        advance_payment,
        remaining_payment,
        payment_method,
        payment_status,
        payment_voucher_url,
        status,
        type,
        hours,
        coupon_id,
        coupon_discount,
        free_hours_used,
        free_hours_discount,
        user_id_registration,
        date_time_registration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await client.query(query, [
      field_id,
      customer_id,
      date,
      start_time,
      end_time,
      subtotal,
      discount,
      total_price,
      advance_payment,
      remaining_payment,
      payment_method,
      payment_status,
      payment_voucher_url,
      status,
      type,
      hours,
      coupon_id,
      coupon_discount,
      actualFreeHoursUsed,
      actualFreeHoursDiscount,
      user_id_registration,
    ]);

    const newReservationId = result.rows[0].id;

    // Obtener la reserva completa con los JOINs para incluir field_name y customer_name
    const fullReservation = await client.query(
      `
      SELECT
        r.*,
        f.name AS field_name,
        c.name AS customer_name,
        c.phone_number AS customer_phone
      FROM reservations r
      LEFT JOIN fields f ON r.field_id = f.id
      LEFT JOIN customers c ON r.customer_id = c.id
      WHERE r.id = $1
    `,
      [newReservationId]
    );

    await client.query('COMMIT');

    return fullReservation.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Actualizar una reserva con bloqueo optimista para prevenir race conditions
 * @param {number} id - ID de la reserva
 * @param {Object} reservationData - Datos a actualizar
 * @returns {Promise<Object|null>} Reserva actualizada o null
 */
const updateReservation = async (id, reservationData) => {
  const {
    date,
    start_time,
    end_time,
    subtotal,
    discount,
    total_price,
    advance_payment,
    remaining_payment,
    payment_method,
    payment_status,
    payment_voucher_url,
    status,
    hours,
    user_id_modification,
    approved_by,
    approved_at,
    rejected_by,
    rejected_at,
    expected_status, // Para bloqueo optimista
  } = reservationData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // BLOQUEO OPTIMISTA: Verificar que el estado no haya cambiado
    // Esto previene que dos admins aprueben simultáneamente la misma reserva
    if (expected_status) {
      const checkQuery = `
        SELECT status, date_time_modification
        FROM reservations
        WHERE id = $1
        FOR UPDATE
      `;
      const checkResult = await client.query(checkQuery, [id]);

      if (checkResult.rows.length === 0) {
        throw new Error('RESERVATION_NOT_FOUND');
      }

      const currentStatus = checkResult.rows[0].status;

      // Validación crítica: solo se puede aprobar si está en estado 'pending'
      if (status === 'confirmed' && currentStatus !== 'pending') {
        throw new Error(
          `INVALID_STATE_TRANSITION: No se puede aprobar una reserva en estado '${currentStatus}'. Solo se pueden aprobar reservas 'pending'.`
        );
      }

      // Validación de estado esperado (optimistic locking)
      if (currentStatus !== expected_status) {
        throw new Error(
          `CONCURRENT_MODIFICATION: La reserva cambió de estado '${expected_status}' a '${currentStatus}'. Otra persona modificó la reserva.`
        );
      }
    }

    // Actualizar la reserva
    const query = `
      UPDATE reservations
      SET date = COALESCE($1, date),
          start_time = COALESCE($2, start_time),
          end_time = COALESCE($3, end_time),
          subtotal = COALESCE($4, subtotal),
          discount = COALESCE($5, discount),
          total_price = COALESCE($6, total_price),
          advance_payment = COALESCE($7, advance_payment),
          remaining_payment = COALESCE($8, remaining_payment),
          payment_method = COALESCE($9, payment_method),
          payment_status = COALESCE($10, payment_status),
          payment_voucher_url = COALESCE($11, payment_voucher_url),
          status = COALESCE($12, status),
          hours = COALESCE($13, hours),
          approved_by = COALESCE($14, approved_by),
          approved_at = COALESCE($15, approved_at),
          rejected_by = COALESCE($16, rejected_by),
          rejected_at = COALESCE($17, rejected_at),
          user_id_modification = $18,
          date_time_modification = CURRENT_TIMESTAMP
      WHERE id = $19
      RETURNING *
    `;

    const result = await client.query(query, [
      date,
      start_time,
      end_time,
      subtotal,
      discount,
      total_price,
      advance_payment,
      remaining_payment,
      payment_method,
      payment_status,
      payment_voucher_url,
      status,
      hours,
      approved_by,
      approved_at,
      rejected_by,
      rejected_at,
      user_id_modification,
      id,
    ]);

    await client.query('COMMIT');
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Cancelar una reserva
 * @param {number} id - ID de la reserva
 * @param {Object} cancellationData - Datos de la cancelación
 * @returns {Promise<Object|null>} Reserva cancelada o null
 */
const cancelReservation = async (id, cancellationData) => {
  const {
    cancelled_by,
    cancellation_reason,
    advance_kept = 0,
    lost_revenue = 0,
    user_id_modification,
  } = cancellationData;

  const query = `
    UPDATE reservations
    SET status = 'cancelled',
        cancelled_by = $1,
        cancellation_reason = $2,
        advance_kept = $3,
        lost_revenue = $4,
        cancelled_at = CURRENT_TIMESTAMP,
        user_id_modification = $5,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `;

  const result = await pool.query(query, [
    cancelled_by,
    cancellation_reason,
    advance_kept,
    lost_revenue,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Completar una reserva (marca como completada y paga el saldo restante)
 * @param {number} id - ID de la reserva
 * @param {number} user_id_modification - ID del usuario que realiza la acción
 * @returns {Promise<Object|null>} Reserva completada o null
 */
const completeReservation = async (id, user_id_modification) => {
  // 1. Completar la reserva
  const query = `
    UPDATE reservations
    SET status = 'completed',
        payment_status = 'fully_paid',
        advance_payment = total_price,
        remaining_payment = 0,
        completed_at = CURRENT_TIMESTAMP,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  const completedReservation = result.rows.length > 0 ? result.rows[0] : null;

  if (completedReservation && completedReservation.customer_id) {
    // 2. Actualizar stats del cliente: total_hours, total_reservations, total_spent
    const hoursToAdd = parseFloat(completedReservation.hours) || 1;
    const amountSpent = parseFloat(completedReservation.total_price) || 0;

    const updateCustomerQuery = `
      UPDATE customers
      SET total_hours = COALESCE(total_hours, 0) + $1,
          accumulated_hours = COALESCE(accumulated_hours, 0) + $1,
          total_reservations = COALESCE(total_reservations, 0) + 1,
          total_spent = COALESCE(total_spent, 0) + $4,
          user_id_modification = $2,
          date_time_modification = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING total_hours, accumulated_hours, total_reservations, total_spent
    `;

    await pool.query(updateCustomerQuery, [
      hoursToAdd,
      user_id_modification,
      completedReservation.customer_id,
      amountSpent,
    ]);

    // Nota: Las horas gratis ahora se obtienen manualmente canjeando promociones
    // El cliente acumula horas en accumulated_hours y cuando canjea se resetea a 0

    // 3. Verificar y asignar insignias automáticamente
    try {
      const newBadges = await checkAndAssignBadges(
        completedReservation.customer_id,
        user_id_modification
      );
      if (newBadges.length > 0) {
        console.log(
          `🏆 ${newBadges.length} insignia(s) nueva(s) asignada(s) al cliente ${completedReservation.customer_id}`
        );
      }
    } catch (badgeError) {
      // No fallar la operación principal si hay error en insignias
      console.error('Error asignando insignias:', badgeError);
    }
  }

  return completedReservation;
};

/**
 * Marcar una reserva como no show
 * @param {number} id - ID de la reserva
 * @param {number} user_id_modification - ID del usuario que realiza la acción
 * @returns {Promise<Object|null>} Reserva marcada como no show o null
 */
const markAsNoShow = async (id, user_id_modification) => {
  const query = `
    UPDATE reservations
    SET status = 'no_show',
        payment_status = 'no_show',
        no_show_date = CURRENT_TIMESTAMP,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Verificar disponibilidad de una cancha en una fecha y hora
 * @param {number} fieldId - ID de la cancha
 * @param {string} date - Fecha
 * @param {string} startTime - Hora de inicio
 * @param {string} endTime - Hora de fin
 * @param {number|null} excludeReservationId - ID de reserva a excluir (para updates)
 * @returns {Promise<boolean>} True si está disponible
 */
const checkAvailability = async (
  fieldId,
  date,
  startTime,
  endTime,
  excludeReservationId = null
) => {
  let query = `
    SELECT id
    FROM reservations
    WHERE field_id = $1
      AND date = $2
      AND status NOT IN ('cancelled', 'no_show')
      AND (
        (start_time < $4 AND end_time > $3)
      )
  `;

  const params = [fieldId, date, startTime, endTime];

  if (excludeReservationId) {
    query += ` AND id != $5`;
    params.push(excludeReservationId);
  }

  const result = await pool.query(query, params);
  return result.rows.length === 0; // True si no hay conflictos
};

/**
 * Obtener estadísticas de reservas por cancha
 * @param {number} fieldId - ID de la cancha
 * @returns {Promise<Object>} Estadísticas
 */
const getReservationStatsByField = async fieldId => {
  const query = `
    SELECT
      COUNT(*) AS total_reservations,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed_reservations,
      COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_reservations,
      COUNT(*) FILTER (WHERE status = 'no_show') AS no_show_reservations,
      COALESCE(SUM(total_price), 0) AS total_revenue,
      COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'fully_paid'), 0) AS total_paid,
      COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'pending'), 0) AS total_pending
    FROM reservations
    WHERE field_id = $1
  `;

  const result = await pool.query(query, [fieldId]);
  return result.rows[0];
};

/**
 * Obtener estadísticas generales de reservas para el dashboard de métricas
 * @param {Object} filters - Filtros opcionales (date_from, date_to, field_ids, admin_id)
 * @returns {Promise<Object>} Estadísticas del dashboard
 */
const getDashboardMetrics = async (filters = {}) => {
  let baseWhere = `WHERE r.status != 'cancelled'`;
  const params = [];
  let paramCount = 1;

  // Filtro por rango de fechas
  if (filters.date_from) {
    baseWhere += ` AND r.date >= $${paramCount}`;
    params.push(filters.date_from);
    paramCount++;
  }

  if (filters.date_to) {
    baseWhere += ` AND r.date <= $${paramCount}`;
    params.push(filters.date_to);
    paramCount++;
  }

  // Filtro por canchas específicas (array de IDs)
  if (filters.field_ids && filters.field_ids.length > 0) {
    baseWhere += ` AND r.field_id = ANY($${paramCount})`;
    params.push(filters.field_ids);
    paramCount++;
  }

  // Filtro por admin_id (obtener canchas del admin)
  if (filters.admin_id) {
    baseWhere += ` AND f.admin_id = $${paramCount}`;
    params.push(filters.admin_id);
    paramCount++;
  }

  const query = `
    SELECT
      -- Métricas generales
      COUNT(DISTINCT r.id) AS total_reservations,
      COUNT(DISTINCT r.customer_id) AS unique_clients,
      COALESCE(SUM(r.hours), 0) AS total_hours,

      -- Ingresos (solo reservas pagadas o parcialmente pagadas)
      COALESCE(SUM(
        CASE
          WHEN r.payment_status = 'fully_paid' THEN r.total_price
          WHEN r.payment_status IN ('partially_paid', 'partial') THEN r.advance_payment
          ELSE 0
        END
      ), 0) AS total_income,

      -- Reservas por estado
      COUNT(*) FILTER (WHERE r.status = 'completed') AS completed_reservations,
      COUNT(*) FILTER (WHERE r.status = 'confirmed') AS confirmed_reservations,
      COUNT(*) FILTER (WHERE r.status = 'pending') AS pending_reservations,
      COUNT(*) FILTER (WHERE r.status = 'no_show') AS no_show_reservations,

      -- Promedio de duración
      COALESCE(AVG(r.hours), 0) AS avg_duration

    FROM reservations r
    LEFT JOIN fields f ON r.field_id = f.id
    ${baseWhere}
  `;

  const result = await pool.query(query, params);
  return result.rows[0];
};

/**
 * Obtener rendimiento por cancha para el dashboard
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Rendimiento por cancha
 */
const getFieldPerformanceMetrics = async (filters = {}) => {
  // Query simplificada para evitar problemas con los parámetros
  const simpleQuery = `
    SELECT
      f.id AS field_id,
      f.name AS field_name,
      COUNT(r.id) AS reservations,
      COALESCE(SUM(
        CASE
          WHEN r.payment_status = 'fully_paid' THEN r.total_price
          WHEN r.payment_status IN ('partially_paid', 'partial') THEN r.advance_payment
          ELSE 0
        END
      ), 0) AS income,
      COALESCE(SUM(r.hours), 0) AS total_hours
    FROM fields f
    LEFT JOIN reservations r ON f.id = r.field_id
      AND r.status != 'cancelled'
      ${filters.date_from ? `AND r.date >= '${filters.date_from}'` : ''}
      ${filters.date_to ? `AND r.date <= '${filters.date_to}'` : ''}
    WHERE f.is_active = true
    ${filters.field_ids && filters.field_ids.length > 0 ? `AND f.id = ANY(ARRAY[${filters.field_ids.join(',')}])` : ''}
    ${filters.admin_id ? `AND f.admin_id = ${filters.admin_id}` : ''}
    GROUP BY f.id, f.name
    ORDER BY income DESC
  `;

  const result = await pool.query(simpleQuery);
  return result.rows;
};

/**
 * Obtener horarios más demandados
 */
const getPeakHoursMetrics = async (filters = {}) => {
  let baseWhere = `WHERE r.status != 'cancelled'`;
  const params = [];
  let paramCount = 1;

  if (filters.date_from) {
    baseWhere += ` AND r.date >= $${paramCount}`;
    params.push(filters.date_from);
    paramCount++;
  }

  if (filters.date_to) {
    baseWhere += ` AND r.date <= $${paramCount}`;
    params.push(filters.date_to);
    paramCount++;
  }

  if (filters.field_ids && filters.field_ids.length > 0) {
    baseWhere += ` AND r.field_id = ANY($${paramCount})`;
    params.push(filters.field_ids);
    paramCount++;
  }

  if (filters.admin_id) {
    baseWhere += ` AND f.admin_id = $${paramCount}`;
    params.push(filters.admin_id);
    paramCount++;
  }

  const query = `
    SELECT
      r.start_time AS hour,
      COUNT(*) AS count
    FROM reservations r
    LEFT JOIN fields f ON r.field_id = f.id
    ${baseWhere}
    GROUP BY r.start_time
    ORDER BY count DESC
    LIMIT 5
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener slots ocupados de una cancha para una fecha específica
 * PÚBLICO: No requiere autenticación, solo devuelve horarios (sin datos sensibles)
 * @param {number} fieldId - ID de la cancha
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @returns {Promise<Array>} Lista de slots ocupados con start_time y end_time
 */
const getOccupiedSlotsByFieldAndDate = async (fieldId, date) => {
  const query = `
    SELECT
      start_time,
      end_time
    FROM reservations
    WHERE field_id = $1
      AND date = $2
      AND status NOT IN ('cancelled', 'no_show', 'rejected')
    ORDER BY start_time ASC
  `;

  const result = await pool.query(query, [fieldId, date]);
  return result.rows;
};

module.exports = {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservation,
  cancelReservation,
  completeReservation,
  markAsNoShow,
  checkAvailability,
  getReservationStatsByField,
  getDashboardMetrics,
  getFieldPerformanceMetrics,
  getPeakHoursMetrics,
  getOccupiedSlotsByFieldAndDate,
};
