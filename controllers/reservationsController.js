const {
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
} = require('../models/reservationsModel');
const { transformReservationToCamelCase } = require('../utils/transformers');
const { getFieldById } = require('../models/fieldsModel');
const { createAlert } = require('../models/alertsModel');
const { calculateFinalPrice } = require('../utils/pricingCalculator');
const pool = require('../config/db');
const { uploadFile } = require('../services/wasabiService');

/**
 * Obtener todas las reservas con filtros
 * SEGURIDAD: Los admins de cancha solo ven reservas de SUS canchas
 */
const getReservations = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id ? parseInt(req.query.field_id) : null,
      customer_id: req.query.customer_id ? parseInt(req.query.customer_id) : null,
      date: req.query.date,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      status: req.query.status,
      payment_status: req.query.payment_status,
      type: req.query.type,
    };

    // SEGURIDAD CRÍTICA: Aplicar filtro por admin_id automáticamente
    // Si el usuario es 'admin' (field admin), solo puede ver reservas de SUS canchas
    // Super admins pueden ver todas las reservas
    // NOTA: Usamos id_rol (numérico) para consistencia con el resto del codebase
    // id_rol: 1 = super_admin, 2 = admin, 3 = cliente
    const userRole = req.user?.id_rol;
    const userId = req.user?.id;

    if (userRole === 2 && userId) {
      // Admin de cancha (id_rol = 2): filtrar por sus canchas
      filters.admin_id = userId;
    } else if (userRole === 1) {
      // Super admin (id_rol = 1): puede ver todas las reservas
    } else if (!userRole) {
      // Sin autenticación: error
      return res.status(401).json({
        success: false,
        error: 'No autorizado - Se requiere autenticación',
      });
    }

    const reservations = await getAllReservations(filters);

    // Transformar a camelCase para el frontend
    const reservationsFormatted = reservations.map(r => transformReservationToCamelCase(r));

    res.json({
      success: true,
      data: reservationsFormatted,
      count: reservationsFormatted.length,
    });
  } catch (error) {
    console.error('Error al obtener reservas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reservas',
    });
  }
};

/**
 * Obtener una reserva por ID
 */
const getReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await getReservationById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada',
      });
    }

    // Transformar a camelCase para el frontend
    const reservationFormatted = transformReservationToCamelCase(reservation);

    res.json({
      success: true,
      data: reservationFormatted,
    });
  } catch (error) {
    console.error('Error al obtener reserva:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reserva',
    });
  }
};

/**
 * Crear una nueva reserva
 */
