const {
  getAllFieldMaintenanceSchedules,
  getFieldMaintenanceScheduleById,
  getMaintenanceSchedulesByFieldId,
  createFieldMaintenanceSchedule,
  updateFieldMaintenanceSchedule,
  deleteFieldMaintenanceSchedule,
  checkMaintenanceConflicts,
  getMaintenanceForDate,
  getMaintenanceStats,
} = require('../models/fieldMaintenanceSchedulesModel');

/**
 * Obtener todos los programas de mantenimiento con filtros
 */
const getFieldMaintenanceSchedules = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      active_only: req.query.active_only,
      current_only: req.query.current_only,
      future_only: req.query.future_only,
      is_recurring:
        req.query.is_recurring === 'true'
          ? true
          : req.query.is_recurring === 'false'
            ? false
            : undefined,
    };

    const schedules = await getAllFieldMaintenanceSchedules(filters);

    res.json({
      success: true,
      data: schedules,
      count: schedules.length,
    });
  } catch (error) {
    console.error('Error al obtener programas de mantenimiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener programas de mantenimiento',
    });
  }
};

/**
 * Obtener un programa de mantenimiento por ID
 */
const getFieldMaintenanceSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await getFieldMaintenanceScheduleById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Programa de mantenimiento no encontrado',
      });
    }

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error('Error al obtener programa de mantenimiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener programa de mantenimiento',
    });
  }
};

/**
 * Obtener programas de mantenimiento de una cancha específica
 */
const getMaintenanceSchedulesByField = async (req, res) => {
  try {
    const { field_id } = req.params;
    const schedules = await getMaintenanceSchedulesByFieldId(field_id);

    res.json({
      success: true,
      data: schedules,
      count: schedules.length,
    });
  } catch (error) {
    console.error('Error al obtener programas de mantenimiento de la cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener programas de mantenimiento de la cancha',
    });
  }
};

/**
 * Verificar mantenimiento para una fecha específica
 */
const checkMaintenanceForDate = async (req, res) => {
  try {
    const { field_id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'La fecha es requerida',
      });
    }

    const schedules = await getMaintenanceForDate(field_id, date);

    res.json({
      success: true,
      has_maintenance: schedules.length > 0,
      data: schedules,
      count: schedules.length,
    });
  } catch (error) {
    console.error('Error al verificar mantenimiento para la fecha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar mantenimiento para la fecha',
    });
  }
};

/**
 * Crear un nuevo programa de mantenimiento
 */
const createNewFieldMaintenanceSchedule = async (req, res) => {
  try {
    const {
      field_id,
      start_date,
      end_date,
      start_time,
      end_time,
      reason,
      is_recurring,
      recurrence_pattern,
    } = req.body;

    // Validaciones básicas
    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!start_date) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de inicio es requerida',
      });
    }

    if (!end_date) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de fin es requerida',
      });
    }

    // Validar que end_date >= start_date
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de fin debe ser igual o posterior a la fecha de inicio',
      });
    }

    // Si hay horarios, validar que end_time > start_time
    if (start_time && end_time && end_time <= start_time) {
      return res.status(400).json({
        success: false,
        error: 'La hora de fin debe ser posterior a la hora de inicio',
      });
    }

    // Si es recurrente, validar que tenga patrón
    if (is_recurring && !recurrence_pattern) {
      return res.status(400).json({
        success: false,
        error: 'El patrón de recurrencia es requerido para mantenimientos recurrentes',
      });
    }

    // Verificar conflictos con otros mantenimientos
    const conflicts = await checkMaintenanceConflicts(field_id, start_date, end_date);
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un mantenimiento programado que se solapa con estas fechas',
        conflicts: conflicts,
      });
    }

    const scheduleData = {
      field_id,
      start_date,
      end_date,
      start_time,
      end_time,
      reason: reason?.trim(),
      is_recurring: is_recurring || false,
      recurrence_pattern: recurrence_pattern?.trim(),
      user_id_registration: req.user?.id || 1,
    };

    const newSchedule = await createFieldMaintenanceSchedule(scheduleData);

    res.status(201).json({
      success: true,
      message: 'Programa de mantenimiento creado exitosamente',
      data: newSchedule,
    });
  } catch (error) {
    console.error('Error al crear programa de mantenimiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear programa de mantenimiento',
    });
  }
};

