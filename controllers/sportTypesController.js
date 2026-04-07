const {
  getAllSportTypes,
  getSportTypeById,
  createSportType,
  updateSportType,
  deleteSportType,
  sportTypeNameExists,
} = require('../models/sportTypesModel');

/**
 * Obtener todos los tipos de deportes
 */
const getSportTypes = async (req, res) => {
  try {
    const onlyActive = req.query.only_active === 'true';
    const sportTypes = await getAllSportTypes(onlyActive);

    res.json({
      success: true,
      data: sportTypes,
      count: sportTypes.length,
    });
  } catch (error) {
    console.error('Error al obtener tipos de deportes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipos de deportes',
    });
  }
};

/**
 * Obtener un tipo de deporte por ID
 */
const getSportType = async (req, res) => {
  try {
    const { id } = req.params;
    const sportType = await getSportTypeById(id);

    if (!sportType) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de deporte no encontrado',
      });
    }

    res.json({
      success: true,
      data: sportType,
    });
  } catch (error) {
    console.error('Error al obtener tipo de deporte:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipo de deporte',
    });
  }
};

/**
 * Crear un nuevo tipo de deporte
 */
const createNewSportType = async (req, res) => {
  try {
    const { name, icon, color, description, is_active, status } = req.body;

    // Validaciones
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre del deporte es requerido',
      });
    }

    // Verificar si el nombre ya existe
    const nameExists = await sportTypeNameExists(name);
    if (nameExists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un deporte con ese nombre',
      });
    }

    const sportTypeData = {
      name: name.trim(),
      icon,
      color,
      description,
      is_active,
      status,
      user_id_registration: req.user?.id || 1, // ID del usuario autenticado
    };

    const newSportType = await createSportType(sportTypeData);

    res.status(201).json({
      success: true,
      message: 'Tipo de deporte creado exitosamente',
      data: newSportType,
    });
  } catch (error) {
    console.error('Error al crear tipo de deporte:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear tipo de deporte',
    });
  }
};

/**
 * Actualizar un tipo de deporte
 */
const updateExistingSportType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color, description, is_active, status } = req.body;

    // Verificar si el tipo de deporte existe
    const existingSportType = await getSportTypeById(id);
    if (!existingSportType) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de deporte no encontrado',
      });
    }

    // Si se está actualizando el nombre, verificar que no exista
    if (name && name.trim()) {
      const nameExists = await sportTypeNameExists(name, id);
      if (nameExists) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe un deporte con ese nombre',
        });
      }
    }

    const sportTypeData = {
      name: name?.trim(),
      icon,
      color,
      description,
      is_active,
      status,
      user_id_modification: req.user?.id || 1,
    };

    const updatedSportType = await updateSportType(id, sportTypeData);

    res.json({
      success: true,
      message: 'Tipo de deporte actualizado exitosamente',
      data: updatedSportType,
    });
  } catch (error) {
    console.error('Error al actualizar tipo de deporte:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar tipo de deporte',
    });
  }
};

/**
 * Eliminar un tipo de deporte (soft delete)
 */
const deleteSportTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el tipo de deporte existe
    const existingSportType = await getSportTypeById(id);
    if (!existingSportType) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de deporte no encontrado',
      });
    }

    const user_id = req.user?.id || 1;
    const deleted = await deleteSportType(id, user_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Tipo de deporte eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el tipo de deporte',
      });
    }
  } catch (error) {
    console.error('Error al eliminar tipo de deporte:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar tipo de deporte',
    });
  }
};

module.exports = {
  getSportTypes,
  getSportType,
  createNewSportType,
  updateExistingSportType,
  deleteSportTypeById,
};
