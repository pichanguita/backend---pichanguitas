const {
  getAllVideoTutorials,
  getVideoTutorialBySlug,
  updateVideoTutorialBySlug,
} = require('../models/videoTutorialsModel');

/**
 * GET /api/video-tutorials
 * Público. Lista los tutoriales activos para que la landing los renderice.
 */
const listVideoTutorials = async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const data = await getAllVideoTutorials(!includeInactive);
    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('Error al listar video tutoriales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tutoriales',
      error: error.message,
    });
  }
};

/**
 * PUT /api/video-tutorials/:slug
 * Protegido. Actualiza title/description/video_url del tutorial.
 */
const updateVideoTutorial = async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, description, video_url } = req.body;

    if (title === undefined && description === undefined && video_url === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Debe enviar al menos uno de: title, description, video_url',
      });
    }

    const existing = await getVideoTutorialBySlug(slug);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Tutorial '${slug}' no encontrado`,
      });
    }

    const updated = await updateVideoTutorialBySlug(slug, {
      title,
      description,
      video_url,
      user_id: req.user?.id_usuario || req.user?.id || null,
    });

    res.json({
      success: true,
      message: 'Tutorial actualizado correctamente',
      data: updated,
    });
  } catch (error) {
    console.error('Error al actualizar video tutorial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar tutorial',
      error: error.message,
    });
  }
};

module.exports = { listVideoTutorials, updateVideoTutorial };
