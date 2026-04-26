/**
 * Controlador de Disponibilidad Pública
 *
 * Permite a usuarios NO autenticados consultar la disponibilidad
 * de horarios de una cancha para una fecha específica.
 *
 * Solo devuelve información de horarios (sin datos sensibles de clientes).
 */

const { getOccupiedSlotsByFieldAndDate } = require('../models/reservationsModel');
const { getFieldById } = require('../models/fieldsModel');
const { findScheduleRowForDate, getDayOfWeekKey } = require('../utils/fieldSchedule');
const { toTimeString } = require('../utils/transformers');

/**
 * Obtener slots ocupados de una cancha para una fecha específica
 * PÚBLICO: No requiere autenticación
 *
 * @route GET /api/public/fields/:fieldId/availability
 * @param {string} fieldId - ID de la cancha
 * @query {string} date - Fecha en formato YYYY-MM-DD (requerido)
 */
const getFieldAvailability = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { date } = req.query;

    // Validación de parámetros
    if (!fieldId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el ID de la cancha',
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere la fecha (formato: YYYY-MM-DD)',
      });
    }

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de fecha inválido. Use YYYY-MM-DD',
      });
    }

    // Verificar que la cancha existe y está activa
    const field = await getFieldById(parseInt(fieldId));

    if (!field) {
      return res.status(404).json({
        success: false,
        error: 'Cancha no encontrada',
      });
    }

    if (!field.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Esta cancha no está activa actualmente',
      });
    }

    // Obtener slots ocupados
    const occupiedSlots = await getOccupiedSlotsByFieldAndDate(parseInt(fieldId), date);

    // Formatear respuesta (solo horarios, sin datos sensibles)
    const formattedSlots = occupiedSlots.map(slot => ({
      startTime: slot.start_time,
      endTime: slot.end_time,
    }));

    // Horario operativo de la cancha para el día solicitado.
    // Si la cancha no tiene configuración para ese día → null ⇒ frontend trata como "abierta".
    const dayKey = getDayOfWeekKey(date);
    const scheduleRow = findScheduleRowForDate(field.schedules, date);
    const daySchedule = scheduleRow
      ? {
          dayOfWeek: dayKey,
          isOpen: scheduleRow.is_open !== false,
          openTime: toTimeString(scheduleRow.open_time),
          closeTime: toTimeString(scheduleRow.close_time),
        }
      : null;

    res.json({
      success: true,
      data: {
        fieldId: parseInt(fieldId),
        date: date,
        occupiedSlots: formattedSlots,
        totalOccupied: formattedSlots.length,
        daySchedule,
      },
    });
  } catch (error) {
    console.error('Error al obtener disponibilidad:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener disponibilidad de la cancha',
    });
  }
};

module.exports = {
  getFieldAvailability,
};
