const express = require('express');

const router = express.Router();
const {
  getBlacklistRecords,
  getBlacklistRecord,
  checkPhone,
  createBlacklistRecord,
  updateBlacklistRecord,
  unblockPhoneNumber,
  deleteBlacklistRecord,
  getStats,
  updateExpired,
} = require('../controllers/blacklistController');
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

// GET /api/blacklist - Obtener todos los registros (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getBlacklistRecords);

// GET /api/blacklist/stats - Obtener estadísticas
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/blacklist/check/:phone - Verificar si un teléfono está bloqueado
router.get('/check/:phone', verificarToken, verificarRolesPermitidos, checkPhone);

// POST /api/blacklist/update-expired - Actualizar bloqueos expirados (CRON job)
router.post('/update-expired', verificarToken, verificarRolesPermitidos, updateExpired);

// GET /api/blacklist/:id - Obtener un registro por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getBlacklistRecord);

// POST /api/blacklist - Crear un nuevo registro
router.post('/', verificarToken, verificarRolesPermitidos, createBlacklistRecord);

// PUT /api/blacklist/:id - Actualizar un registro
router.put('/:id', verificarToken, verificarRolesPermitidos, updateBlacklistRecord);

// PUT /api/blacklist/:id/unblock - Desbloquear un teléfono
router.put('/:id/unblock', verificarToken, verificarRolesPermitidos, unblockPhoneNumber);

// DELETE /api/blacklist/:id - Eliminar un registro
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteBlacklistRecord);

module.exports = router;
