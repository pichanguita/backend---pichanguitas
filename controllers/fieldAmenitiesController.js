const {
  getAllFieldAmenities,
  getFieldAmenityById,
  getAmenitiesByFieldId,
  createFieldAmenity,
  updateFieldAmenity,
  deleteFieldAmenity,
  amenityExistsForField,
  createMultipleAmenities,
  deleteAllAmenitiesByFieldId,
} = require('../models/fieldAmenitiesModel');

/**
 * Obtener todas las amenidades con filtros
 */
const getFieldAmenities = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      search: req.query.search,
    };

    const amenities = await getAllFieldAmenities(filters);

    res.json({
      success: true,
      data: amenities,
      count: amenities.length,
    });
  } catch (error) {
    console.error('Error al obtener amenidades:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener amenidades',
    });
  }
};

/**
 * Obtener una amenidad por ID
 */
const getFieldAmenity = async (req, res) => {
  try {
    const { id } = req.params;
    const amenity = await getFieldAmenityById(id);

    if (!amenity) {
      return res.status(404).json({
        success: false,
        error: 'Amenidad no encontrada',
      });
    }

    res.json({
      success: true,
      data: amenity,
    });
  } catch (error) {
    console.error('Error al obtener amenidad:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener amenidad',
    });
  }
};

/**
 * Obtener amenidades de una cancha específica
 */
const getAmenitiesByField = async (req, res) => {
  try {
    const { field_id } = req.params;
    const amenities = await getAmenitiesByFieldId(field_id);

    res.json({
      success: true,
      data: amenities,
      count: amenities.length,
    });
  } catch (error) {
    console.error('Error al obtener amenidades de la cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener amenidades de la cancha',
    });
  }
};

/**
 * Crear una nueva amenidad
 */
const createNewFieldAmenity = async (req, res) => {
  try {
    const { field_id, amenity } = req.body;

    // Validaciones básicas
    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!amenity || !amenity.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la amenidad es requerido',
      });
    }

    // Verificar si la amenidad ya existe para esta cancha
    const exists = await amenityExistsForField(field_id, amenity.trim());
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'Esta amenidad ya existe para esta cancha',
      });
    }

    const amenityData = {
      field_id,
      amenity: amenity.trim(),
      user_id_registration: req.user?.id || 1,
    };

    const newAmenity = await createFieldAmenity(amenityData);

    res.status(201).json({
      success: true,
      message: 'Amenidad creada exitosamente',
      data: newAmenity,
    });
  } catch (error) {
    console.error('Error al crear amenidad:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear amenidad',
    });
  }
};

/**
 * Crear múltiples amenidades para una cancha
 */
const createMultipleFieldAmenities = async (req, res) => {
  try {
    const { field_id, amenities } = req.body;

    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!amenities || !Array.isArray(amenities) || amenities.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar un array de amenidades',
      });
    }

    // Validar que todas las amenidades tengan contenido
    const validAmenities = amenities.filter(a => a && a.trim());
    if (validAmenities.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar al menos una amenidad válida',
      });
    }

    // Verificar duplicados en el array
    const uniqueAmenities = [...new Set(validAmenities.map(a => a.trim().toLowerCase()))];
    if (uniqueAmenities.length !== validAmenities.length) {
      return res.status(400).json({
        success: false,
        error: 'El array contiene amenidades duplicadas',
      });
    }

    const user_id = req.user?.id || 1;
    const createdAmenities = await createMultipleAmenities(
      field_id,
      validAmenities.map(a => a.trim()),
      user_id
    );

    res.status(201).json({
      success: true,
      message: 'Amenidades creadas exitosamente',
      data: createdAmenities,
      count: createdAmenities.length,
    });
  } catch (error) {
    console.error('Error al crear amenidades múltiples:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear amenidades múltiples',
    });
  }
};

/**
 * Actualizar una amenidad
 */
const updateExistingFieldAmenity = async (req, res) => {
  try {
    const { id } = req.params;
    const { amenity } = req.body;

    // Verificar si la amenidad existe
    const existingAmenity = await getFieldAmenityById(id);
    if (!existingAmenity) {
      return res.status(404).json({
        success: false,
        error: 'Amenidad no encontrada',
      });
    }

    if (!amenity || !amenity.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la amenidad es requerido',
      });
    }

    // Verificar si ya existe otra amenidad con el mismo nombre para esta cancha
    if (amenity.trim().toLowerCase() !== existingAmenity.amenity.toLowerCase()) {
      const exists = await amenityExistsForField(existingAmenity.field_id, amenity.trim(), id);
      if (exists) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe otra amenidad con este nombre para esta cancha',
        });
      }
    }

    const amenityData = {
      amenity: amenity.trim(),
      user_id_modification: req.user?.id || 1,
    };

    const updatedAmenity = await updateFieldAmenity(id, amenityData);

    res.json({
      success: true,
      message: 'Amenidad actualizada exitosamente',
      data: updatedAmenity,
    });
  } catch (error) {
    console.error('Error al actualizar amenidad:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar amenidad',
    });
  }
};

/**
 * Eliminar una amenidad
 */
const deleteFieldAmenityById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la amenidad existe
    const existingAmenity = await getFieldAmenityById(id);
    if (!existingAmenity) {
      return res.status(404).json({
        success: false,
        error: 'Amenidad no encontrada',
      });
    }

    const deleted = await deleteFieldAmenity(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Amenidad eliminada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar la amenidad',
      });
    }
  } catch (error) {
    console.error('Error al eliminar amenidad:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar amenidad',
    });
  }
};

/**
 * Eliminar todas las amenidades de una cancha
 */
const deleteAllAmenitiesByField = async (req, res) => {
  try {
    const { field_id } = req.params;

    const deletedCount = await deleteAllAmenitiesByFieldId(field_id);

    res.json({
      success: true,
      message: `Se eliminaron ${deletedCount} amenidades`,
      count: deletedCount,
    });
  } catch (error) {
    console.error('Error al eliminar amenidades:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar amenidades',
    });
  }
};

module.exports = {
  getFieldAmenities,
  getFieldAmenity,
  getAmenitiesByField,
  createNewFieldAmenity,
  createMultipleFieldAmenities,
  updateExistingFieldAmenity,
  deleteFieldAmenityById,
  deleteAllAmenitiesByField,
};
