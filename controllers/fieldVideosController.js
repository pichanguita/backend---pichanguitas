const {
  getAllFieldVideos,
  getFieldVideoById,
  getVideosByFieldId,
  createFieldVideo,
  updateFieldVideo,
  deleteFieldVideo,
  deleteAllVideosByFieldId,
} = require('../models/fieldVideosModel');

const getFieldVideos = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      search: req.query.search,
    };
    const videos = await getAllFieldVideos(filters);
    res.json({ success: true, data: videos, count: videos.length });
  } catch (error) {
    console.error('Error al obtener videos:', error);
    res.status(500).json({ success: false, error: 'Error al obtener videos' });
  }
};

const getFieldVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await getFieldVideoById(id);
    if (!video) return res.status(404).json({ success: false, error: 'Video no encontrado' });
    res.json({ success: true, data: video });
  } catch (error) {
    console.error('Error al obtener video:', error);
    res.status(500).json({ success: false, error: 'Error al obtener video' });
  }
};

const getVideosByField = async (req, res) => {
  try {
    const { field_id } = req.params;
    const videos = await getVideosByFieldId(field_id);
    res.json({ success: true, data: videos, count: videos.length });
  } catch (error) {
    console.error('Error al obtener videos de la cancha:', error);
    res.status(500).json({ success: false, error: 'Error al obtener videos de la cancha' });
  }
};

const createNewFieldVideo = async (req, res) => {
  try {
    const { field_id, video_url, title, description } = req.body;
    if (!field_id)
      return res.status(400).json({ success: false, error: 'El ID de la cancha es requerido' });
    if (!video_url || !video_url.trim())
      return res.status(400).json({ success: false, error: 'La URL del video es requerida' });

    const videoData = {
      field_id,
      video_url: video_url.trim(),
      title: title?.trim(),
      description: description?.trim(),
      user_id_registration: req.user?.id || 1,
    };
    const newVideo = await createFieldVideo(videoData);
    res.status(201).json({ success: true, message: 'Video creado exitosamente', data: newVideo });
  } catch (error) {
    console.error('Error al crear video:', error);
    res.status(500).json({ success: false, error: 'Error al crear video' });
  }
};

const updateExistingFieldVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { video_url, title, description } = req.body;
    const existingVideo = await getFieldVideoById(id);
    if (!existingVideo)
      return res.status(404).json({ success: false, error: 'Video no encontrado' });

    const videoData = {
      video_url: video_url?.trim(),
      title: title?.trim(),
      description: description?.trim(),
      user_id_modification: req.user?.id || 1,
    };
    const updatedVideo = await updateFieldVideo(id, videoData);
    res.json({ success: true, message: 'Video actualizado exitosamente', data: updatedVideo });
  } catch (error) {
    console.error('Error al actualizar video:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar video' });
  }
};

const deleteFieldVideoById = async (req, res) => {
  try {
    const { id } = req.params;
    const existingVideo = await getFieldVideoById(id);
    if (!existingVideo)
      return res.status(404).json({ success: false, error: 'Video no encontrado' });

    const deleted = await deleteFieldVideo(id);
    if (deleted) {
      res.json({ success: true, message: 'Video eliminado exitosamente' });
    } else {
      res.status(500).json({ success: false, error: 'No se pudo eliminar el video' });
    }
  } catch (error) {
    console.error('Error al eliminar video:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar video' });
  }
};

const deleteAllVideosByField = async (req, res) => {
  try {
    const { field_id } = req.params;
    const deletedCount = await deleteAllVideosByFieldId(field_id);
    res.json({
      success: true,
      message: `Se eliminaron ${deletedCount} videos`,
      count: deletedCount,
    });
  } catch (error) {
    console.error('Error al eliminar videos:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar videos' });
  }
};

module.exports = {
  getFieldVideos,
  getFieldVideo,
  getVideosByField,
  createNewFieldVideo,
  updateExistingFieldVideo,
  deleteFieldVideoById,
  deleteAllVideosByField,
};
