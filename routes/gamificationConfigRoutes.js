const express = require('express');
const router = express.Router();
const {
  getConfig,
  getConfigValue,
  updateConfigValue,
  updateMultipleConfigValues,
} = require('../controllers/gamificationConfigController');
const verificarToken = require('../middleware/authMiddleware');

// Middleware para validar roles de administrador
const verificarRolesAdmin = (req, res, next) => {
  const rol = req.user?.id_rol;
  // Solo superadmin (1) y admin (2) pueden modificar configuración
  if (![1, 2].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Solo administradores' });
  }
  next();
};

// GET /api/gamification-config - Obtener toda la configuración
router.get('/', verificarToken, getConfig);

// GET /api/gamification-config/:key - Obtener una configuración específica
router.get('/:key', verificarToken, getConfigValue);

// PUT /api/gamification-config - Actualizar múltiples configuraciones
router.put('/', verificarToken, verificarRolesAdmin, updateMultipleConfigValues);

// PUT /api/gamification-config/:key - Actualizar una configuración específica
router.put('/:key', verificarToken, verificarRolesAdmin, updateConfigValue);

module.exports = router;
