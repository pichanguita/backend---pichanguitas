const express = require('express');

const router = express.Router();
const {
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
} = require('../controllers/fieldImagesController');
// Importar middleware de autenticación
const verificarToken = require('../middleware/authMiddleware');
// Importar middleware de upload
const { uploadFieldPhotos } = require('../middleware/uploadMiddleware');

// Middleware para validar los roles permitidos
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2, 3].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// GET /api/field-images - Obtener todas las imágenes (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getFieldImages);

// GET /api/field-images/field/:field_id - Obtener imágenes de una cancha
router.get('/field/:field_id', verificarToken, verificarRolesPermitidos, getImagesByField);

// GET /api/field-images/field/:field_id/primary - Obtener imagen principal de una cancha
router.get('/field/:field_id/primary', verificarToken, verificarRolesPermitidos, getPrimaryImage);

// POST /api/field-images/upload - Subir archivo físico de imagen
router.post(
  '/upload',
  verificarToken,
  verificarRolesPermitidos,
  uploadFieldPhotos.single('image'),
  uploadFieldImage
);

// POST /api/field-images/reorder - Reordenar imágenes
router.post('/reorder', verificarToken, verificarRolesPermitidos, reorderFieldImages);

// GET /api/field-images/:id - Obtener una imagen por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getFieldImage);

// POST /api/field-images - Crear una nueva imagen
router.post('/', verificarToken, verificarRolesPermitidos, createNewFieldImage);

// PUT /api/field-images/:id - Actualizar una imagen
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingFieldImage);

// PUT /api/field-images/:id/set-primary - Marcar como imagen principal
router.put('/:id/set-primary', verificarToken, verificarRolesPermitidos, setAsPrimaryImage);

// DELETE /api/field-images/:id - Eliminar una imagen
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteFieldImageById);

// DELETE /api/field-images/field/:field_id - Eliminar todas las imágenes de una cancha
router.delete('/field/:field_id', verificarToken, verificarRolesPermitidos, deleteAllImagesByField);

module.exports = router;
