const express = require('express');

const router = express.Router();
const {
  getFieldMaintenanceSchedules,
  getFieldMaintenanceSchedule,
  getMaintenanceSchedulesByField,
  checkMaintenanceForDate,
  createNewFieldMaintenanceSchedule,
  updateExistingFieldMaintenanceSchedule,
  deleteFieldMaintenanceScheduleById,
  getStats,
} = require('../controllers/fieldMaintenanceSchedulesController');
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

// GET /api/field-maintenance-schedules - Obtener todos los programas (con filtros)
router.get('/', verificarToken, verificarRolesPermitidos, getFieldMaintenanceSchedules);

// GET /api/field-maintenance-schedules/stats - Obtener estadísticas
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/field-maintenance-schedules/field/:field_id - Obtener programas de una cancha
router.get(
  '/field/:field_id',
  verificarToken,
  verificarRolesPermitidos,
  getMaintenanceSchedulesByField
);

// GET /api/field-maintenance-schedules/field/:field_id/check-date - Verificar mantenimiento en fecha
router.get(
  '/field/:field_id/check-date',
  verificarToken,
  verificarRolesPermitidos,
  checkMaintenanceForDate
);

// GET /api/field-maintenance-schedules/:id - Obtener un programa por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getFieldMaintenanceSchedule);

// POST /api/field-maintenance-schedules - Crear un nuevo programa
router.post('/', verificarToken, verificarRolesPermitidos, createNewFieldMaintenanceSchedule);

// PUT /api/field-maintenance-schedules/:id - Actualizar un programa
router.put(
  '/:id',
  verificarToken,
  verificarRolesPermitidos,
  updateExistingFieldMaintenanceSchedule
);

// DELETE /api/field-maintenance-schedules/:id - Eliminar un programa
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteFieldMaintenanceScheduleById);

module.exports = router;