const createNewReservation = async (req, res) => {
  try {
    // 🔍 DEBUG: Ver qué datos están llegando
    console.log('📥 [createNewReservation] Body recibido:', JSON.stringify(req.body, null, 2));

    // Variables que NO se reasignan
    const {
      field_id,
      date,
      start_time,
      end_time,
      payment_method,
      payment_status,
      payment_voucher_url,
      type,
      hours,
      coupon_id,
      coupon_discount,
      free_hours_used,
      free_hours_discount,
      user_id, // ID del usuario autenticado (si aplica)
      // ✅ phone_number no se usa - viene de la tabla customers
    } = req.body;

    // Variables que SÍ se reasignan
    let { customer_id, subtotal, discount, total_price } = req.body;

    // Si no tenemos customer_id pero tenemos user_id, buscar el customer asociado
    if (!customer_id && (user_id || req.user?.id)) {
      const pool = require('../config/db');
      const userIdToUse = user_id || req.user?.id;
      const customerResult = await pool.query(
        'SELECT id FROM customers WHERE user_id = $1 AND status = $2 LIMIT 1',
        [userIdToUse, 'active']
      );
      if (customerResult.rows.length > 0) {
        customer_id = customerResult.rows[0].id;
        console.log(`✅ Customer ID encontrado para user ${userIdToUse}: ${customer_id}`);
      }
    }

    // 🔍 DEBUG: Verificar cada campo individualmente
    const camposFaltantes = [];
    if (!field_id) camposFaltantes.push('field_id');
    if (!customer_id) camposFaltantes.push('customer_id');
    if (!date) camposFaltantes.push('date');
    if (!start_time) camposFaltantes.push('start_time');
    if (!end_time) camposFaltantes.push('end_time');
    if (!total_price && total_price !== 0) camposFaltantes.push('total_price');
    if (!hours && hours !== 0) camposFaltantes.push('hours');

    console.log('🔍 Validación de campos:', {
      field_id: field_id ?? 'UNDEFINED',
      customer_id: customer_id ?? 'UNDEFINED',
      date: date ?? 'UNDEFINED',
      start_time: start_time ?? 'UNDEFINED',
      end_time: end_time ?? 'UNDEFINED',
      total_price: total_price ?? 'UNDEFINED',
      hours: hours ?? 'UNDEFINED',
      camposFaltantes: camposFaltantes.length > 0 ? camposFaltantes : 'NINGUNO',
    });

    // Validaciones básicas
    if (camposFaltantes.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Faltan campos requeridos: ${camposFaltantes.join(', ')}`,
      });
    }

    // Obtener información de la cancha para asignar admin_id
    const field = await getFieldById(field_id);
    if (!field) {
      return res.status(404).json({
        success: false,
        error: 'Cancha no encontrada',
      });
    }

    // ============================================
    // 🔒 VALIDACIÓN: Verificar que la cancha esté activa y aprobada
    // ============================================
    if (!field.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Esta cancha no está activa actualmente. Por favor, selecciona otra cancha.',
        code: 'FIELD_INACTIVE',
      });
    }

    if (field.approval_status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Esta cancha aún no ha sido aprobada para recibir reservas.',
        code: 'FIELD_NOT_APPROVED',
      });
    }

    // ============================================
    // 💰 LÓGICA DE ADELANTO PARA SEPARAR
    // Adelanto = adelanto por hora * cantidad de horas
    // ============================================
    const isCashPayment = payment_method === 'efectivo' || payment_method === 'cash';
    const fieldRequiresAdvance = field.requires_advance_payment === true;
    const fieldAdvancePerHour = parseFloat(field.advance_payment_amount) || 0;
    const reservedHours = parseFloat(hours) || 1;

    // Calcular adelanto total = adelanto por hora * horas reservadas
    const calculatedAdvanceTotal = fieldAdvancePerHour * reservedHours;

    // Calcular adelanto y saldo según reglas de negocio
    let calculatedAdvancePayment = 0;
    let calculatedRemainingPayment = parseFloat(total_price) || 0;

    if (fieldRequiresAdvance && !isCashPayment && total_price > 0) {
      // Cancha requiere adelanto Y cliente NO paga efectivo
      // Adelanto = adelanto por hora * horas (sin exceder el total)
      calculatedAdvancePayment = Math.min(calculatedAdvanceTotal, parseFloat(total_price) || 0);
      calculatedRemainingPayment = (parseFloat(total_price) || 0) - calculatedAdvancePayment;
      console.log('💰 [ADELANTO] Cancha requiere adelanto:', {
        fieldAdvancePerHour,
        reservedHours,
        calculatedAdvanceTotal,
        calculatedAdvancePayment,
        calculatedRemainingPayment,
        paymentMethod: payment_method,
      });
    } else if (isCashPayment) {
      // Pago en efectivo: no requiere adelanto, paga todo en cancha
      calculatedAdvancePayment = 0;
      calculatedRemainingPayment = parseFloat(total_price) || 0;
      console.log('💵 [EFECTIVO] Sin adelanto - pago total en cancha:', calculatedRemainingPayment);
    }

    // Verificar disponibilidad
    const isAvailable = await checkAvailability(field_id, date, start_time, end_time);
    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        error: 'La cancha no está disponible en el horario seleccionado',
      });
    }

    // ============================================
    // 🔒 VALIDACIÓN CRÍTICA: Verificar precio considerando precios especiales
    // Previene manipulación de precios desde el frontend
    // ============================================
    const isAdminCreatingBooking =
      (req.user?.id_rol === 1 || req.user?.id_rol === 2) && type === 'admin_booking';

    // Solo validar precio para reservas de clientes (no admin)
    if (!isAdminCreatingBooking) {
      const pricePerHour = parseFloat(field.price_per_hour) || 0;
      const reservedHours = parseFloat(hours) || 0;

      // 0. Validar que la cancha tenga un precio configurado (solo si requiere pago adelantado)
      if (pricePerHour <= 0 && field.requires_advance_payment) {
        return res.status(400).json({
          success: false,
          error:
            'Esta cancha no tiene un precio configurado. Por favor, contacta al administrador.',
          code: 'FIELD_NO_PRICE',
        });
      }

      // 1. Calcular descuentos adicionales (horas gratis, cupones)
      let freeHoursToUse = 0;
      let couponDiscountToApply = 0;

      // 1a. Validar horas gratis con BD
      if (free_hours_used > 0 && customer_id) {
        const customerResult = await pool.query(
          'SELECT available_free_hours FROM customers WHERE id = $1',
          [customer_id]
        );

        if (customerResult.rows.length > 0) {
          const availableHours = parseFloat(customerResult.rows[0].available_free_hours) || 0;
          freeHoursToUse = Math.min(parseFloat(free_hours_used), availableHours, reservedHours);
          console.log(
            `🎁 Horas gratis validadas: ${freeHoursToUse} (disponibles: ${availableHours})`
          );
        }
      }

      // 1b. Descuento por cupón
      if (coupon_id && coupon_discount > 0) {
        couponDiscountToApply = parseFloat(coupon_discount) || 0;
        console.log(`🎟️ Descuento por cupón: ${couponDiscountToApply}`);
      }

      // 2. Calcular precio esperado con precios especiales y descuentos adicionales
      const priceCalculation = await calculateFinalPrice(field, date, reservedHours, start_time, {
        freeHours: freeHoursToUse,
        couponDiscount: couponDiscountToApply,
      });

      const expectedTotalPrice = priceCalculation.finalPrice;
      const receivedTotalPrice = parseFloat(total_price) || 0;

      // 3. Validar con tolerancia de S/1.00 (por redondeos)
      const tolerance = 1.0;
      const priceDifference = Math.abs(receivedTotalPrice - expectedTotalPrice);

      console.log('💰 Validación de precio con precios especiales:', {
        pricePerHour,
        reservedHours,
        baseSubtotal: priceCalculation.baseSubtotal,
        specialPricingDiscount: priceCalculation.discountBreakdown.specialPricing,
        freeHoursDiscount: priceCalculation.discountBreakdown.freeHours,
        couponDiscount: priceCalculation.discountBreakdown.coupon,
        totalDiscount: priceCalculation.totalDiscount,
        expectedTotalPrice,
        receivedTotalPrice,
        priceDifference,
        isValid: priceDifference <= tolerance,
        appliedSpecialPricings: priceCalculation.appliedSpecialPricings,
      });

      if (priceDifference > tolerance) {
        console.error('🚨 ALERTA DE SEGURIDAD: Posible manipulación de precio detectada', {
          received: receivedTotalPrice,
          expected: expectedTotalPrice,
          difference: priceDifference,
          field_id,
          customer_id,
          ip: req.ip || req.connection?.remoteAddress,
        });

        return res.status(400).json({
          success: false,
          error: `El precio de la reserva no es válido. Precio esperado: S/${expectedTotalPrice.toFixed(2)}, recibido: S/${receivedTotalPrice.toFixed(2)}. Por favor, recarga la página e intenta nuevamente.`,
          code: 'PRICE_VALIDATION_FAILED',
        });
      }

      // 4. Sobrescribir con valores calculados (defensa en profundidad)
      subtotal = priceCalculation.baseSubtotal;
      discount = priceCalculation.totalDiscount;
      total_price = expectedTotalPrice;
      // Nota: remaining_payment se calcula con calculatedRemainingPayment en la lógica de adelanto
    }

    // ✅ TODAS LAS RESERVAS SE CONFIRMAN AUTOMÁTICAMENTE
    // El admin puede cancelar posteriormente si lo necesita
    const reservationStatus = 'confirmed';
    let finalPaymentStatus = payment_status || 'pending';

    // Determinar payment_status según el contexto
    const userIdRol = req.user?.id_rol;
    const isAdminCreating = (userIdRol === 2 || userIdRol === 1) && type === 'admin_booking';

    // ✅ CASO ESPECIAL: Reserva pagada completamente con horas gratis
    // Si total_price es 0 y se usaron horas gratis, la reserva está pagada
    const isFreeHoursPayment =
      (parseFloat(total_price) === 0 && parseFloat(free_hours_used) > 0) ||
      payment_method === 'free_hours';

    if (isFreeHoursPayment) {
      // Reserva cubierta 100% por horas gratis: marcar como fully_paid
      finalPaymentStatus = 'fully_paid';
      console.log(
        '🎁 [RESERVA] Pagada con horas gratis - status: confirmed, payment_status: fully_paid'
      );
    } else if (isAdminCreating) {
      // Admin crea: mantener el payment_status que envía
      console.log(
        '✅ [RESERVA] Creada por admin - status: confirmed, payment_status:',
        payment_status
      );
    } else if (payment_voucher_url && !isCashPayment) {
      // Cliente con voucher: pago pendiente de verificación
      finalPaymentStatus = 'pending';
      console.log('✅ [RESERVA] Cliente con voucher - status: confirmed, payment_status: pending');
    } else {
      // Cliente sin voucher (efectivo): pago pendiente
      finalPaymentStatus = 'pending';
      console.log(
        '✅ [RESERVA] Cliente (efectivo/sin voucher) - status: confirmed, payment_status: pending'
      );
    }

    const reservationData = {
      field_id,
      customer_id,
      date,
      start_time,
      end_time,
      subtotal,
      discount,
      total_price,
      advance_payment: calculatedAdvancePayment, // ✅ Usar adelanto calculado
      remaining_payment: calculatedRemainingPayment, // ✅ Usar saldo calculado
      payment_method,
      payment_status: finalPaymentStatus, // ✅ Usar el payment_status calculado
      payment_voucher_url,
      status: reservationStatus, // ✅ Usar el status calculado
      type,
      hours,
      coupon_id,
      coupon_discount,
      free_hours_used: free_hours_used || 0,
      free_hours_discount: free_hours_discount || 0,
      // ✅ phone_number NO va en reservations, está en customers
      user_id_registration: req.user?.id || field.admin_id || 1,
    };

    // Nota: El modelo createReservation ya se encarga de descontar las horas gratis del cliente
    const newReservation = await createReservation(reservationData);

    // Transformar a camelCase para el frontend
    const newReservationFormatted = transformReservationToCamelCase(newReservation);

    // ============================================
    // 🔔 CREAR ALERTAS DE NUEVA RESERVA
    // Notificar al admin de la cancha y a los super admins
    // ============================================
    try {
      // Obtener nombre del cliente
      const customerResult = await pool.query(
        'SELECT name, phone_number FROM customers WHERE id = $1',
        [customer_id]
      );
      const customerName =
        customerResult.rows[0]?.name || customerResult.rows[0]?.phone_number || 'Cliente';

      // Datos de la reserva para la alerta
      const reservationDataForAlert = JSON.stringify({
        reservationId: newReservation.id,
        customerName,
        fieldName: field.name,
        date,
        startTime: start_time,
        endTime: end_time,
        totalPrice: total_price,
        paymentMethod: payment_method,
        status: reservationStatus,
      });

      // Crear alerta para el admin dueño de la cancha
      if (field.admin_id) {
        await createAlert({
          type: 'new_reservation',
          title: 'Nueva reserva recibida',
          message: `${customerName} ha reservado la cancha "${field.name}" para el ${date} de ${start_time} a ${end_time}`,
          field_id,
          customer_id,
          reservation_id: newReservation.id,
          status: 'unread',
          priority: 'high',
          admin_id: field.admin_id,
          reservation_data: reservationDataForAlert,
          user_id_registration: req.user?.id || 1,
        });
        console.log(`✅ Alerta creada para admin de cancha (ID: ${field.admin_id})`);
      }

      // Crear alertas para todos los super admins
      const superAdminsResult = await pool.query(
        'SELECT id FROM users WHERE role_id = 1 AND is_active = true AND status = $1',
        ['active']
      );

      for (const superAdmin of superAdminsResult.rows) {
        // Evitar duplicar si el admin de la cancha es también super admin
        if (superAdmin.id !== field.admin_id) {
          await createAlert({
            type: 'new_reservation',
            title: 'Nueva reserva recibida',
            message: `${customerName} ha reservado la cancha "${field.name}" para el ${date} de ${start_time} a ${end_time}`,
            field_id,
            customer_id,
            reservation_id: newReservation.id,
            status: 'unread',
            priority: 'high',
            admin_id: superAdmin.id,
            reservation_data: reservationDataForAlert,
            user_id_registration: req.user?.id || 1,
          });
          console.log(`✅ Alerta creada para super admin (ID: ${superAdmin.id})`);
        }
      }
    } catch (alertError) {
      // No fallar la reserva si las alertas fallan
      console.error('⚠️ Error creando alertas de reserva:', alertError);
    }

    res.status(201).json({
      success: true,
      message: 'Reserva creada exitosamente',
      data: newReservationFormatted,
    });
  } catch (error) {
    console.error('Error al crear reserva:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear reserva',
    });
  }
};

/**
 * Actualizar una reserva
 * SEGURIDAD: Incluye validaciones de estado y bloqueo optimista
 */
const updateExistingReservation = async (req, res) => {
  try {
    const { id } = req.params;
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
      expected_status, // Para bloqueo optimista
    } = req.body;

    // Verificar si la reserva existe
    const existingReservation = await getReservationById(id);
    if (!existingReservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada',
      });
    }

    // SEGURIDAD: Verificar que el admin tenga permiso para modificar esta reserva
    // id_rol: 1 = super_admin, 2 = admin
    const userRole = req.user?.id_rol;
    const userId = req.user?.id;

    if (userRole === 2) {
      // Verificar que la cancha pertenezca a este admin
      const field = await getFieldById(existingReservation.field_id);
      if (field.admin_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'No autorizado - No puedes modificar reservas de otras canchas',
        });
      }
    }

    // Si se está actualizando fecha u horario, verificar disponibilidad
    if (date || start_time || end_time) {
      const checkDate = date || existingReservation.date;
      const checkStartTime = start_time || existingReservation.start_time;
      const checkEndTime = end_time || existingReservation.end_time;

      const isAvailable = await checkAvailability(
        existingReservation.field_id,
        checkDate,
        checkStartTime,
        checkEndTime,
        id
      );

      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          error: 'La cancha no está disponible en el nuevo horario seleccionado',
        });
      }
    }

    const reservationData = {
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
      user_id_modification: userId || 1,
      expected_status, // Para bloqueo optimista
    };

    // Si se está aprobando la reserva, agregar campos de auditoría
    if (status === 'confirmed') {
      reservationData.approved_by = userId;
      reservationData.approved_at = new Date();
    }

    // Si se está rechazando la reserva, agregar campos de auditoría
    if (status === 'rejected') {
      reservationData.rejected_by = userId;
      reservationData.rejected_at = new Date();
    }

    const updatedReservation = await updateReservation(id, reservationData);

    // Transformar a camelCase para el frontend
    const updatedReservationFormatted = transformReservationToCamelCase(updatedReservation);

    res.json({
      success: true,
      message: 'Reserva actualizada exitosamente',
      data: updatedReservationFormatted,
    });
  } catch (error) {
    console.error('Error al actualizar reserva:', error);

    // Manejo de errores específicos
    if (error.message?.includes('INVALID_STATE_TRANSITION')) {
      return res.status(409).json({
        success: false,
        error: error.message.replace('INVALID_STATE_TRANSITION: ', ''),
        code: 'INVALID_STATE',
      });
    }

    if (error.message?.includes('CONCURRENT_MODIFICATION')) {
      return res.status(409).json({
        success: false,
        error: error.message.replace('CONCURRENT_MODIFICATION: ', ''),
        code: 'CONCURRENT_MODIFICATION',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al actualizar reserva',
    });
  }
};

/**
 * Cancelar una reserva
 */
const cancelReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancelled_by, cancellation_reason, advance_kept, lost_revenue } = req.body;

    // Verificar si la reserva existe
    const existingReservation = await getReservationById(id);
    if (!existingReservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada',
      });
    }

    // Verificar que la reserva pueda ser cancelada
    if (existingReservation.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'La reserva ya está cancelada',
      });
    }

    if (existingReservation.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar una reserva completada',
      });
    }

    const cancellationData = {
      cancelled_by,
      cancellation_reason,
      advance_kept,
      lost_revenue,
      user_id_modification: req.user?.id || 1,
    };

    const cancelledReservation = await cancelReservation(id, cancellationData);

    res.json({
      success: true,
      message: 'Reserva cancelada exitosamente',
      data: cancelledReservation,
    });
  } catch (error) {
    console.error('Error al cancelar reserva:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cancelar reserva',
    });
  }
};

/**
 * Completar una reserva
 */
const completeReservationById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la reserva existe
    const existingReservation = await getReservationById(id);
    if (!existingReservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada',
      });
    }

    // Verificar que la reserva pueda ser completada
    if (existingReservation.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'La reserva ya está completada',
      });
    }

    if (existingReservation.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'No se puede completar una reserva cancelada',
      });
    }

    // ============================================
    // 🕐 VALIDACIÓN: La hora de la reserva debe haber llegado
    // ============================================
    // Parsear la fecha correctamente en zona horaria local
    // new Date('YYYY-MM-DD') interpreta en UTC, lo cual causa bugs de timezone
    const dateStr = existingReservation.date.split('T')[0];
    const dateParts = dateStr.split('-');
    const startTimeStr = existingReservation.start_time || '00:00';
    const timeParts = startTimeStr.split(':');
    const startHours = parseInt(timeParts[0], 10) || 0;
    const startMinutes = parseInt(timeParts[1], 10) || 0;

    const reservationDate = new Date(
      parseInt(dateParts[0], 10),
      parseInt(dateParts[1], 10) - 1,
      parseInt(dateParts[2], 10),
      startHours,
      startMinutes,
      0,
      0
    );

    const now = new Date();
    if (now < reservationDate) {
      const diffMs = reservationDate - now;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      return res.status(400).json({
        success: false,
        error: `No se puede completar la reserva antes de su hora programada. Faltan ${diffHours}h ${diffMins}min`,
        code: 'RESERVATION_NOT_STARTED',
      });
    }

    const user_id = req.user?.id || 1;
    const completedReservation = await completeReservation(id, user_id);

    res.json({
      success: true,
      message: 'Reserva completada exitosamente',
      data: completedReservation,
    });
  } catch (error) {
    console.error('❌ Error al completar reserva:', error);
    console.error('❌ Error completo:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Error al completar reserva',
      details: error.message, // ✅ Enviar detalles del error en desarrollo
    });
  }
};

/**
 * Marcar una reserva como no show
 */
const markReservationAsNoShow = async (req, res) => {
  try {
    const { id } = req.params;
    const { shouldRefund, refundAmount } = req.body;

    // Verificar si la reserva existe
    const existingReservation = await getReservationById(id);
    if (!existingReservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada',
      });
    }

    // ============================================
    // 🕐 VALIDACIÓN: La hora de la reserva debe haber llegado
    // ============================================
    // Parsear la fecha correctamente en zona horaria local
    // new Date('YYYY-MM-DD') interpreta en UTC, lo cual causa bugs de timezone
    const dateStr = existingReservation.date.split('T')[0];
    const dateParts = dateStr.split('-');
    const startTimeStr = existingReservation.start_time || '00:00';
    const timeParts = startTimeStr.split(':');
    const startHours = parseInt(timeParts[0], 10) || 0;
    const startMinutes = parseInt(timeParts[1], 10) || 0;

    const reservationDate = new Date(
      parseInt(dateParts[0], 10),
      parseInt(dateParts[1], 10) - 1,
      parseInt(dateParts[2], 10),
      startHours,
      startMinutes,
      0,
      0
    );

    const now = new Date();
    if (now < reservationDate) {
      const diffMs = reservationDate - now;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      return res.status(400).json({
        success: false,
        error: `No se puede marcar no-show antes de la hora programada. Faltan ${diffHours}h ${diffMins}min`,
        code: 'RESERVATION_NOT_STARTED',
      });
    }

    const user_id = req.user?.id || 1;
    const noShowReservation = await markAsNoShow(id, user_id);

    // Si se debe crear un reembolso, crearlo en la tabla refunds
    let refundCreated = null;
    if (shouldRefund && refundAmount > 0) {
      const { createRefund } = require('../models/refundsModel');

      refundCreated = await createRefund({
        reservation_id: parseInt(id),
        customer_id: existingReservation.customer_id,
        customer_name: existingReservation.customer_name,
        phone_number: existingReservation.phone_number,
        field_id: existingReservation.field_id,
        refund_amount: refundAmount,
        status: 'pending',
        cancelled_at: new Date(),
        cancellation_reason: 'Cliente no se presentó - Devolución de adelanto',
        user_id_registration: user_id,
      });
    }

    res.json({
      success: true,
      message: 'Reserva marcada como no show exitosamente',
      data: noShowReservation,
      refund: refundCreated,
    });
  } catch (error) {
    console.error('Error al marcar reserva como no show:', error);
    res.status(500).json({
      success: false,
      error: 'Error al marcar reserva como no show',
    });
  }
};

/**
 * Verificar disponibilidad de una cancha
 */
const checkFieldAvailability = async (req, res) => {
  try {
    const { field_id, date, start_time, end_time } = req.query;

    if (!field_id || !date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren los parámetros: field_id, date, start_time, end_time',
      });
    }

    const isAvailable = await checkAvailability(parseInt(field_id), date, start_time, end_time);

    res.json({
      success: true,
      available: isAvailable,
      message: isAvailable
        ? 'Cancha disponible'
        : 'Cancha no disponible en el horario seleccionado',
    });
  } catch (error) {
    console.error('Error al verificar disponibilidad:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar disponibilidad',
    });
  }
};

/**
 * Obtener estadísticas de reservas por cancha
 */
const getFieldStats = async (req, res) => {
  try {
    const { field_id } = req.params;

    const stats = await getReservationStatsByField(parseInt(field_id));

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
    });
  }
};

/**
 * Obtener métricas del dashboard
 * Endpoint para obtener estadísticas de reservas para el panel de métricas
 */
const getMetrics = async (req, res) => {
  try {
    const { date_from, date_to, field_ids, admin_id } = req.query;

    const filters = {
      date_from,
      date_to,
      field_ids: field_ids ? field_ids.split(',').map(Number) : null,
      admin_id: admin_id ? parseInt(admin_id) : null,
    };

    // Obtener métricas generales
    const metrics = await getDashboardMetrics(filters);

    // Obtener rendimiento por cancha
    const fieldPerformance = await getFieldPerformanceMetrics(filters);

    // Obtener horarios más demandados
    const peakHours = await getPeakHoursMetrics(filters);

    res.json({
      success: true,
      data: {
        totalReservations: parseInt(metrics.total_reservations) || 0,
        uniqueClients: parseInt(metrics.unique_clients) || 0,
        totalIncome: parseFloat(metrics.total_income) || 0,
        totalHours: parseFloat(metrics.total_hours) || 0,
        avgDuration: parseFloat(metrics.avg_duration) || 0,
        completedReservations: parseInt(metrics.completed_reservations) || 0,
        confirmedReservations: parseInt(metrics.confirmed_reservations) || 0,
        pendingReservations: parseInt(metrics.pending_reservations) || 0,
        noShowReservations: parseInt(metrics.no_show_reservations) || 0,
        fieldPerformance: fieldPerformance.map(f => ({
          fieldId: f.field_id,
          name: f.field_name,
          reservations: parseInt(f.reservations) || 0,
          income: parseFloat(f.income) || 0,
          totalHours: parseFloat(f.total_hours) || 0,
        })),
        peakHours: peakHours.map(h => ({
          hour: h.hour,
          count: parseInt(h.count) || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error al obtener métricas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas del dashboard',
    });
  }
};

/**
 * Subir voucher de pago
 * Endpoint público para que los clientes suban su comprobante de pago
 */
const uploadPaymentVoucher = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se ha proporcionado ningun archivo',
      });
    }

    // Subir voucher a Wasabi
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const result = await uploadFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      folder: 'vouchers',
      customFilename: `voucher-${uniqueSuffix}`,
    });

    console.log('Voucher subido a Wasabi exitosamente:', {
      filename: result.filename,
      originalName: req.file.originalname,
      size: result.size,
      url: result.url,
    });

    res.json({
      success: true,
      message: 'Voucher subido exitosamente',
      data: {
        url: result.url,
        filename: result.filename,
        originalName: req.file.originalname,
        size: result.size,
      },
    });
  } catch (error) {
    console.error('Error al subir voucher:', error);
    res.status(500).json({
      success: false,
      error: 'Error al subir el voucher',
    });
  }
};

module.exports = {
  getReservations,
  getReservation,
  createNewReservation,
  updateExistingReservation,
  cancelReservationById,
  completeReservationById,
  markReservationAsNoShow,
  checkFieldAvailability,
  getFieldStats,
  uploadPaymentVoucher,
  getMetrics,
};
