const express = require('express');

const {
  getAllSiteConfig,
  getSiteConfigByKey,
  uploadSiteImage,
  updateSiteConfigByKey,
  deleteSiteConfigByKey,
} = require('../controllers/siteConfigController');
const verificarToken = require('../middleware/authMiddleware');
const { uploadSiteImage: multerUpload } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Middleware para validar roles permitidos (solo admins)
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  // Solo administradores (rol 1) pueden modificar configuración del sitio
  if (![1].includes(rol)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: Solo administradores pueden modificar la configuración del sitio',
    });
  }
  next();
};

// ========================================
// RUTAS PÚBLICAS (sin autenticación)
// ========================================

// GET /api/site-config - Obtener toda la configuración del sitio
router.get('/', getAllSiteConfig);

// GET /api/site-config/:key - Obtener un valor específico
router.get('/:key', getSiteConfigByKey);

// ========================================
// RUTAS PROTEGIDAS (solo admins)
// ========================================

// POST /api/site-config/upload-image - Subir imagen (Hero, Logo, etc.)
// Body: FormData con 'image', 'key', 'alt'
router.post(
  '/upload-image',
  verificarToken,
  verificarRolesPermitidos,
  multerUpload.single('image'),
  uploadSiteImage
);

// PUT /api/site-config/:key - Actualizar configuración por URL o valor
// Body: { url, alt, type } o { value: {...} }
router.put('/:key', verificarToken, verificarRolesPermitidos, updateSiteConfigByKey);

// DELETE /api/site-config/:key - Eliminar configuración
router.delete('/:key', verificarToken, verificarRolesPermitidos, deleteSiteConfigByKey);

module.exports = router;
