const {
  getAllFieldImages,
  getFieldImageById,
  getImagesByFieldId,
  getPrimaryImageByFieldId,
  createFieldImage,
  updateFieldImage,
  setPrimaryImage,
  deleteFieldImage,
  deleteAllImagesByFieldId,
  reorderImages,
} = require('../models/fieldImagesModel');
const { uploadFile, deleteFile, extractKeyFromUrl, toProxyUrl } = require('../services/wasabiService');
const { WASABI_FOLDERS } = require('../config/storage');
const pool = require('../config/db');
const {
  logActivity,
  resolveIp,
  ACTIVITY_TYPES,
  ACTIVITY_STATUS,
} = require('../services/activityLogsService');

const getFieldAdminId = async fieldId => {
  try {
    const { rows } = await pool.query('SELECT admin_id, name FROM fields WHERE id = $1', [
      fieldId,
    ]);
    return rows[0] || null;
  } catch (_e) {
    return null;
  }
};

/**
 * Obtener todas las imagenes con filtros
 */
const getFieldImages = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      category: req.query.category,
      is_primary:
        req.query.is_primary === 'true'
          ? true
          : req.query.is_primary === 'false'
            ? false
            : undefined,
    };

    const images = await getAllFieldImages(filters);
    const imagesWithProxy = images.map(img => ({ ...img, image_url: toProxyUrl(img.image_url) }));

    res.json({
      success: true,
      data: imagesWithProxy,
      count: imagesWithProxy.length,
    });
  } catch (error) {
    console.error('Error al obtener imagenes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener imagenes',
    });
  }
};

/**
 * Obtener una imagen por ID
 */
const getFieldImage = async (req, res) => {
  try {
    const { id } = req.params;
    const image = await getFieldImageById(id);

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Imagen no encontrada',
      });
    }

    res.json({
      success: true,
      data: { ...image, image_url: toProxyUrl(image.image_url) },
    });
  } catch (error) {
    console.error('Error al obtener imagen:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener imagen',
    });
  }
};

/**
 * Obtener imagenes de una cancha especifica
 */
const getImagesByField = async (req, res) => {
  try {
    const { field_id } = req.params;
    const images = await getImagesByFieldId(field_id);
    const imagesWithProxy = images.map(img => ({ ...img, image_url: toProxyUrl(img.image_url) }));

    res.json({
      success: true,
      data: imagesWithProxy,
      count: imagesWithProxy.length,
    });
  } catch (error) {
    console.error('Error al obtener imagenes de la cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener imagenes de la cancha',
    });
  }
};

/**
 * Obtener imagen principal de una cancha
 */
const getPrimaryImage = async (req, res) => {
  try {
    const { field_id } = req.params;
    const image = await getPrimaryImageByFieldId(field_id);

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'No se encontro imagen principal para esta cancha',
      });
    }

    res.json({
      success: true,
      data: { ...image, image_url: toProxyUrl(image.image_url) },
    });
  } catch (error) {
    console.error('Error al obtener imagen principal:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener imagen principal',
    });
  }
};

/**
 * Crear una nueva imagen (por URL, sin upload)
 */
const createNewFieldImage = async (req, res) => {
  try {
    const { field_id, image_url, category, is_primary, order_index } = req.body;

    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!image_url || !image_url.trim()) {
      return res.status(400).json({
        success: false,
        error: 'La URL de la imagen es requerida',
      });
    }

    const imageData = {
      field_id,
      image_url: image_url.trim(),
      category: category?.trim(),
      is_primary: is_primary || false,
      order_index: order_index !== undefined ? order_index : 0,
      user_id_registration: req.user?.id || 1,
    };

    const newImage = await createFieldImage(imageData);

    res.status(201).json({
      success: true,
      message: 'Imagen creada exitosamente',
      data: newImage,
    });
  } catch (error) {
    console.error('Error al crear imagen:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear imagen',
    });
  }
};

/**
 * Actualizar una imagen
 */
const updateExistingFieldImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { image_url, category, is_primary, order_index } = req.body;

    const existingImage = await getFieldImageById(id);
    if (!existingImage) {
      return res.status(404).json({
        success: false,
        error: 'Imagen no encontrada',
      });
    }

    const imageData = {
      image_url: image_url?.trim(),
      category: category?.trim(),
      is_primary,
      order_index,
      user_id_modification: req.user?.id || 1,
    };

    const updatedImage = await updateFieldImage(id, imageData);

    res.json({
      success: true,
      message: 'Imagen actualizada exitosamente',
      data: updatedImage,
    });
  } catch (error) {
    console.error('Error al actualizar imagen:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar imagen',
    });
  }
};

/**
 * Marcar una imagen como principal
 */
