const {
  getAllFieldEquipment,
  getFieldEquipmentById,
  getEquipmentByFieldId,
  equipmentExistsForField,
  createFieldEquipment,
  updateFieldEquipment,
  deleteFieldEquipment,
  deleteEquipmentByFieldId,
} = require('../models/fieldEquipmentModel');

/**
 * Obtener todos los equipamientos con filtros
 */
const getFieldEquipments = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      has_jersey_rental:
        req.query.has_jersey_rental === 'true'
          ? true
          : req.query.has_jersey_rental === 'false'
            ? false
            : undefined,
      has_ball_rental:
        req.query.has_ball_rental === 'true'
          ? true
          : req.query.has_ball_rental === 'false'
            ? false
            : undefined,
      has_scoreboard:
        req.query.has_scoreboard === 'true'
          ? true
          : req.query.has_scoreboard === 'false'
            ? false
            : undefined,
    };

    const equipment = await getAllFieldEquipment(filters);

    res.json({
      success: true,
      data: equipment,
      count: equipment.length,
    });
  } catch (error) {
    console.error('Error al obtener equipamientos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener equipamientos',
    });
  }
};

/**
 * Obtener un equipamiento por ID
 */
const getFieldEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const equipment = await getFieldEquipmentById(id);

    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: 'Equipamiento no encontrado',
      });
    }

    res.json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    console.error('Error al obtener equipamiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener equipamiento',
    });
  }
};

/**
 * Obtener equipamiento de una cancha específica
 */
const getEquipmentByField = async (req, res) => {
  try {
    const { field_id } = req.params;
    const equipment = await getEquipmentByFieldId(field_id);

    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: 'Equipamiento no encontrado para esta cancha',
      });
    }

    res.json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    console.error('Error al obtener equipamiento de la cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener equipamiento de la cancha',
    });
  }
};

/**
 * Crear un nuevo equipamiento
 */
const createNewFieldEquipment = async (req, res) => {
  try {
    const {
      field_id,
      has_jersey_rental,
      jersey_price,
      has_ball_rental,
      ball_rental_price,
      has_scoreboard,
      has_nets,
      has_goals,
    } = req.body;

    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    // Validar que no exista ya equipamiento para esta cancha (relación 1-1)
    const exists = await equipmentExistsForField(field_id);
    if (exists) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un registro de equipamiento para esta cancha. Use PUT para actualizar.',
      });
    }

    // Validar precios cuando el rental está habilitado
    if (has_jersey_rental && (!jersey_price || jersey_price <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'El precio de alquiler de camisetas es requerido cuando está habilitado',
      });
    }

    if (has_ball_rental && (!ball_rental_price || ball_rental_price <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'El precio de alquiler de balones es requerido cuando está habilitado',
      });
    }

    const equipmentData = {
      field_id,
      has_jersey_rental,
      jersey_price,
      has_ball_rental,
      ball_rental_price,
      has_scoreboard,
      has_nets,
      has_goals,
      user_id_registration: req.user?.id || 1,
    };

    const newEquipment = await createFieldEquipment(equipmentData);

    res.status(201).json({
      success: true,
      message: 'Equipamiento creado exitosamente',
      data: newEquipment,
    });
  } catch (error) {
    console.error('Error al crear equipamiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear equipamiento',
    });
  }
};

/**
 * Actualizar un equipamiento
 */
const updateExistingFieldEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      has_jersey_rental,
      jersey_price,
      has_ball_rental,
      ball_rental_price,
      has_scoreboard,
      has_nets,
      has_goals,
    } = req.body;

    const existingEquipment = await getFieldEquipmentById(id);
    if (!existingEquipment) {
      return res.status(404).json({
        success: false,
        error: 'Equipamiento no encontrado',
      });
    }

    // Validar precios cuando el rental está habilitado
    if (has_jersey_rental && (!jersey_price || jersey_price <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'El precio de alquiler de camisetas es requerido cuando está habilitado',
      });
    }

    if (has_ball_rental && (!ball_rental_price || ball_rental_price <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'El precio de alquiler de balones es requerido cuando está habilitado',
      });
    }

    const equipmentData = {
      has_jersey_rental,
      jersey_price,
      has_ball_rental,
      ball_rental_price,
      has_scoreboard,
      has_nets,
      has_goals,
      user_id_modification: req.user?.id || 1,
    };

    const updatedEquipment = await updateFieldEquipment(id, equipmentData);

    res.json({
      success: true,
      message: 'Equipamiento actualizado exitosamente',
      data: updatedEquipment,
    });
  } catch (error) {
    console.error('Error al actualizar equipamiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar equipamiento',
    });
  }
};

/**
 * Eliminar un equipamiento
 */
const deleteFieldEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const existingEquipment = await getFieldEquipmentById(id);
    if (!existingEquipment) {
      return res.status(404).json({
        success: false,
        error: 'Equipamiento no encontrado',
      });
    }

    const deleted = await deleteFieldEquipment(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Equipamiento eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el equipamiento',
      });
    }
  } catch (error) {
    console.error('Error al eliminar equipamiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar equipamiento',
    });
  }
};

/**
 * Eliminar equipamiento por field_id
 */
const deleteEquipmentByField = async (req, res) => {
  try {
    const { field_id } = req.params;

    const existingEquipment = await getEquipmentByFieldId(field_id);
    if (!existingEquipment) {
      return res.status(404).json({
        success: false,
        error: 'Equipamiento no encontrado para esta cancha',
      });
    }

    const deleted = await deleteEquipmentByFieldId(field_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Equipamiento eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el equipamiento',
      });
    }
  } catch (error) {
    console.error('Error al eliminar equipamiento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar equipamiento',
    });
  }
};

module.exports = {
  getFieldEquipments,
  getFieldEquipment,
  getEquipmentByField,
  createNewFieldEquipment,
  updateExistingFieldEquipment,
  deleteFieldEquipmentById,
  deleteEquipmentByField,
};
