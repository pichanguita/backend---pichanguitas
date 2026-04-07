const express = require('express');

const {
  getFields,
  getField,
  createNewField,
  updateExistingField,
  approveFieldById,
  rejectFieldById,
  deleteFieldById,
  getFieldConfiguration,
  updateFieldConfiguration,
} = require('../controllers/fieldsController');
const verificarToken = require('../middleware/authMiddleware');

// Middleware para validar los roles permitidos
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2, 3].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

const router = express.Router();

// ==================== RUTAS PÚBLICAS (Sin autenticación) ====================

// GET /api/fields - Obtener todas las canchas (con filtros opcionales)
// PÚBLICO: Permite acceso sin autenticación para que usuarios vean canchas disponibles
router.get('/', getFields);

// GET /api/fields/:id/config - Obtener configuración completa de una cancha
// PÚBLICO: Permite acceso sin autenticación para ver configuración de horarios
// IMPORTANTE: Esta ruta debe ir ANTES de '/:id' para evitar conflictos
router.get('/:id/config', getFieldConfiguration);

// GET /api/fields/:id - Obtener una cancha por ID
// PÚBLICO: Permite acceso sin autenticación para ver detalles de una cancha
router.get('/:id', getField);

// ==================== RUTAS PROTEGIDAS (Requieren autenticación) ====================

// POST /api/fields - Crear una nueva cancha
router.post('/', verificarToken, verificarRolesPermitidos, createNewField);

// PUT /api/fields/:id/approve - Aprobar una cancha
// IMPORTANTE: Esta ruta debe ir ANTES de '/:id' para evitar conflictos
router.put('/:id/approve', verificarToken, verificarRolesPermitidos, approveFieldById);

// PUT /api/fields/:id/reject - Rechazar una cancha
// IMPORTANTE: Esta ruta debe ir ANTES de '/:id' para evitar conflictos
router.put('/:id/reject', verificarToken, verificarRolesPermitidos, rejectFieldById);

// PUT /api/fields/:id/config - Actualizar configuración completa de una cancha
// IMPORTANTE: Esta ruta debe ir ANTES de '/:id' para evitar conflictos
router.put('/:id/config', verificarToken, verificarRolesPermitidos, updateFieldConfiguration);

// PUT /api/fields/:id - Actualizar una cancha
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingField);

// DELETE /api/fields/:id - Eliminar una cancha (soft delete)
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteFieldById);

module.exports = router;
