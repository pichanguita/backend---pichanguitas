/**
 * Field Payment Methods Controller
 * Controlador para gestionar los métodos de pago de cada cancha
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  uploadFile,
  deleteFile,
  deleteFileByUrl,
  extractKeyFromUrl,
  getPublicUrl,
  toProxyUrl,
} = require('../services/wasabiService');
const { WASABI_FOLDERS } = require('../config/storage');
const {
  logActivity,
  resolveIp,
  ACTIVITY_TYPES,
  ACTIVITY_STATUS,
} = require('../services/activityLogsService');

/**
 * Normaliza cualquier URL (proxy /api/media/... o Wasabi directa)
 * al formato canónico Wasabi que se almacena en BD.
 */
const normalizeQrUrl = url => {
  if (!url) return url;
  const key = extractKeyFromUrl(url);
  return key ? getPublicUrl(key) : url;
};

/**
 * Verificar si el usuario tiene permisos para gestionar una cancha
 * Super admin puede gestionar cualquier cancha
 * Admin regular solo puede gestionar sus propias canchas
 */
const canManageField = async (userId, fieldId) => {
  // Obtener el rol del usuario
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: { roles: true },
  });

  // Si es super_admin, puede gestionar cualquier cancha
  if (user?.roles?.name === 'super_admin' || user?.role_id === 1) {
    // Verificar que la cancha existe
    const field = await prisma.fields.findUnique({
      where: { id: parseInt(fieldId) },
    });
    return field;
  }

  // Admin regular solo puede gestionar sus propias canchas
  const field = await prisma.fields.findFirst({
    where: {
      id: parseInt(fieldId),
      admin_id: userId,
    },
  });
  return field;
};

/**
 * Obtener métodos de pago de una cancha
 */
const getFieldPaymentMethods = async (req, res) => {
  try {
    const { fieldId } = req.params;

    const methods = await prisma.field_payment_methods.findMany({
      where: {
        field_id: parseInt(fieldId),
        status: 'active',
        is_enabled: true, // Solo mostrar métodos habilitados a los clientes
      },
      orderBy: {
        order_index: 'asc',
      },
    });

    const methodsWithProxy = methods.map(m => ({
      ...m,
      qr_image_url: toProxyUrl(m.qr_image_url),
    }));

    res.json({
      success: true,
      data: methodsWithProxy,
      count: methodsWithProxy.length,
    });
  } catch (error) {
    console.error('Error obteniendo métodos de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métodos de pago',
      details: error.message,
    });
  }
};

/**
 * Obtener todos los métodos de pago de las canchas de un admin
 * Super admin puede ver todas las canchas, admin regular solo las suyas
 */
const getAdminFieldsPaymentMethods = async (req, res) => {
  try {
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
      });
    }

    // Verificar si es super_admin
    const user = await prisma.users.findUnique({
      where: { id: adminId },
      include: { roles: true },
    });
    const isSuperAdmin = user?.roles?.name === 'super_admin' || user?.role_id === 1;

    // Construir query: super_admin ve todas, admin regular solo las suyas
    const whereClause = isSuperAdmin
      ? { status: 'available' }
      : { admin_id: adminId, status: 'available' };

    // Obtener las canchas
    const fields = await prisma.fields.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        field_payment_methods: {
          where: {
            status: 'active',
          },
          orderBy: {
            order_index: 'asc',
          },
        },
      },
    });

    const fieldsWithProxy = fields.map(f => ({
      ...f,
      field_payment_methods: f.field_payment_methods.map(m => ({
        ...m,
        qr_image_url: toProxyUrl(m.qr_image_url),
      })),
    }));

    res.json({
      success: true,
      data: fieldsWithProxy,
    });
  } catch (error) {
    console.error('Error obteniendo métodos de pago del admin:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métodos de pago',
      details: error.message,
    });
  }
};

/**
 * Crear o actualizar método de pago de una cancha
 */
const upsertFieldPaymentMethod = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const {
      method_type,
      is_enabled,
      account_number,
      account_holder,
      phone_number,
      qr_image_url,
      bank_name,
      cci_number,
      instructions,
      order_index,
    } = req.body;

    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
      });
    }

    // Verificar que el usuario tiene permisos para gestionar esta cancha
    const field = await canManageField(adminId, fieldId);

    if (!field) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para esta cancha',
      });
    }

    const normalizedQrUrl = normalizeQrUrl(qr_image_url);

    // Upsert: crear o actualizar
    const method = await prisma.field_payment_methods.upsert({
      where: {
        field_id_method_type: {
          field_id: parseInt(fieldId),
          method_type,
        },
      },
      update: {
        is_enabled,
        account_number,
        account_holder,
        phone_number,
        qr_image_url: normalizedQrUrl,
        bank_name,
        cci_number,
        instructions,
        order_index: order_index || 0,
        user_id_modification: adminId,
        date_time_modification: new Date(),
      },
      create: {
        field_id: parseInt(fieldId),
        method_type,
        is_enabled: is_enabled ?? true,
        account_number,
        account_holder,
        phone_number,
        qr_image_url: normalizedQrUrl,
        bank_name,
        cci_number,
        instructions,
        order_index: order_index || 0,
        user_id_registration: adminId,
      },
    });

    res.json({
      success: true,
      message: 'Método de pago guardado correctamente',
      data: { ...method, qr_image_url: toProxyUrl(method.qr_image_url) },
    });
  } catch (error) {
    console.error('Error guardando método de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al guardar método de pago',
      details: error.message,
    });
  }
};

/**
 * Actualizar múltiples métodos de pago de una cancha
 */
