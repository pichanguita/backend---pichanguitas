const {
  getAllConfig,
  getConfigByKey,
  updateConfig,
  updateMultipleConfig,
} = require('../models/gamificationConfigModel');

/**
 * Obtener toda la configuración de gamificación
 * GET /api/gamification-config
 */
const getConfig = async (req, res) => {
  try {
    const config = await getAllConfig();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error al obtener configuración de gamificación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración',
    });
  }
};

/**
 * Obtener una configuración específica
 * GET /api/gamification-config/:key
 */
const getConfigValue = async (req, res) => {
  try {
    const { key } = req.params;
    const value = await getConfigByKey(key);

    if (value === null) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada',
      });
    }

    res.json({
      success: true,
      data: { key, value },
    });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración',
    });
  }
};

/**
 * Actualizar una configuración específica
 * PUT /api/gamification-config/:key
 */
const updateConfigValue = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.user?.id;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'El valor es requerido',
      });
    }

    const updated = await updateConfig(key, value, userId);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada',
      });
    }

    res.json({
      success: true,
      message: 'Configuración actualizada',
      data: { key, value },
    });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar configuración',
    });
  }
};

/**
 * Actualizar múltiples configuraciones
 * PUT /api/gamification-config
 */
const updateMultipleConfigValues = async (req, res) => {
  try {
    const configs = req.body;
    const userId = req.user?.id;

    if (!configs || typeof configs !== 'object' || Object.keys(configs).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere al menos una configuración para actualizar',
      });
    }

    const updatedConfig = await updateMultipleConfig(configs, userId);

    res.json({
      success: true,
      message: 'Configuraciones actualizadas',
      data: updatedConfig,
    });
  } catch (error) {
    console.error('Error al actualizar configuraciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar configuraciones',
    });
  }
};

module.exports = {
  getConfig,
  getConfigValue,
  updateConfigValue,
  updateMultipleConfigValues,
};
