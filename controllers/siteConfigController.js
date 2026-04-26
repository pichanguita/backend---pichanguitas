const pool = require('../config/db');
const {
  uploadFile,
  deleteFile,
  extractKeyFromUrl,
  toProxyUrl,
  keyToProxyUrl,
} = require('../services/wasabiService');
const { WASABI_FOLDERS, SITE_CONFIG_DEFAULTS } = require('../config/storage');

// Transforma URLs Wasabi almacenadas al formato proxy que consume el FE.
const transformValueForResponse = value => {
  if (!value || typeof value !== 'object') return value;
  if (value.url) {
    return { ...value, url: toProxyUrl(value.url) };
  }
  return value;
};

// Valores por defecto expuestos al cliente, derivados de Wasabi.
const buildDefaultValues = () => ({
  heroBackground: {
    url: keyToProxyUrl(SITE_CONFIG_DEFAULTS.heroBackground.key),
    alt: SITE_CONFIG_DEFAULTS.heroBackground.alt,
    type: SITE_CONFIG_DEFAULTS.heroBackground.type,
    isDefault: true,
  },
});

/**
 * GET /api/site-config
 * Obtener toda la configuracion del sitio
 */
const getAllSiteConfig = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, key, value, date_time_registration, date_time_modification FROM site_config ORDER BY key'
    );

    const defaultValues = buildDefaultValues();

    // Formatear respuesta
    const config = {};
    result.rows.forEach(row => {
      const value = transformValueForResponse(row.value) || {};
      config[row.key] = {
        id: row.id,
        ...value,
        registered: row.date_time_registration,
        modified: row.date_time_modification,
        isDefault: false,
      };
    });

    // Agregar valores por defecto para keys que no existen en la DB
    Object.keys(defaultValues).forEach(key => {
      if (!config[key]) {
        config[key] = defaultValues[key];
      }
    });

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error al obtener configuracion del sitio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuracion del sitio',
      error: error.message,
    });
  }
};

/**
 * GET /api/site-config/:key
 * Obtener un valor especifico de configuracion
 */
const getSiteConfigByKey = async (req, res) => {
  try {
    const { key } = req.params;

    const result = await pool.query(
      'SELECT id, key, value, date_time_registration, date_time_modification FROM site_config WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      const defaultValues = buildDefaultValues();
      if (defaultValues[key]) {
        return res.json({
          success: true,
          data: {
            key: key,
            ...defaultValues[key],
          },
        });
      }

      return res.status(404).json({
        success: false,
        message: `Configuracion '${key}' no encontrada`,
      });
    }

    const row = result.rows[0];
    const value = transformValueForResponse(row.value) || {};
    res.json({
      success: true,
      data: {
        id: row.id,
        key: row.key,
        ...value,
        registered: row.date_time_registration,
        modified: row.date_time_modification,
        isDefault: false,
      },
    });
  } catch (error) {
    console.error('Error al obtener configuracion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuracion',
      error: error.message,
    });
  }
};

/**
 * POST /api/site-config/upload-image
 * Subir una imagen para el sitio (Hero, Logo, etc.) a Wasabi
 */
const uploadSiteImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se subio ninguna imagen',
      });
    }

    const { key, alt } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'El campo "key" es requerido (ej: heroBackground, logo, etc.)',
      });
    }

    // Subir a Wasabi
    const result = await uploadFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      folder: WASABI_FOLDERS.SITE_IMAGES,
      customFilename: `${key}_${Date.now()}`,
    });

    // Preparar el valor JSONB
    const value = {
      url: result.url,
      alt: alt || `Imagen ${key}`,
      type: 'upload',
      filename: result.filename,
      originalName: req.file.originalname,
      size: result.size,
      mimetype: req.file.mimetype,
      wasabiKey: result.key,
    };

    // Verificar si ya existe un registro con esta key
    const existingResult = await pool.query('SELECT id, value FROM site_config WHERE key = $1', [
      key,
    ]);

    let dbResult;
    const userId = req.user?.id_usuario || null;

    if (existingResult.rows.length > 0) {
      const oldValue = existingResult.rows[0].value;

      // Si habia una imagen anterior en Wasabi, eliminarla
      if (oldValue.type === 'upload') {
        const oldKey = oldValue.wasabiKey || extractKeyFromUrl(oldValue.url);
        if (oldKey) {
          try {
            await deleteFile(oldKey);
          } catch (err) {
            console.error('Error al eliminar imagen anterior de Wasabi:', err.message);
          }
        }
      }

      dbResult = await pool.query(
        `UPDATE site_config
         SET value = $1, user_id_modification = $2, date_time_modification = NOW()
         WHERE key = $3
         RETURNING id, key, value, date_time_registration, date_time_modification`,
        [JSON.stringify(value), userId, key]
      );
    } else {
      dbResult = await pool.query(
        `INSERT INTO site_config (key, value, user_id_registration, date_time_registration)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, key, value, date_time_registration, date_time_modification`,
        [key, JSON.stringify(value), userId]
      );
    }

    const row = dbResult.rows[0];
    const responseValue = transformValueForResponse(row.value) || {};
    res.json({
      success: true,
      message:
        existingResult.rows.length > 0
          ? 'Imagen actualizada correctamente'
          : 'Imagen subida correctamente',
      data: {
        id: row.id,
        key: row.key,
        ...responseValue,
        registered: row.date_time_registration,
        modified: row.date_time_modification,
      },
    });
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir imagen',
      error: error.message,
    });
  }
};

