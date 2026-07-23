const express = require('express');

const router = express.Router();
const {
  getUsers,
  getUser,
  createNewUser,
  updateExistingUser,
  changePassword,
  deleteUserById,
  assignFields,
  getStats,
  updateMyProfile,
  resetPasswordTemporary,
} = require('../controllers/usersController');
// Importar middleware de autenticación
const verificarToken = require('../middleware/authMiddleware');

// Middleware para validar los roles permitidos (SuperAdmin y Admin)
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// Middleware que autoriza a los admins (rol 1 y 2) o al propio usuario dueño del recurso.
// Permite que cualquier usuario autenticado (incluidos los clientes, rol 3) opere sobre su
// propia cuenta, sin abrir el recurso a terceros. La regla de negocio adicional (exigir la
// contraseña actual a los no-admins) vive en el controlador, no aquí.
const verificarAdminOPropietario = (req, res, next) => {
  const rol = req.user?.id_rol;
  const esAdmin = [1, 2].includes(rol);
  const esPropietario = Number.parseInt(req.params.id, 10) === req.user?.id;
  if (esAdmin || esPropietario) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Acceso denegado: no autorizado' });
};

// Middleware para validar solo SuperAdmin
const verificarSuperAdmin = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (rol !== 1) {
    return res
      .status(403)
      .json({ mensaje: 'Acceso denegado: Solo SuperAdmin puede realizar esta acción' });
  }
  next();
};

// ==================== RUTAS PARA TODOS LOS USUARIOS AUTENTICADOS ====================

// PUT /api/users/my-profile - Actualizar perfil propio (cualquier usuario autenticado)
router.put('/my-profile', verificarToken, updateMyProfile);

// ==================== RUTAS PARA ADMINS (rol 1 y 2) ====================

// GET /api/users - Obtener todos los usuarios (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getUsers);

// GET /api/users/stats - Obtener estadísticas de usuarios
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/users/:id - Obtener un usuario por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getUser);

// POST /api/users - Crear un nuevo usuario
router.post('/', verificarToken, verificarRolesPermitidos, createNewUser);

// PUT /api/users/:id - Actualizar un usuario
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingUser);

// PUT /api/users/:id/password - Cambiar contraseña (admins sobre cualquier usuario; cada
// usuario sobre su propia cuenta, incluidos los clientes)
router.put('/:id/password', verificarToken, verificarAdminOPropietario, changePassword);

// POST /api/users/:id/assign-fields - Asignar canchas a un usuario
router.post('/:id/assign-fields', verificarToken, verificarRolesPermitidos, assignFields);

// DELETE /api/users/:id - Eliminar un usuario (soft delete) - SOLO SUPERADMIN
router.delete('/:id', verificarToken, verificarSuperAdmin, deleteUserById);

// POST /api/users/:id/reset-password - Resetear contraseña (genera temporal) - SOLO SUPERADMIN
router.post('/:id/reset-password', verificarToken, verificarSuperAdmin, resetPasswordTemporary);

module.exports = router;
