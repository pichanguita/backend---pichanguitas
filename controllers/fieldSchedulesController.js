const {
  getAllFieldSchedules,
  getFieldScheduleById,
  getSchedulesByFieldId,
  createFieldSchedule,
  updateFieldSchedule,
  deleteFieldSchedule,
  scheduleExistsForDay,
  createWeekSchedules,
} = require('../models/fieldSchedulesModel');

// Días de la semana válidos
const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Obtener todos los horarios con filtros
 */
const getFieldSchedules = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      day_of_week: req.query.day_of_week,
      is_open:
        req.query.is_open === 'true' ? true : req.query.is_open === 'false' ? false : undefined,
    };

    const schedules = await getAllFieldSchedules(filters);

    res.json({
      success: true,
      data: schedules,
      count: schedules.length,
    });
  } catch (error) {
    console.error('Error al obtener horarios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener horarios',
    });
  }
};

/**
 * Obtener un horario por ID
 */
const getFieldSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await getFieldScheduleById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Horario no encontrado',
      });
    }

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error('Error al obtener horario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener horario',
    });
  }
};

/**
 * Obtener horarios de una cancha específica
 */
const getSchedulesByField = async (req, res) => {
  try {
    const { field_id } = req.params;
    const schedules = await getSchedulesByFieldId(field_id);

    res.json({
      success: true,
      data: schedules,
      count: schedules.length,
    });
  } catch (error) {
    console.error('Error al obtener horarios de la cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener horarios de la cancha',
    });
  }
};

/**
 * Crear un nuevo horario
 */
const createNewFieldSchedule = async (req, res) => {
  try {
    const { field_id, day_of_week, is_open, open_time, close_time } = req.body;

    // Validaciones básicas
    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!day_of_week || !day_of_week.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El día de la semana es requerido',
      });
    }

    // Validar que sea un día válido
    if (!VALID_DAYS.includes(day_of_week.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `El día debe ser uno de: ${VALID_DAYS.join(', ')}`,
      });
    }

    // Si está abierto, validar que tenga horarios
    if (is_open !== false) {
      if (!open_time) {
        return res.status(400).json({
          success: false,
          error: 'La hora de apertura es requerida para días abiertos',
        });
      }

      if (!close_time) {
        return res.status(400).json({
          success: false,
          error: 'La hora de cierre es requerida para días abiertos',
        });
      }

      // Validar que la hora de cierre sea después de la apertura
      if (open_time >= close_time) {
        return res.status(400).json({
          success: false,
          error: 'La hora de cierre debe ser posterior a la hora de apertura',
        });
      }
    }

    // Verificar si ya existe un horario para esta cancha en este día
    const exists = await scheduleExistsForDay(field_id, day_of_week.toLowerCase());
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un horario para esta cancha en este día',
      });
    }

    const scheduleData = {
      field_id,
      day_of_week: day_of_week.toLowerCase(),
      is_open: is_open !== undefined ? is_open : true,
      open_time: is_open !== false ? open_time : null,
      close_time: is_open !== false ? close_time : null,
      user_id_registration: req.user?.id || 1,
    };

    const newSchedule = await createFieldSchedule(scheduleData);

    res.status(201).json({
      success: true,
      message: 'Horario creado exitosamente',
      data: newSchedule,
    });
  } catch (error) {
    console.error('Error al crear horario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear horario',
    });
  }
};

/**
 * Crear horarios para toda la semana
 */
const createWeekSchedule = async (req, res) => {
  try {
    const { field_id, schedules } = req.body;

    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar un array de horarios',
      });
    }

    // Validar cada horario
    for (const schedule of schedules) {
      if (!schedule.day_of_week || !VALID_DAYS.includes(schedule.day_of_week.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `Día inválido: ${schedule.day_of_week}. Debe ser uno de: ${VALID_DAYS.join(', ')}`,
        });
      }

      if (schedule.is_open !== false) {
        if (!schedule.open_time || !schedule.close_time) {
          return res.status(400).json({
            success: false,
            error: `Los horarios de apertura y cierre son requeridos para ${schedule.day_of_week}`,
          });
        }

        if (schedule.open_time >= schedule.close_time) {
          return res.status(400).json({
            success: false,
            error: `La hora de cierre debe ser posterior a la apertura para ${schedule.day_of_week}`,
          });
        }
      }
    }

    const user_id = req.user?.id || 1;
    const createdSchedules = await createWeekSchedules(field_id, schedules, user_id);

    res.status(201).json({
      success: true,
      message: 'Horarios de la semana creados exitosamente',
      data: createdSchedules,
      count: createdSchedules.length,
    });
  } catch (error) {
    console.error('Error al crear horarios de la semana:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear horarios de la semana',
    });
  }
};

/**
 * Actualizar un horario
 */
const updateExistingFieldSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { day_of_week, is_open, open_time, close_time } = req.body;

    // Verificar si el horario existe
    const existingSchedule = await getFieldScheduleById(id);
    if (!existingSchedule) {
      return res.status(404).json({
        success: false,
        error: 'Horario no encontrado',
      });
    }

    // Validar día si se proporciona
    if (day_of_week && !VALID_DAYS.includes(day_of_week.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `El día debe ser uno de: ${VALID_DAYS.join(', ')}`,
      });
    }

    // Si se cambia el día, verificar que no exista
    if (day_of_week && day_of_week.toLowerCase() !== existingSchedule.day_of_week) {
      const exists = await scheduleExistsForDay(
        existingSchedule.field_id,
        day_of_week.toLowerCase(),
        id
      );
      if (exists) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe un horario para esta cancha en este día',
        });
      }
    }

    // Validar horarios si está abierto
    const finalIsOpen = is_open !== undefined ? is_open : existingSchedule.is_open;
    if (finalIsOpen) {
      const finalOpenTime = open_time || existingSchedule.open_time;
      const finalCloseTime = close_time || existingSchedule.close_time;

      if (!finalOpenTime || !finalCloseTime) {
        return res.status(400).json({
          success: false,
          error: 'Los horarios de apertura y cierre son requeridos para días abiertos',
        });
      }

      if (finalOpenTime >= finalCloseTime) {
        return res.status(400).json({
          success: false,
          error: 'La hora de cierre debe ser posterior a la hora de apertura',
        });
      }
    }

    const scheduleData = {
      day_of_week: day_of_week?.toLowerCase(),
      is_open,
      open_time: is_open !== false ? open_time : null,
      close_time: is_open !== false ? close_time : null,
      user_id_modification: req.user?.id || 1,
    };

    const updatedSchedule = await updateFieldSchedule(id, scheduleData);

    res.json({
      success: true,
      message: 'Horario actualizado exitosamente',
      data: updatedSchedule,
    });
  } catch (error) {
    console.error('Error al actualizar horario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar horario',
    });
  }
};

/**
 * Eliminar un horario
 */
const deleteFieldScheduleById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el horario existe
    const existingSchedule = await getFieldScheduleById(id);
    if (!existingSchedule) {
      return res.status(404).json({
        success: false,
        error: 'Horario no encontrado',
      });
    }

    const deleted = await deleteFieldSchedule(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Horario eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el horario',
      });
    }
  } catch (error) {
    console.error('Error al eliminar horario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar horario',
    });
  }
};

module.exports = {
  getFieldSchedules,
  getFieldSchedule,
  getSchedulesByField,
  createNewFieldSchedule,
  createWeekSchedule,
  updateExistingFieldSchedule,
  deleteFieldScheduleById,
};
