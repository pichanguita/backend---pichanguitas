const {
  getAllFields,
  getFieldById,
  createField,
  updateField,
  approveField,
  rejectField,
  deleteField,
  getFieldConfig,
  updateFieldConfig,
} = require('../models/fieldsModel');
const { createAlert } = require('../models/alertsModel');
const pool = require('../config/db');
const { transformFieldToCamelCase } = require('../utils/transformers');

/**
 * Obtener todas las canchas con filtros
 * IMPORTANTE: Aplica filtro automático por admin_id si el usuario es admin de cancha (rol 2)
 */
const getFields = async (req, res) => {
  try {
    const filters = {
      admin_id: req.query.admin_id ? parseInt(req.query.admin_id) : null,
      status: req.query.status,
      approval_status: req.query.approval_status,
      sport_type: req.query.sport_type ? parseInt(req.query.sport_type) : null,
      departamento: req.query.departamento,
      provincia: req.query.provincia,
      distrito: req.query.distrito,
      is_active:
        req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      search: req.query.search,
    };

    // FILTRO AUTOMÁTICO POR ROL
    // Si el usuario es admin de cancha (rol 2), solo puede ver sus propias canchas
    // Esto previene que un admin malicioso modifique el request para ver canchas de otros
    if (req.user && req.user.id_rol === 2) {
      filters.admin_id = req.user.id;
    }

    const fields = await getAllFields(filters);

    // Transformar a camelCase para el frontend
    const fieldsFormatted = fields.map(field => transformFieldToCamelCase(field));

    res.json({
      success: true,
      data: fieldsFormatted,
      count: fieldsFormatted.length,
    });
  } catch (error) {
    console.error('Error al obtener canchas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener canchas',
    });
  }
};

/**
 * Obtener una cancha por ID
 */
const getField = async (req, res) => {
  try {
    const { id } = req.params;
    const field = await getFieldById(id);

    if (!field) {
      return res.status(404).json({
        success: false,
        error: 'Cancha no encontrada',
      });
    }

    // Transformar a camelCase para el frontend
    const fieldFormatted = transformFieldToCamelCase(field);

    res.json({
      success: true,
      data: fieldFormatted,
    });
  } catch (error) {
    console.error('Error al obtener cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cancha',
    });
  }
};

/**
 * Crear una nueva cancha
 */
const createNewField = async (req, res) => {
  try {
    const {
      admin_id,
      name,
      location,
      departamento,
      provincia,
      distrito,
      district_id,
      address,
      phone,
      latitude,
      longitude,
      price_per_hour,
      status,
      approval_status: _approval_status,
      field_type,
      sport_type,
      sport_ids, // Array de IDs de deportes
      capacity,
      requires_advance_payment,
      advance_payment_amount, // Monto del adelanto
      is_active,
      is_multi_sport,
      // Campos adicionales
      dimensions, // { length, width, area, surface_type }
      amenities, // Array de strings
      equipment, // { has_jersey_rental, jersey_price, has_ball_rental, ... }
    } = req.body;

    // Validaciones básicas
    if (!admin_id || !name) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: admin_id, name',
      });
    }

    // Precio por hora es obligatorio siempre
    if (!price_per_hour || parseFloat(price_per_hour) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El precio por hora es obligatorio y debe ser mayor a 0',
      });
    }

    // Validar coordenadas (obligatorias para que la cancha aparezca en el mapa)
    if (latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        error: 'Las coordenadas (latitude, longitude) son obligatorias. Selecciona la ubicación en el mapa.',
      });
    }

    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({
        success: false,
        error: 'Las coordenadas deben ser valores numéricos válidos.',
      });
    }
    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Las coordenadas están fuera de rango válido (lat: -90 a 90, lng: -180 a 180).',
      });
    }

    // ============================================
    // 🔒 SEGURIDAD: Determinar estado de aprobación según rol
    // ============================================
    const userRole = req.user?.id_rol;
    let finalApprovalStatus = 'pending'; // Por defecto siempre pending

    // Super_admin (id_rol = 1): canchas se aprueban automáticamente
    if (userRole === 1) {
      finalApprovalStatus = 'approved';
    }
    // Admin de cancha (id_rol = 2): requiere aprobación del super_admin (permanece en pending)

    const fieldData = {
      admin_id,
      name: name.trim(),
      location,
      departamento,
      provincia,
      distrito,
      district_id,
      address,
      phone,
      latitude,
      longitude,
      price_per_hour: price_per_hour || 0,
      status,
      approval_status: finalApprovalStatus, // ✅ Usar el valor validado
      field_type,
      sport_type,
      sport_ids: sport_ids || [], // Array de IDs de todos los deportes
      capacity,
      requires_advance_payment,
      advance_payment_amount: advance_payment_amount || 0,
      is_active,
      is_multi_sport,
      created_by: req.user?.id || admin_id,
      user_id_registration: req.user?.id || admin_id,
      // Campos adicionales para tablas relacionadas
      dimensions: dimensions || null,
      amenities: amenities || [],
      equipment: equipment || null,
    };

    const newField = await createField(fieldData);

    // ============================================
    // 🔔 ALERTAS: Notificar a super_admins si la cancha requiere aprobación
    // ============================================
    if (finalApprovalStatus === 'pending') {
      try {
        // Buscar todos los super_admins (role_id = 1)
        const superAdminsResult = await pool.query(
          'SELECT id, name FROM users WHERE role_id = 1 AND is_active = true'
        );
        const superAdmins = superAdminsResult.rows;

        // Obtener nombre del admin que creó la cancha
        const creatorName = req.user?.name || 'Un administrador';

        // Crear alerta para cada super_admin
        for (const superAdmin of superAdmins) {
          await createAlert({
            type: 'field_pending_approval',
            title: 'Nueva cancha pendiente de aprobación',
            message: `${creatorName} ha registrado la cancha "${newField.name}" y requiere tu aprobación.`,
            field_id: newField.id,
            user_id: req.user?.id, // Admin que creó la cancha
            admin_id: superAdmin.id, // Super admin que recibe la alerta
            priority: 'high',
            status: 'unread',
            user_id_registration: req.user?.id,
          });
        }
      } catch (alertError) {
        // No fallar la creación de cancha si falla la alerta
        console.error('Error al crear alertas:', alertError);
      }
    }

    // Transformar a camelCase para el frontend
    const newFieldFormatted = transformFieldToCamelCase(newField);

    res.status(201).json({
      success: true,
      message: 'Cancha creada exitosamente',
      data: newFieldFormatted,
    });
  } catch (error) {
    console.error('Error al crear cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear cancha',
    });
  }
};

