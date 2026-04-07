const express = require('express');

const router = express.Router();
const {
  getFieldVideos,
  getFieldVideo,
  getVideosByField,
  createNewFieldVideo,
  updateExistingFieldVideo,
  deleteFieldVideoById,
  deleteAllVideosByField,
} = require('../controllers/fieldVideosController');
// Importar middleware de autenticación
const verificarToken = require('../middleware/authMiddleware');

// Middleware para validar los roles permitidos
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2, 3].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// GET /api/field-videos - Obtener todos los videos (con filtros)
router.get('/', verificarToken, verificarRolesPermitidos, getFieldVideos);

// GET /api/field-videos/field/:field_id - Obtener videos de una cancha
router.get('/field/:field_id', verificarToken, verificarRolesPermitidos, getVideosByField);

// GET /api/field-videos/:id - Obtener un video por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getFieldVideo);

// POST /api/field-videos - Crear un nuevo video
router.post('/', verificarToken, verificarRolesPermitidos, createNewFieldVideo);

// PUT /api/field-videos/:id - Actualizar un video
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingFieldVideo);

// DELETE /api/field-videos/:id - Eliminar un video
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteFieldVideoById);

// DELETE /api/field-videos/field/:field_id - Eliminar todos los videos de una cancha
router.delete('/field/:field_id', verificarToken, verificarRolesPermitidos, deleteAllVideosByField);

module.exports = router;
