const express = require('express');

const router = express.Router();
const {
  getFieldSchedules,
  getFieldSchedule,
  getSchedulesByField,
  createNewFieldSchedule,
  createWeekSchedule,
  updateExistingFieldSchedule,
  deleteFieldScheduleById,
} = require('../controllers/fieldSchedulesController');
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

// GET /api/field-schedules - Obtener todos los horarios (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getFieldSchedules);

// GET /api/field-schedules/field/:field_id - Obtener horarios de una cancha
router.get('/field/:field_id', verificarToken, verificarRolesPermitidos, getSchedulesByField);

// GET /api/field-schedules/:id - Obtener un horario por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getFieldSchedule);

// POST /api/field-schedules - Crear un nuevo horario
router.post('/', verificarToken, verificarRolesPermitidos, createNewFieldSchedule);

// POST /api/field-schedules/week - Crear horarios para toda la semana
router.post('/week', verificarToken, verificarRolesPermitidos, createWeekSchedule);

// PUT /api/field-schedules/:id - Actualizar un horario
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingFieldSchedule);

// DELETE /api/field-schedules/:id - Eliminar un horario
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteFieldScheduleById);

module.exports = router;
