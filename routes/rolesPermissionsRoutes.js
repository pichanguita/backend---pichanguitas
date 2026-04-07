const express = require('express');

const router = express.Router();
const {
  getRoles,
  getRole,
  assignPermissions,
  getPermissions,
  getPermission,
  createNewPermission,
  updateExistingPermission,
  deletePermissionById,
} = require('../controllers/rolesPermissionsController');
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

// ============= ROLES =============
// GET /api/roles-permissions/roles - Obtener todos los roles
router.get('/roles', verificarToken, verificarRolesPermitidos, getRoles);

// GET /api/roles-permissions/roles/:id - Obtener un rol por ID
router.get('/roles/:id', verificarToken, verificarRolesPermitidos, getRole);

// POST /api/roles-permissions/roles/:id/permissions - Asignar permisos a un rol
router.post('/roles/:id/permissions', verificarToken, verificarRolesPermitidos, assignPermissions);

// ============= PERMISSIONS =============
// GET /api/roles-permissions/permissions - Obtener todos los permisos
router.get('/permissions', verificarToken, verificarRolesPermitidos, getPermissions);

// GET /api/roles-permissions/permissions/:id - Obtener un permiso por ID
router.get('/permissions/:id', verificarToken, verificarRolesPermitidos, getPermission);

// POST /api/roles-permissions/permissions - Crear un nuevo permiso
router.post('/permissions', verificarToken, verificarRolesPermitidos, createNewPermission);

// PUT /api/roles-permissions/permissions/:id - Actualizar un permiso
router.put('/permissions/:id', verificarToken, verificarRolesPermitidos, updateExistingPermission);

// DELETE /api/roles-permissions/permissions/:id - Eliminar un permiso (soft delete)
router.delete('/permissions/:id', verificarToken, verificarRolesPermitidos, deletePermissionById);

module.exports = router;
