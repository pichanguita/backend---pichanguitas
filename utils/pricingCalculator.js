/**
 * Calculadora de precios con soporte para precios especiales
 * Centraliza la lógica de cálculo de precios para reservas
 */

const { getApplicableSpecialPricingForSlots } = require('../models/fieldSpecialPricingModel');

/**
 * Obtiene el día de la semana en inglés a partir de una fecha
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @returns {string} Día de la semana en inglés (monday, tuesday, etc.)
 */
const getDayOfWeek = dateStr => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const date = new Date(dateStr + 'T12:00:00'); // Usar mediodía para evitar problemas de timezone
  return days[date.getDay()];
};

/**
 * Genera array de IDs de slots basado en hora de inicio y cantidad de horas
 * Los IDs son strings como '6am', '7am', '12pm', '1pm', etc.
 * @param {string} startTime - Hora de inicio (HH:MM)
 * @param {number} hours - Cantidad de horas
 * @returns {Array<string>} Array de IDs de slots (ej: ['6am', '7am'])
 */
const generateSlotIds = (startTime, hours) => {
  const [startHour] = startTime.split(':').map(Number);

  const slotIds = [];
  for (let i = 0; i < hours; i++) {
    const hour = startHour + i;
    // Convertir hora numérica a formato de ID (6am, 7am, 12pm, 1pm, etc.)
    let slotId;
    if (hour < 12) {
      slotId = `${hour}am`;
    } else if (hour === 12) {
      slotId = '12pm';
    } else {
      slotId = `${hour - 12}pm`;
    }
    slotIds.push(slotId);
  }

  return slotIds;
};

/**
 * Calcula el descuento aplicable para un slot específico
 * @param {number} pricePerHour - Precio base por hora
 * @param {Object} specialPricing - Precio especial aplicable
 * @returns {number} Monto del descuento
 */
const calculateSlotDiscount = (pricePerHour, specialPricing) => {
  if (!specialPricing) return 0;

  const { discountValue, discountType } = specialPricing;

  if (discountType === 'percentage') {
    // Descuento porcentual
    return (pricePerHour * discountValue) / 100;
  } else if (discountType === 'amount') {
    // Descuento fijo (no puede ser mayor al precio por hora)
    return Math.min(discountValue, pricePerHour);
  }

  return 0;
};

/**
 * Calcula el precio total considerando precios especiales
 * @param {Object} field - Cancha con specialPricing cargado
 * @param {string} date - Fecha de reserva (YYYY-MM-DD)
 * @param {number} hours - Cantidad de horas
 * @param {string} startTime - Hora de inicio (HH:MM)
 * @returns {Promise<Object>} { totalPrice, totalDiscount, baseSubtotal, appliedPricings, slotDetails }
 */
const calculatePriceWithSpecialPricing = async (field, date, hours, startTime) => {
  const pricePerHour = parseFloat(field.price_per_hour) || 0;
  const baseSubtotal = pricePerHour * hours;

  // Si no hay precio configurado, retornar ceros
  if (pricePerHour <= 0) {
    return {
      totalPrice: 0,
      totalDiscount: 0,
      baseSubtotal: 0,
      appliedPricings: [],
      slotDetails: [],
    };
  }

  // Obtener día de la semana
  const dayOfWeek = getDayOfWeek(date);

  // Generar IDs de slots (formato: '6am', '7am', '12pm', etc.)
  const slotIds = generateSlotIds(startTime, hours);

  // Obtener precios especiales aplicables para cada slot
  const pricingMap = await getApplicableSpecialPricingForSlots(field.id, dayOfWeek, slotIds);

  // Calcular descuento por cada slot
  let totalDiscount = 0;
  const slotDetails = [];
  const appliedPricingsSet = new Set();

  for (let i = 0; i < slotIds.length; i++) {
    const slotId = slotIds[i];
    const specialPricing = pricingMap[slotId];
    const slotDiscount = calculateSlotDiscount(pricePerHour, specialPricing);

    slotDetails.push({
      slotId,
      hour: i + 1,
      basePrice: pricePerHour,
      discount: slotDiscount,
      finalPrice: pricePerHour - slotDiscount,
      appliedPricing: specialPricing
        ? {
            id: specialPricing.pricingId,
            name: specialPricing.name,
          }
        : null,
    });

    totalDiscount += slotDiscount;

    if (specialPricing) {
      appliedPricingsSet.add(
        JSON.stringify({
          id: specialPricing.pricingId,
          name: specialPricing.name,
          discountType: specialPricing.discountType,
          discountValue: specialPricing.discountValue,
        })
      );
    }
  }

  const totalPrice = baseSubtotal - totalDiscount;
  const appliedPricings = Array.from(appliedPricingsSet).map(p => JSON.parse(p));

  return {
    totalPrice: Math.max(0, totalPrice),
    totalDiscount,
    baseSubtotal,
    appliedPricings,
    slotDetails,
  };
};