/**
 * Actualizar un programa de mantenimiento
 */
const updateExistingFieldMaintenanceSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, start_time, end_time, reason, is_recurring, recurrence_pattern } =
      req.body;

    // Verificar si el programa existe
    const existingSchedule = await getFieldMaintenanceScheduleById(id);
    if (!existingSchedule) {
      return res.status(404).json({
        success: false,
        error: 'Programa de mantenimiento no encontrado',
      });
    }

    // Validar fechas si se proporcionan
    const finalStartDate = start_date || existingSchedule.start_date;
    const finalEndDate = end_date || existingSchedule.end_date;

    if (new Date(finalEndDate) < new Date(finalStartDate)) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de fin debe ser igual o posterior a la fecha de inicio',
      });
    }

    // Validar horarios si se proporcionan
    if (start_time && end_time && end_time <= start_time) {
      return res.status(400).json({
        success: false,
        error: 'La hora de fin debe ser posterior a la hora de inicio',
      });
    }

    // Si se marca como recurrente, validar que tenga patrón
    const finalIsRecurring =
      is_recurring !== undefined ? is_recurring : existingSchedule.is_recurring;
    const finalRecurrencePattern =
      recurrence_pattern !== undefined ? recurrence_pattern : existingSchedule.recurrence_pattern;

    if (finalIsRecurring && !finalRecurrencePattern) {
      return res.status(400).json({
        success: false,
        error: 'El patrón de recurrencia es requerido para mantenimientos recurrentes',
      });
    }

    // Verificar conflictos si se cambian las fechas
    if (start_date || end_date) {
      const conflicts = await checkMaintenanceConflicts(
        existingSchedule.field_id,
        finalStartDate,
        finalEndDate,
        id
      );
      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe un mantenimiento programado que se solapa con estas fechas',
          conflicts: conflicts,
        });
      }
    }

    const scheduleData = {
      start_date,
      end_date,
      start_time,
      end_time,
      reason: reason?.trim(),
      is_recurring,
      recurrence_pattern: recurrence_pattern?.trim(),
      user_id_modification: req.user?.id || 1,
    };

    const updatedSchedule = await updateFieldMaintenanceSchedule(id, scheduleData);

    res.json({
      success: true,
      message: 'Programa de mantenimiento actualizado exitosamente',
      data: updatedSchedule,
    });
  } catch (error) {
    console.error('Error al actualizar programa de mantenimiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar programa de mantenimiento',
    });
  }
};

/**
 * Eliminar un programa de mantenimiento
 */
const deleteFieldMaintenanceScheduleById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el programa existe
    const existingSchedule = await getFieldMaintenanceScheduleById(id);
    if (!existingSchedule) {
      return res.status(404).json({
        success: false,
        error: 'Programa de mantenimiento no encontrado',
      });
    }

    const deleted = await deleteFieldMaintenanceSchedule(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Programa de mantenimiento eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el programa de mantenimiento',
      });
    }
  } catch (error) {
    console.error('Error al eliminar programa de mantenimiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar programa de mantenimiento',
    });
  }
};

/**
 * Obtener estadísticas de mantenimiento
 */
const getStats = async (req, res) => {
  try {
    const field_id = req.query.field_id;

    const stats = await getMaintenanceStats(field_id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de mantenimiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de mantenimiento',
    });
  }
};

module.exports = {
  getFieldMaintenanceSchedules,
  getFieldMaintenanceSchedule,
  getMaintenanceSchedulesByField,
  checkMaintenanceForDate,
  createNewFieldMaintenanceSchedule,
  updateExistingFieldMaintenanceSchedule,
  deleteFieldMaintenanceScheduleById,
  getStats,
};