/**
 * Actualizar una cancha
 */
const updateExistingField = async (req, res) => {
  try {
    const { id } = req.params;

    // Aceptar tanto snake_case como camelCase del frontend
    const body = req.body;
    const name = body.name;
    const location = body.location;
    const departamento = body.departamento;
    const provincia = body.provincia;
    const distrito = body.distrito;
    const district_id = body.district_id || body.districtId;
    const address = body.address;
    const phone = body.phone;
    const latitude = body.latitude;
    const longitude = body.longitude;
    const price_per_hour = body.price_per_hour ?? body.pricePerHour;
    const status = body.status;
    const field_type = body.field_type || body.fieldType;
    const sport_type = body.sport_type || body.sportType;
    const sport_ids = body.sport_ids || body.sportTypes || body.sportIds || []; // Array de IDs de deportes
    const capacity = body.capacity;
    const requires_advance_payment = body.requires_advance_payment ?? body.requiresAdvancePayment;
    const advance_payment_amount = body.advance_payment_amount || body.advancePaymentAmount;
    const is_active = body.is_active ?? body.isActive;
    const is_multi_sport = body.is_multi_sport ?? body.isMultiSport;
    // Campos adicionales
    const dimensions = body.dimensions; // { length, width, area, surface_type }
    const amenities = body.amenities || []; // Array de strings
    const equipment = body.equipment; // { has_jersey_rental, jersey_price, has_ball_rental, ... }

    // Verificar si la cancha existe
    const existingField = await getFieldById(id);
    if (!existingField) {
      return res.status(404).json({
        success: false,
        error: 'Cancha no encontrada',
      });
    }

    const fieldData = {
      name: name?.trim(),
      location,
      departamento,
      provincia,
      distrito,
      district_id,
      address,
      phone,
      latitude,
      longitude,
      price_per_hour: price_per_hour ?? 0,
      status,
      field_type,
      sport_type,
      sport_ids: sport_ids || [], // Array de IDs de todos los deportes
      capacity,
      requires_advance_payment,
      advance_payment_amount: advance_payment_amount || 0,
      is_active,
      is_multi_sport,
      user_id_modification: req.user?.id || 1,
      // Campos adicionales para tablas relacionadas
      dimensions: dimensions || null,
      amenities: amenities || [],
      equipment: equipment || null,
    };

    await updateField(id, fieldData);

    // Obtener el campo completo con todas las relaciones (sports, amenities, dimensions, equipment)
    const completeField = await getFieldById(id);

    // Transformar a camelCase para el frontend
    const updatedFieldFormatted = transformFieldToCamelCase(completeField);

    res.json({
      success: true,
      message: 'Cancha actualizada exitosamente',
      data: updatedFieldFormatted,
    });
  } catch (error) {
    console.error('❌ [PUT] Error al actualizar cancha:', error);
    console.error('❌ [PUT] Error detalle:', error.message);
    console.error('❌ [PUT] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar cancha',
      details: error.message,
    });
  }
};