const updateFieldPaymentMethods = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { methods } = req.body;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
      });
    }

    // Verificar que el usuario tiene permisos para gestionar esta cancha
    const field = await canManageField(adminId, fieldId);

    if (!field) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para esta cancha',
      });
    }

    // Procesar cada método
    const results = [];
    for (const method of methods) {
      const normalizedQrUrl = normalizeQrUrl(method.qr_image_url);
      const result = await prisma.field_payment_methods.upsert({
        where: {
          field_id_method_type: {
            field_id: parseInt(fieldId),
            method_type: method.method_type,
          },
        },
        update: {
          is_enabled: method.is_enabled,
          account_number: method.account_number,
          account_holder: method.account_holder,
          phone_number: method.phone_number,
          qr_image_url: normalizedQrUrl,
          bank_name: method.bank_name,
          cci_number: method.cci_number,
          instructions: method.instructions,
          order_index: method.order_index || 0,
          user_id_modification: adminId,
          date_time_modification: new Date(),
        },
        create: {
          field_id: parseInt(fieldId),
          method_type: method.method_type,
          is_enabled: method.is_enabled ?? true,
          account_number: method.account_number,
          account_holder: method.account_holder,
          phone_number: method.phone_number,
          qr_image_url: normalizedQrUrl,
          bank_name: method.bank_name,
          cci_number: method.cci_number,
          instructions: method.instructions,
          order_index: method.order_index || 0,
          user_id_registration: adminId,
        },
      });
      results.push(result);
    }

    res.json({
      success: true,
      message: 'Métodos de pago actualizados correctamente',
      data: results.map(r => ({ ...r, qr_image_url: toProxyUrl(r.qr_image_url) })),
    });
  } catch (error) {
    console.error('Error actualizando métodos de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar métodos de pago',
      details: error.message,
    });
  }
};

/**
 * Eliminar método de pago (soft delete)
 */
const deleteFieldPaymentMethod = async (req, res) => {
  try {
    const { fieldId, methodType } = req.params;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
      });
    }

    // Verificar que el usuario tiene permisos para gestionar esta cancha
    const field = await canManageField(adminId, fieldId);

    if (!field) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para esta cancha',
      });
    }

    // Buscar el método antes de soft-delete para poder limpiar su QR
    const existing = await prisma.field_payment_methods.findUnique({
      where: {
        field_id_method_type: {
          field_id: parseInt(fieldId),
          method_type: methodType,
        },
      },
    });

    // Soft delete
    await prisma.field_payment_methods.updateMany({
      where: {
        field_id: parseInt(fieldId),
        method_type: methodType,
      },
      data: {
        status: 'deleted',
        qr_image_url: null,
        user_id_modification: adminId,
        date_time_modification: new Date(),
      },
    });

    // Limpieza: eliminar QR en Wasabi si existía
    if (existing?.qr_image_url) {
      await deleteFileByUrl(existing.qr_image_url);
    }

    res.json({
      success: true,
      message: 'Método de pago eliminado correctamente',
    });
  } catch (error) {
    console.error('Error eliminando método de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar método de pago',
      details: error.message,
    });
  }
};

/**
 * Subir imagen QR para método de pago
 */
const uploadQRImage = async (req, res) => {
  try {
    const { fieldId, methodType } = req.params;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se ha subido ninguna imagen',
      });
    }

    const field = await canManageField(adminId, fieldId);

    if (!field) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para esta cancha',
      });
    }

    // Eliminar QR anterior de Wasabi si existe
    const existingMethod = await prisma.field_payment_methods.findUnique({
      where: {
        field_id_method_type: {
          field_id: parseInt(fieldId),
          method_type: methodType,
        },
      },
    });
    if (existingMethod?.qr_image_url) {
      const oldKey = extractKeyFromUrl(existingMethod.qr_image_url);
      if (oldKey) {
        try {
          await deleteFile(oldKey);
        } catch (err) {
          console.error('Error al eliminar QR anterior de Wasabi:', err.message);
        }
      }
    }

    // Subir nueva imagen QR a Wasabi
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const result = await uploadFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      folder: WASABI_FOLDERS.PAYMENT_QR,
      customFilename: `qr-${fieldId}-${methodType}-${uniqueSuffix}`,
    });

    const qrImageUrl = result.url;

    const method = await prisma.field_payment_methods.upsert({
      where: {
        field_id_method_type: {
          field_id: parseInt(fieldId),
          method_type: methodType,
        },
      },
      update: {
        qr_image_url: qrImageUrl,
        user_id_modification: adminId,
        date_time_modification: new Date(),
      },
      create: {
        field_id: parseInt(fieldId),
        method_type: methodType,
        qr_image_url: qrImageUrl,
        user_id_registration: adminId,
      },
    });

    await logActivity({
      userId: field.admin_id || adminId,
      action: 'field.qr_updated',
      entityType: ACTIVITY_TYPES.FIELD,
      entityId: parseInt(fieldId),
      description: `Código QR de ${methodType} actualizado en "${field.name}"`,
      status: ACTIVITY_STATUS.SUCCESS,
      ipAddress: resolveIp(req),
      actorUserId: adminId,
    });

    res.json({
      success: true,
      message: 'Imagen QR subida correctamente',
      data: {
        qr_image_url: toProxyUrl(qrImageUrl),
        method: { ...method, qr_image_url: toProxyUrl(method.qr_image_url) },
      },
    });
  } catch (error) {
    console.error('Error subiendo imagen QR:', error);
    res.status(500).json({
      success: false,
      error: 'Error al subir imagen QR',
      details: error.message,
    });
  }
};

module.exports = {
  getFieldPaymentMethods,
  getAdminFieldsPaymentMethods,
  upsertFieldPaymentMethod,
  updateFieldPaymentMethods,
  deleteFieldPaymentMethod,
  uploadQRImage,
};
