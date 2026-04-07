const {
  getAllFieldSpecialPricing,
  getFieldSpecialPricingById,
  getSpecialPricingByFieldId,
  createFieldSpecialPricing,
  updateFieldSpecialPricing,
  deleteFieldSpecialPricing,
  hardDeleteFieldSpecialPricing,
  specialPricingNameExists,
  getApplicableSpecialPricing,
} = require('../models/fieldSpecialPricingModel');

/**
 * Obtener todos los precios especiales con filtros
 */
const getFieldSpecialPricings = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      is_active:
        req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      status: req.query.status,
      search: req.query.search,
    };

    const pricings = await getAllFieldSpecialPricing(filters);

    res.json({
      success: true,
      data: pricings,
      count: pricings.length,
    });
  } catch (error) {
    console.error('Error al obtener precios especiales:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener precios especiales',
    });
  }
};

/**
 * Obtener un precio especial por ID
 */
const getFieldSpecialPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const pricing = await getFieldSpecialPricingById(id);

    if (!pricing) {
      return res.status(404).json({
        success: false,
        error: 'Precio especial no encontrado',
      });
    }

    res.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    console.error('Error al obtener precio especial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener precio especial',
    });
  }
};

/**
 * Obtener precios especiales de una cancha específica
 */
const getSpecialPricingsByField = async (req, res) => {
  try {
    const { field_id } = req.params;
    const pricings = await getSpecialPricingByFieldId(field_id);

    res.json({
      success: true,
      data: pricings,
      count: pricings.length,
    });
  } catch (error) {
    console.error('Error al obtener precios especiales de la cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener precios especiales de la cancha',
    });
  }
};

/**
 * Obtener precios especiales aplicables para un día y hora
 */
const getApplicablePricing = async (req, res) => {
  try {
    const { field_id } = req.params;
    const { day, time } = req.query;

    if (!day || !time) {
      return res.status(400).json({
        success: false,
        error: 'El día y la hora son requeridos',
      });
    }

    const validDays = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];
    if (!validDays.includes(day.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `El día debe ser uno de: ${validDays.join(', ')}`,
      });
    }

    const pricings = await getApplicableSpecialPricing(field_id, day.toLowerCase(), time);

    res.json({
      success: true,
      data: pricings,
      count: pricings.length,
    });
  } catch (error) {
    console.error('Error al obtener precios especiales aplicables:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener precios especiales aplicables',
    });
  }
};

/**
 * Crear un nuevo precio especial
 */
const createNewFieldSpecialPricing = async (req, res) => {
  try {
    const { field_id, name, description, price, time_ranges, days, is_active, status } = req.body;

    // Validaciones básicas
    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre del precio especial es requerido',
      });
    }

    if (!price || price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El precio debe ser mayor a 0',
      });
    }

    // Validar rangos de tiempo si se proporcionan
    if (time_ranges && Array.isArray(time_ranges)) {
      for (const range of time_ranges) {
        if (!range.start || !range.end) {
          return res.status(400).json({
            success: false,
            error: 'Cada rango de tiempo debe tener "start" y "end"',
          });
        }
        if (range.start >= range.end) {
          return res.status(400).json({
            success: false,
            error: 'La hora de fin debe ser posterior a la hora de inicio en los rangos',
          });
        }
      }
    }

    // Validar días si se proporcionan
    if (days && Array.isArray(days)) {
      const validDays = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
      for (const day of days) {
        if (!validDays.includes(day.toLowerCase())) {
          return res.status(400).json({
            success: false,
            error: `Día inválido: ${day}. Debe ser uno de: ${validDays.join(', ')}`,
          });
        }
      }
    }

    // Verificar si ya existe un precio especial con el mismo nombre para esta cancha
    const exists = await specialPricingNameExists(field_id, name.trim());
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un precio especial con este nombre para esta cancha',
      });
    }

    const pricingData = {
      field_id,
      name: name.trim(),
      description: description?.trim(),
      price,
      time_ranges,
      days,
      is_active,
      status,
      user_id_registration: req.user?.id || 1,
    };

    const newPricing = await createFieldSpecialPricing(pricingData);

    res.status(201).json({
      success: true,
      message: 'Precio especial creado exitosamente',
      data: newPricing,
    });
  } catch (error) {
    console.error('Error al crear precio especial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear precio especial',
    });
  }
};

