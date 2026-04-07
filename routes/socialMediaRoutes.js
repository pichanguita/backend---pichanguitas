const express = require('express');

const {
  getAllSocialMedia,
  getEnabledSocialMedia,
  getSocialMediaById,
  createSocialMedia,
  updateSocialMedia,
  toggleSocialMedia,
  deleteSocialMedia,
  bulkUpdateSocialMedia,
} = require('../controllers/socialMediaController');
const verificarToken = require('../middleware/authMiddleware');

const router = express.Router();

// Middleware para validar roles permitidos (solo superadmin - rol 1)
const verificarSuperAdmin = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1].includes(rol)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: Solo el superadministrador puede modificar redes sociales',
    });
  }
  next();
};

// ========================================
// RUTAS PÚBLICAS (sin autenticación)
// ========================================

// GET /api/social-media - Obtener todas las redes sociales activas
router.get('/', getAllSocialMedia);

// GET /api/social-media/enabled - Obtener solo las habilitadas (para footer)
router.get('/enabled', getEnabledSocialMedia);

// GET /api/social-media/:id - Obtener una red social por ID
router.get('/:id', getSocialMediaById);

// ========================================
// RUTAS PROTEGIDAS (solo superadmin)
// ========================================

// POST /api/social-media - Crear una nueva red social
router.post('/', verificarToken, verificarSuperAdmin, createSocialMedia);

// PUT /api/social-media/bulk - Sincronización masiva
router.put('/bulk', verificarToken, verificarSuperAdmin, bulkUpdateSocialMedia);

// PUT /api/social-media/:id - Actualizar una red social
router.put('/:id', verificarToken, verificarSuperAdmin, updateSocialMedia);

// PATCH /api/social-media/:id/toggle - Activar/desactivar
router.patch('/:id/toggle', verificarToken, verificarSuperAdmin, toggleSocialMedia);

// DELETE /api/social-media/:id - Eliminar una red social
router.delete('/:id', verificarToken, verificarSuperAdmin, deleteSocialMedia);

module.exports = router;