/**
 * Aprobar una cancha
 */
const approveFieldById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la cancha existe
    const existingField = await getFieldById(id);
    if (!existingField) {
      return res.status(404).json({
        success: false,
        error: 'Cancha no encontrada',
      });
    }

    if (existingField.approval_status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'La cancha ya está aprobada',
      });
    }

    const approved_by = req.user?.id || 1;
    const approvedField = await approveField(id, approved_by);

    // ✅ Eliminar alertas de tipo 'field_pending_approval' para esta cancha
    try {
      await pool.query(
        `DELETE FROM alerts
         WHERE type = 'field_pending_approval' AND field_id = $1`,
        [id]
      );
      console.log(`✅ Alertas de aprobación pendiente eliminadas para cancha ${id}`);
    } catch (alertError) {
      // No fallar la aprobación si falla la limpieza de alertas
      console.error('Error al eliminar alertas:', alertError);
    }

    // Transformar a camelCase para el frontend
    const approvedFieldFormatted = transformFieldToCamelCase(approvedField);

    res.json({
      success: true,
      message: 'Cancha aprobada exitosamente',
      data: approvedFieldFormatted,
    });
  } catch (error) {
    console.error('Error al aprobar cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al aprobar cancha',
    });
  }
};

/**
 * Rechazar una cancha
 */
const rejectFieldById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'La razón del rechazo es requerida',
      });
    }

    // Verificar si la cancha existe
    const existingField = await getFieldById(id);
    if (!existingField) {
      return res.status(404).json({
        success: false,
        error: 'Cancha no encontrada',
      });
    }

    const rejected_by = req.user?.id || 1;
    const rejectedField = await rejectField(id, rejected_by, rejection_reason);

    // ✅ Eliminar alertas de tipo 'field_pending_approval' para esta cancha
    try {
      await pool.query(
        `DELETE FROM alerts
         WHERE type = 'field_pending_approval' AND field_id = $1`,
        [id]
      );
      console.log(`✅ Alertas de aprobación pendiente eliminadas para cancha ${id}`);
    } catch (alertError) {
      // No fallar el rechazo si falla la limpieza de alertas
      console.error('Error al eliminar alertas:', alertError);
    }

    // Transformar a camelCase para el frontend
    const rejectedFieldFormatted = transformFieldToCamelCase(rejectedField);

    res.json({
      success: true,
      message: 'Cancha rechazada exitosamente',
      data: rejectedFieldFormatted,
    });
  } catch (error) {
    console.error('Error al rechazar cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al rechazar cancha',
    });
  }
};

/**
 * Eliminar una cancha (soft delete)
 */
const deleteFieldById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la cancha existe
    const existingField = await getFieldById(id);
    if (!existingField) {
      return res.status(404).json({
        success: false,
        error: 'Cancha no encontrada',
      });
    }

    const user_id = req.user?.id || 1;
    const deleted = await deleteField(id, user_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Cancha eliminada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar la cancha',
      });
    }
  } catch (error) {
    console.error('Error al eliminar cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar cancha',
    });
  }
};

/**
 * Obtener configuración completa de una cancha
 */
const getFieldConfiguration = async (req, res) => {
  try {
    const { id } = req.params;
    const config = await getFieldConfig(id);

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error al obtener configuración de cancha:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener configuración de cancha',
    });
  }
};

/**
 * Actualizar configuración completa de una cancha
 */
const updateFieldConfiguration = async (req, res) => {
  try {
    const { id } = req.params;
    const configData = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    const updatedConfig = await updateFieldConfig(id, configData, userId);

    res.json({
      success: true,
      data: updatedConfig,
      message: 'Configuración actualizada correctamente',
    });
  } catch (error) {
    console.error('Error al actualizar configuración de cancha:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al actualizar configuración de cancha',
    });
  }
};

module.exports = {
  getFields,
  getField,
  createNewField,
  updateExistingField,
  approveFieldById,
  rejectFieldById,
  deleteFieldById,
  getFieldConfiguration,
  updateFieldConfiguration,
};
