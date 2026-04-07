const {
  getAllBlacklist,
  getBlacklistById,
  checkPhoneInBlacklist,
  createBlacklist,
  updateBlacklist,
  unblockPhone,
  deleteBlacklist,
  phoneHasActiveBlock,
  getBlacklistStats,
  updateExpiredBlocks,
} = require('../models/blacklistModel');

/**
 * Obtener todos los registros de la lista negra con filtros
 */
const getBlacklistRecords = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      phone_number: req.query.phone_number,
      search: req.query.search,
      active_only: req.query.active_only,
    };

    const records = await getAllBlacklist(filters);

    res.json({
      success: true,
      data: records,
      count: records.length,
    });
  } catch (error) {
    console.error('Error al obtener registros de lista negra:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener registros de lista negra',
    });
  }
};

/**
 * Obtener un registro por ID
 */
const getBlacklistRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await getBlacklistById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado',
      });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('Error al obtener registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener registro',
    });
  }
};

/**
 * Verificar si un teléfono está bloqueado
 */
const checkPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El número de teléfono es requerido',
      });
    }

    const record = await checkPhoneInBlacklist(phone.trim());

    if (record) {
      return res.json({
        success: true,
        blocked: true,
        message: 'El teléfono está bloqueado',
        data: record,
      });
    }

    res.json({
      success: true,
      blocked: false,
      message: 'El teléfono no está bloqueado',
    });
  } catch (error) {
    console.error('Error al verificar teléfono:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar teléfono',
    });
  }
};

/**
 * Crear un nuevo registro en la lista negra
 */
const createBlacklistRecord = async (req, res) => {
  try {
    const { phone_number, customer_name, reason, blocked_until, reservations_missed } = req.body;

    // Validaciones básicas
    if (!phone_number || !phone_number.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El número de teléfono es requerido',
      });
    }

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre del cliente es requerido',
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'La razón del bloqueo es requerida',
      });
    }

    // Verificar si el teléfono ya tiene un bloqueo activo
    const hasActiveBlock = await phoneHasActiveBlock(phone_number.trim());
    if (hasActiveBlock) {
      return res.status(409).json({
        success: false,
        error: 'Este teléfono ya tiene un bloqueo activo',
      });
    }

    const blacklistData = {
      phone_number: phone_number.trim(),
      customer_name: customer_name.trim(),
      reason: reason.trim(),
      blocked_by: req.user?.id || 1,
      blocked_until: blocked_until || null,
      reservations_missed: reservations_missed || 0,
      user_id_registration: req.user?.id || 1,
    };

    const newRecord = await createBlacklist(blacklistData);

    res.status(201).json({
      success: true,
      message: 'Cliente bloqueado exitosamente',
      data: newRecord,
    });
  } catch (error) {
    console.error('Error al crear registro de lista negra:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear registro de lista negra',
    });
  }
};

/**
 * Actualizar un registro de la lista negra
 */
const updateBlacklistRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone_number, customer_name, reason, blocked_until, reservations_missed, status } =
      req.body;

    // Verificar si el registro existe
    const existingRecord = await getBlacklistById(id);
    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado',
      });
    }

    // Si se está actualizando el teléfono, verificar que no haya otro bloqueo activo
    if (
      phone_number &&
      phone_number.trim() &&
      phone_number.trim() !== existingRecord.phone_number
    ) {
      const hasActiveBlock = await phoneHasActiveBlock(phone_number.trim(), id);
      if (hasActiveBlock) {
        return res.status(409).json({
          success: false,
          error: 'Este teléfono ya tiene un bloqueo activo',
        });
      }
    }

    const blacklistData = {
      phone_number: phone_number?.trim(),
      customer_name: customer_name?.trim(),
      reason: reason?.trim(),
      blocked_until: blocked_until !== undefined ? blocked_until : undefined,
      reservations_missed,
      status,
      user_id_modification: req.user?.id || 1,
    };

    const updatedRecord = await updateBlacklist(id, blacklistData);

    res.json({
      success: true,
      message: 'Registro actualizado exitosamente',
      data: updatedRecord,
    });
  } catch (error) {
    console.error('Error al actualizar registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar registro',
    });
  }
};

/**
 * Desbloquear un teléfono
 */
const unblockPhoneNumber = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el registro existe
    const existingRecord = await getBlacklistById(id);
    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado',
      });
    }

    // Verificar que esté activo
    if (existingRecord.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Este registro ya está inactivo',
      });
    }

    const user_id = req.user?.id || 1;
    const unlockedRecord = await unblockPhone(id, user_id);

    res.json({
      success: true,
      message: 'Cliente desbloqueado exitosamente',
      data: unlockedRecord,
    });
  } catch (error) {
    console.error('Error al desbloquear cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al desbloquear cliente',
    });
  }
};

/**
 * Eliminar un registro de la lista negra
 */
const deleteBlacklistRecord = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el registro existe
    const existingRecord = await getBlacklistById(id);
    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado',
      });
    }

    const deleted = await deleteBlacklist(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Registro eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el registro',
      });
    }
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar registro',
    });
  }
};

/**
 * Obtener estadísticas de la lista negra
 */
const getStats = async (req, res) => {
  try {
    const stats = await getBlacklistStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de lista negra:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de lista negra',
    });
  }
};

/**
 * Actualizar bloqueos expirados (CRON job endpoint)
 */
const updateExpired = async (req, res) => {
  try {
    const updatedCount = await updateExpiredBlocks();

    res.json({
      success: true,
      message: `Se desactivaron ${updatedCount} bloqueos expirados`,
      count: updatedCount,
    });
  } catch (error) {
    console.error('Error al actualizar bloqueos expirados:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar bloqueos expirados',
    });
  }
};

module.exports = {
  getBlacklistRecords,
  getBlacklistRecord,
  checkPhone,
  createBlacklistRecord,
  updateBlacklistRecord,
  unblockPhoneNumber,
  deleteBlacklistRecord,
  getStats,
  updateExpired,
};