/**
 * Valida que el precio enviado coincida con el calculado
 * @param {Object} field - Cancha
 * @param {string} date - Fecha de reserva
 * @param {number} hours - Cantidad de horas
 * @param {string} startTime - Hora de inicio
 * @param {number} receivedTotalPrice - Precio total recibido del frontend
 * @param {number} tolerance - Tolerancia permitida (default S/1.00)
 * @returns {Promise<Object>} { isValid, expectedPrice, difference, details }
 */
const validateReservationPrice = async (
  field,
  date,
  hours,
  startTime,
  receivedTotalPrice,
  tolerance = 1.0
) => {
  const calculation = await calculatePriceWithSpecialPricing(field, date, hours, startTime);

  const difference = Math.abs(receivedTotalPrice - calculation.totalPrice);
  const isValid = difference <= tolerance;

  return {
    isValid,
    expectedPrice: calculation.totalPrice,
    receivedPrice: receivedTotalPrice,
    difference,
    details: {
      baseSubtotal: calculation.baseSubtotal,
      totalDiscount: calculation.totalDiscount,
      appliedPricings: calculation.appliedPricings,
      slotDetails: calculation.slotDetails,
    },
  };
};

/**
 * Calcula el precio con descuentos adicionales (cupones, horas gratis)
 * @param {Object} field - Cancha
 * @param {string} date - Fecha de reserva
 * @param {number} hours - Cantidad de horas
 * @param {string} startTime - Hora de inicio
 * @param {Object} additionalDiscounts - { freeHours, couponDiscount }
 * @returns {Promise<Object>} Cálculo completo con todos los descuentos
 */
const calculateFinalPrice = async (field, date, hours, startTime, additionalDiscounts = {}) => {
  const pricePerHour = parseFloat(field.price_per_hour) || 0;
  const calculation = await calculatePriceWithSpecialPricing(field, date, hours, startTime);

  let additionalDiscount = 0;
  const discountBreakdown = {
    specialPricing: calculation.totalDiscount,
    freeHours: 0,
    coupon: 0,
  };

  // Descuento por horas gratis
  if (additionalDiscounts.freeHours && additionalDiscounts.freeHours > 0) {
    const freeHoursDiscount = Math.min(additionalDiscounts.freeHours, hours) * pricePerHour;
    discountBreakdown.freeHours = freeHoursDiscount;
    additionalDiscount += freeHoursDiscount;
  }

  // Descuento por cupón
  if (additionalDiscounts.couponDiscount && additionalDiscounts.couponDiscount > 0) {
    discountBreakdown.coupon = additionalDiscounts.couponDiscount;
    additionalDiscount += additionalDiscounts.couponDiscount;
  }

  const totalDiscount = calculation.totalDiscount + additionalDiscount;
  const finalPrice = Math.max(0, calculation.baseSubtotal - totalDiscount);

  return {
    baseSubtotal: calculation.baseSubtotal,
    pricePerHour,
    hours,
    totalDiscount,
    discountBreakdown,
    finalPrice,
    appliedSpecialPricings: calculation.appliedPricings,
    slotDetails: calculation.slotDetails,
  };
};

module.exports = {
  getDayOfWeek,
  generateSlotIds,
  calculateSlotDiscount,
  calculatePriceWithSpecialPricing,
  validateReservationPrice,
  calculateFinalPrice,
};