/**
 * PUT /api/site-config/:key
 * Actualizar configuracion por URL externa o cambiar valores
 */
const updateSiteConfigByKey = async (req, res) => {
  try {
    const { key } = req.params;
    const { url, alt, type, value: customValue } = req.body;

    if (!url && !customValue) {
      return res.status(400).json({
        success: false,
        message: 'Debes proporcionar "url" o "value" para actualizar',
      });
    }

    const value = customValue || {
      url: url || '',
      alt: alt || `Imagen ${key}`,
      type: type || 'url',
    };

    const userId = req.user?.id_usuario || null;

    const existingResult = await pool.query('SELECT id, value FROM site_config WHERE key = $1', [
      key,
    ]);

    let result;

    if (existingResult.rows.length > 0) {
      const oldValue = existingResult.rows[0].value;

      // Si se cambia de upload a url, eliminar la imagen anterior de Wasabi
      if (oldValue.type === 'upload' && value.type === 'url') {
        const oldKey = oldValue.wasabiKey || extractKeyFromUrl(oldValue.url);
        if (oldKey) {
          try {
            await deleteFile(oldKey);
          } catch (err) {
            console.error('Error al eliminar imagen anterior de Wasabi:', err.message);
          }
        }
      }

      result = await pool.query(
        `UPDATE site_config
         SET value = $1, user_id_modification = $2, date_time_modification = NOW()
         WHERE key = $3
         RETURNING id, key, value, date_time_registration, date_time_modification`,
        [JSON.stringify(value), userId, key]
      );
    } else {
      result = await pool.query(
        `INSERT INTO site_config (key, value, user_id_registration, date_time_registration)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, key, value, date_time_registration, date_time_modification`,
        [key, JSON.stringify(value), userId]
      );
    }

    const row = result.rows[0];
    const responseValue = transformValueForResponse(row.value) || {};
    res.json({
      success: true,
      message:
        existingResult.rows.length > 0
          ? 'Configuracion actualizada correctamente'
          : 'Configuracion creada correctamente',
      data: {
        id: row.id,
        key: row.key,
        ...responseValue,
        registered: row.date_time_registration,
        modified: row.date_time_modification,
      },
    });
  } catch (error) {
    console.error('Error al actualizar configuracion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuracion',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/site-config/:key
 * Eliminar una configuracion (y su imagen de Wasabi si es upload)
 */
const deleteSiteConfigByKey = async (req, res) => {
  try {
    const { key } = req.params;

    const existingResult = await pool.query('SELECT id, value FROM site_config WHERE key = $1', [
      key,
    ]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Configuracion '${key}' no encontrada`,
      });
    }

    const oldValue = existingResult.rows[0].value;

    // Si es una imagen subida, eliminarla de Wasabi
    if (oldValue.type === 'upload') {
      const oldKey = oldValue.wasabiKey || extractKeyFromUrl(oldValue.url);
      if (oldKey) {
        try {
          await deleteFile(oldKey);
        } catch (err) {
          console.error('Error al eliminar imagen de Wasabi:', err.message);
        }
      }
    }

    await pool.query('DELETE FROM site_config WHERE key = $1', [key]);

    res.json({
      success: true,
      message: `Configuracion '${key}' eliminada correctamente`,
    });
  } catch (error) {
    console.error('Error al eliminar configuracion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar configuracion',
      error: error.message,
    });
  }
};

module.exports = {
  getAllSiteConfig,
  getSiteConfigByKey,
  uploadSiteImage,
  updateSiteConfigByKey,
  deleteSiteConfigByKey,
};