/**
 * Actualizar un precio especial
 */
const updateExistingFieldSpecialPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, time_ranges, days, is_active, status } = req.body;

    // Verificar si el precio especial existe
    const existingPricing = await getFieldSpecialPricingById(id);
    if (!existingPricing) {
      return res.status(404).json({
        success: false,
        error: 'Precio especial no encontrado',
      });
    }

    // Validar precio si se proporciona
    if (price !== undefined && price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El precio debe ser mayor a 0',
      });
    }

    // Validar rangos de tiempo si se proporcionan
    if (time_ranges && Array.isArray(time_ranges)) {
      for (const range of time_ranges) {
        if (!range.start || !range.end) {
          return res.status(400).json({
            success: false,
            error: 'Cada rango de tiempo debe tener "start" y "end"',
          });
        }
        if (range.start >= range.end) {
          return res.status(400).json({
            success: false,
            error: 'La hora de fin debe ser posterior a la hora de inicio en los rangos',
          });
        }
      }
    }

    // Validar días si se proporcionan
    if (days && Array.isArray(days)) {
      const validDays = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
      for (const day of days) {
        if (!validDays.includes(day.toLowerCase())) {
          return res.status(400).json({
            success: false,
            error: `Día inválido: ${day}. Debe ser uno de: ${validDays.join(', ')}`,
          });
        }
      }
    }

    // Si se actualiza el nombre, verificar que no exista
    if (name && name.trim() && name.trim().toLowerCase() !== existingPricing.name.toLowerCase()) {
      const exists = await specialPricingNameExists(existingPricing.field_id, name.trim(), id);
      if (exists) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe otro precio especial con este nombre para esta cancha',
        });
      }
    }

    const pricingData = {
      name: name?.trim(),
      description: description?.trim(),
      price,
      time_ranges,
      days,
      is_active,
      status,
      user_id_modification: req.user?.id || 1,
    };

    const updatedPricing = await updateFieldSpecialPricing(id, pricingData);

    res.json({
      success: true,
      message: 'Precio especial actualizado exitosamente',
      data: updatedPricing,
    });
  } catch (error) {
    console.error('Error al actualizar precio especial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar precio especial',
    });
  }
};

/**
 * Eliminar un precio especial (soft delete)
 */
const deleteFieldSpecialPricingById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el precio especial existe
    const existingPricing = await getFieldSpecialPricingById(id);
    if (!existingPricing) {
      return res.status(404).json({
        success: false,
        error: 'Precio especial no encontrado',
      });
    }

    const user_id = req.user?.id || 1;
    const deleted = await deleteFieldSpecialPricing(id, user_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Precio especial eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el precio especial',
      });
    }
  } catch (error) {
    console.error('Error al eliminar precio especial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar precio especial',
    });
  }
};

/**
 * Eliminar permanentemente un precio especial
 */
const hardDeletePricing = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el precio especial existe
    const existingPricing = await getFieldSpecialPricingById(id);
    if (!existingPricing) {
      return res.status(404).json({
        success: false,
        error: 'Precio especial no encontrado',
      });
    }

    const deleted = await hardDeleteFieldSpecialPricing(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Precio especial eliminado permanentemente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el precio especial',
      });
    }
  } catch (error) {
    console.error('Error al eliminar precio especial permanentemente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar precio especial permanentemente',
    });
  }
};

module.exports = {
  getFieldSpecialPricings,
  getFieldSpecialPricing,
  getSpecialPricingsByField,
  getApplicablePricing,
  createNewFieldSpecialPricing,
  updateExistingFieldSpecialPricing,
  deleteFieldSpecialPricingById,
  hardDeletePricing,
};