const setAsPrimaryImage = async (req, res) => {
  try {
    const { id } = req.params;

    const existingImage = await getFieldImageById(id);
    if (!existingImage) {
      return res.status(404).json({
        success: false,
        error: 'Imagen no encontrada',
      });
    }

    const user_id = req.user?.id || 1;
    const updatedImage = await setPrimaryImage(id, user_id);

    res.json({
      success: true,
      message: 'Imagen marcada como principal exitosamente',
      data: updatedImage,
    });
  } catch (error) {
    console.error('Error al marcar imagen como principal:', error);
    res.status(500).json({
      success: false,
      error: 'Error al marcar imagen como principal',
    });
  }
};

/**
 * Reordenar imagenes
 */
const reorderFieldImages = async (req, res) => {
  try {
    const { image_orders } = req.body;

    if (!image_orders || !Array.isArray(image_orders) || image_orders.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar un array de ordenes de imagenes',
      });
    }

    for (const item of image_orders) {
      if (!item.id || item.order_index === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Cada elemento debe tener id y order_index',
        });
      }
    }

    const user_id = req.user?.id || 1;
    await reorderImages(image_orders, user_id);

    res.json({
      success: true,
      message: 'Imagenes reordenadas exitosamente',
    });
  } catch (error) {
    console.error('Error al reordenar imagenes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al reordenar imagenes',
    });
  }
};

/**
 * Eliminar una imagen (BD + Wasabi)
 */
const deleteFieldImageById = async (req, res) => {
  try {
    const { id } = req.params;

    const existingImage = await getFieldImageById(id);
    if (!existingImage) {
      return res.status(404).json({
        success: false,
        error: 'Imagen no encontrada',
      });
    }

    // Eliminar archivo de Wasabi si existe
    const key = extractKeyFromUrl(existingImage.image_url);
    if (key) {
      try {
        await deleteFile(key);
      } catch (err) {
        console.error('Error al eliminar archivo de Wasabi:', err.message);
      }
    }

    const deleted = await deleteFieldImage(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Imagen eliminada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar la imagen',
      });
    }
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar imagen',
    });
  }
};

/**
 * Eliminar todas las imagenes de una cancha
 */
const deleteAllImagesByField = async (req, res) => {
  try {
    const { field_id } = req.params;

    // Obtener todas las imagenes para eliminarlas de Wasabi
    const images = await getImagesByFieldId(field_id);
    for (const img of images) {
      const key = extractKeyFromUrl(img.image_url);
      if (key) {
        try {
          await deleteFile(key);
        } catch (err) {
          console.error('Error al eliminar archivo de Wasabi:', err.message);
        }
      }
    }

    const deletedCount = await deleteAllImagesByFieldId(field_id);

    res.json({
      success: true,
      message: `Se eliminaron ${deletedCount} imagenes`,
      count: deletedCount,
    });
  } catch (error) {
    console.error('Error al eliminar imagenes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar imagenes',
    });
  }
};

/**
 * POST /api/field-images/upload
 * Subir imagen a Wasabi y guardar registro en BD
 */
const uploadFieldImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se subio ninguna imagen',
      });
    }

    const { field_id, category, is_primary } = req.body;

    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha (field_id) es requerido',
      });
    }

    // Subir a Wasabi
    const result = await uploadFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      folder: WASABI_FOLDERS.FIELDS_PHOTOS,
      customFilename: `field${field_id}_${Date.now()}`,
    });

    // Crear registro en base de datos con la URL de Wasabi
    const imageData = {
      field_id: parseInt(field_id),
      image_url: result.url,
      category: category?.trim() || 'general',
      is_primary: is_primary === 'true' || is_primary === true,
      order_index: 0,
      user_id_registration: req.user?.id || 1,
    };

    const newImage = await createFieldImage(imageData);

    // Registro de actividad del admin dueño de la cancha
    const fieldInfo = await getFieldAdminId(parseInt(field_id));
    if (fieldInfo?.admin_id) {
      await logActivity({
        userId: fieldInfo.admin_id,
        action: 'field.image_uploaded',
        entityType: ACTIVITY_TYPES.FIELD,
        entityId: parseInt(field_id),
        description: `Imagen agregada a la cancha "${fieldInfo.name}"`,
        status: ACTIVITY_STATUS.SUCCESS,
        ipAddress: resolveIp(req),
        actorUserId: req.user?.id ?? fieldInfo.admin_id,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Imagen subida y guardada exitosamente',
      data: {
        id: newImage.id,
        field_id: newImage.field_id,
        image_url: toProxyUrl(newImage.image_url),
        category: newImage.category,
        is_primary: newImage.is_primary,
        filename: result.filename,
        size: result.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({
      success: false,
      error: 'Error al subir imagen',
      details: error.message,
    });
  }
};

module.exports = {
  getFieldImages,
  getFieldImage,
  getImagesByField,
  getPrimaryImage,
  createNewFieldImage,
  uploadFieldImage,
  updateExistingFieldImage,
  setAsPrimaryImage,
  reorderFieldImages,
  deleteFieldImageById,
  deleteAllImagesByField,
};
