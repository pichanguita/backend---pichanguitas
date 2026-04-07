/**
 * TRANSFORMERS - Convertir snake_case a camelCase
 *
 * Utili estos transformers para convertir los datos de la base de datos
 * (snake_case) al formato que espera el frontend (camelCase)
 */

/**
 * Convierte una fecha a formato YYYY-MM-DD de manera segura
 * Esto evita problemas de zona horaria al enviar fechas al frontend
 * @param {Date|string} date - Fecha a convertir
 * @returns {string|null} Fecha en formato YYYY-MM-DD o null si es inválida
 */
const toDateStringSafe = date => {
  if (!date) return null;

  // Si ya es string en formato YYYY-MM-DD, retornar directamente
  if (typeof date === 'string') {
    // Si tiene formato ISO completo (con T), extraer solo la fecha
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    // Si ya es YYYY-MM-DD, retornar tal cual
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
  }

  // Si es un objeto Date, extraer año, mes, día manualmente
  // para evitar problemas de zona horaria
  if (date instanceof Date && !isNaN(date.getTime())) {
    // Usar métodos UTC para evitar conversión de zona horaria
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Intentar parsear como fecha
  const parsed = new Date(date);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
};

/**
 * Extrae el valor numérico puro de un string que puede contener sufijos de unidad
 * Ej: "100m" → "100", "6400m²" → "6400", "50.5 m" → "50.5"
 * @param {string|null} value - Valor a limpiar
 * @returns {string|null} Valor numérico sin unidades, o null
 */
const stripDimensionUnit = value => {
  if (value == null) return null;
  const cleaned = value.toString().replace(/\s*(m²|m)\s*$/i, '').trim();
  return cleaned === '' ? null : cleaned;
};

/**
 * Transformar campo (field) de snake_case a camelCase
 * @param {Object} field - Campo en formato snake_case
 * @returns {Object} Campo en formato camelCase
 */
const transformFieldToCamelCase = field => {
  if (!field) return null;

  const transformed = {
    id: field.id,
    adminId: field.admin_id,
    name: field.name,
    location: field.location,
    departamento: field.departamento,
    provincia: field.provincia,
    distrito: field.distrito,
    districtId: field.district_id,
    address: field.address,
    phone: field.phone,
    latitude: parseFloat(field.latitude) || null,
    longitude: parseFloat(field.longitude) || null,
    pricePerHour: parseFloat(field.price_per_hour) || 0, // ✅ Convertir a número
    status: field.status,
    approvalStatus: field.approval_status,
    fieldType: field.field_type,
    sportType: field.sport_type,
    capacity: parseInt(field.capacity) || null,
    requiresAdvancePayment: field.requires_advance_payment,
    advancePaymentAmount: parseFloat(field.advance_payment_amount) || 0,
    isActive: field.is_active,
    isMultiSport: field.is_multi_sport,
    rating: parseFloat(field.rating) || 0,
    totalReviews: parseInt(field.total_reviews) || 0,
    approvedBy: field.approved_by,
    approvedAt: field.approved_at,
    rejectedBy: field.rejected_by,
    rejectedAt: field.rejected_at,
    rejectionReason: field.rejection_reason,
    createdBy: field.created_by,
    userIdRegistration: field.user_id_registration,
    dateTimeRegistration: field.date_time_registration,
    userIdModification: field.user_id_modification,
    dateTimeModification: field.date_time_modification,
    adminName: field.admin_name,
    adminPhone: field.admin_phone,
    adminEmail: field.admin_email,
    sportTypeName: field.sport_type_name,
    // Para compatibilidad con código existente
    createdAt: field.date_time_registration,
    updatedAt: field.date_time_modification,
    // Leaflet espera [lat, lng]
    coordinates:
      field.latitude && field.longitude
        ? [parseFloat(field.latitude), parseFloat(field.longitude)]
        : null,
    // sportTypes contiene los IDs numéricos de TODOS los deportes (desde field_sports)
    // Si hay sport_ids de field_sports, usarlos; sino, usar sport_type como fallback
    sportTypes:
      field.sport_ids && field.sport_ids.length > 0
        ? field.sport_ids
        : field.sport_type
          ? [parseInt(field.sport_type)]
          : [],
    // Nombres de los deportes (para mostrar en UI)
    sportNames: field.sport_names || [],
    // Imágenes de la cancha
    images: field.images || [],
    // Amenities/Servicios (array de strings)
    amenities: field.amenities || [],
    // Dimensiones de la cancha (transformar snake_case a camelCase + limpiar sufijos legacy)
    dimensions: field.dimensions
      ? {
          length: stripDimensionUnit(field.dimensions.length),
          width: stripDimensionUnit(field.dimensions.width),
          area: stripDimensionUnit(field.dimensions.area),
          surfaceType: field.dimensions.surface_type || null,
        }
      : null,
    // Equipamiento de la cancha (transformar snake_case a camelCase)
    equipment: field.equipment
      ? {
          hasJerseyRental: field.equipment.has_jersey_rental || false,
          jerseyPrice: parseFloat(field.equipment.jersey_price) || null,
          hasBallRental: field.equipment.has_ball_rental || false,
          ballPrice: parseFloat(field.equipment.ball_rental_price) || null,
          hasConeRental: field.equipment.has_cone_rental || false,
          conePrice: parseFloat(field.equipment.cone_price) || null,
          hasScoreboard: field.equipment.has_scoreboard || false,
          hasNets: field.equipment.has_nets !== false, // Por defecto true
          hasGoals: field.equipment.has_goals !== false, // Por defecto true
        }
      : null,
    // Imágenes personalizadas subidas
    customImages: field.custom_images || [],
    // Política de cancelación
    cancellationPolicy: field.cancellationPolicy || {
      allowCancellation: true,
      hoursBeforeEvent: 24,
      refundPercentage: 0,
    },
    // Precios especiales de la cancha
    specialPricing: field.specialPricing || [],
  };

  return transformed;
};

/**
 * Transformar reserva (reservation) de snake_case a camelCase
 * @param {Object} reservation - Reserva en formato snake_case
 * @returns {Object} Reserva en formato camelCase
 */
const transformReservationToCamelCase = reservation => {
  if (!reservation) return null;

  // Construir el campo 'time' desde start_time y end_time
  const time =
    reservation.start_time && reservation.end_time
      ? `${reservation.start_time} - ${reservation.end_time}`
      : null;

  return {
    id: reservation.id,
    field_id: reservation.field_id, // ✅ Mantener snake_case para compatibilidad
    fieldId: reservation.field_id,
    customerId: reservation.customer_id,
    date: toDateStringSafe(reservation.date), // ✅ Convertir a YYYY-MM-DD para evitar desfase de zona horaria
    startTime: reservation.start_time,
    start_time: reservation.start_time, // ✅ Mantener snake_case
    endTime: reservation.end_time,
    end_time: reservation.end_time, // ✅ Mantener snake_case
    time: time, // ✅ Agregar campo time construido
    time_slots: reservation.time_slots || [], // ✅ Agregar time_slots
    timeSlots: reservation.time_slots || [], // ✅ También en camelCase
    subtotal: parseFloat(reservation.subtotal) || 0,
    discount: parseFloat(reservation.discount) || 0,
    totalPrice: parseFloat(reservation.total_price) || 0,
    total_price: parseFloat(reservation.total_price) || 0, // ✅ Mantener snake_case
    advancePayment: parseFloat(reservation.advance_payment) || 0,
    remainingPayment: parseFloat(reservation.remaining_payment) || 0,
    paymentMethod: reservation.payment_method,
    payment_method: reservation.payment_method, // ✅ Mantener snake_case
    paymentStatus: reservation.payment_status,
    payment_status: reservation.payment_status, // ✅ Mantener snake_case
    paymentVoucherUrl: reservation.payment_voucher_url,
    status: reservation.status,
    type: reservation.type,
    hours: parseFloat(reservation.hours) || 1, // ✅ Convertir a número
    couponId: reservation.coupon_id,
    couponDiscount: parseFloat(reservation.coupon_discount) || 0,
    freeHoursUsed: parseFloat(reservation.free_hours_used) || 0,
    freeHoursDiscount: parseFloat(reservation.free_hours_discount) || 0,
    reviewed: reservation.reviewed,
    reviewId: reservation.review_id,
    cancelledBy: reservation.cancelled_by,
    cancellationReason: reservation.cancellation_reason,
    advanceKept: parseFloat(reservation.advance_kept) || 0,
    lostRevenue: parseFloat(reservation.lost_revenue) || 0,
    completedAt: reservation.completed_at,
    cancelledAt: reservation.cancelled_at,
    noShowDate: reservation.no_show_date,
    userIdRegistration: reservation.user_id_registration,
    dateTimeRegistration: reservation.date_time_registration,
    fieldName: reservation.field_name,
    field_name: reservation.field_name, // ✅ Mantener snake_case
    customerName: reservation.customer_name,
    customer_name: reservation.customer_name, // ✅ Mantener snake_case
    customerPhone: reservation.customer_phone,
    customer_phone: reservation.customer_phone, // ✅ Mantener snake_case
    phoneNumber: reservation.customer_phone || reservation.phone_number, // ✅ Alias
    // ✅ Campos de auditoría de aprobación/rechazo
    approvedBy: reservation.approved_by,
    approvedAt: reservation.approved_at,
    rejectedBy: reservation.rejected_by,
    rejectedAt: reservation.rejected_at,
    // ✅ Campos de reembolso (si existe)
    refundId: reservation.refund_id,
    refund_id: reservation.refund_id, // Mantener snake_case
    refundAmount: parseFloat(reservation.refund_amount) || 0,
    refund_amount: parseFloat(reservation.refund_amount) || 0, // Mantener snake_case
    refundStatus: reservation.refund_status,
    refund_status: reservation.refund_status, // Mantener snake_case
    refundProcessedAt: reservation.refund_processed_at,
    refund_processed_at: reservation.refund_processed_at, // Mantener snake_case
  };
};

/**
 * Transformar usuario (user) de snake_case a camelCase
 * @param {Object} user - Usuario en formato snake_case
 * @returns {Object} Usuario en formato camelCase
 */
const transformUserToCamelCase = user => {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    roleId: user.role_id,
    role: user.role,
    adminType: user.admin_type,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatar_url,
    isActive: user.is_active,
    lastLogin: user.last_login,
    createdBy: user.created_by,
    loginAttempts: user.login_attempts,
    lastLoginAttempt: user.last_login_attempt,
    isBlocked: user.is_blocked,
    blockUntil: user.block_until,
    status: user.status,
    userIdRegistration: user.user_id_registration,
    createdAt: user.date_time_registration,
    userIdModification: user.user_id_modification,
    dateTimeModification: user.date_time_modification,
    permissions: user.permissions,
    managedFields: user.managed_fields,
  };
};

module.exports = {
  transformFieldToCamelCase,
  transformReservationToCamelCase,
  transformUserToCamelCase,
};
