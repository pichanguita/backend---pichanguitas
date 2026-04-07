const express = require('express');

const router = express.Router();
const {
  getFieldRules,
  getFieldRule,
  getRulesByField,
  createNewFieldRule,
  createMultipleFieldRules,
  updateExistingFieldRule,
  deleteFieldRuleById,
  deleteAllRulesByField,
} = require('../controllers/fieldRulesController');
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

// GET /api/field-rules - Obtener todas las reglas (con filtros)
router.get('/', verificarToken, verificarRolesPermitidos, getFieldRules);

// GET /api/field-rules/field/:field_id - Obtener reglas de una cancha
router.get('/field/:field_id', verificarToken, verificarRolesPermitidos, getRulesByField);

// GET /api/field-rules/:id - Obtener una regla por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getFieldRule);

// POST /api/field-rules - Crear una nueva regla
router.post('/', verificarToken, verificarRolesPermitidos, createNewFieldRule);

// POST /api/field-rules/multiple - Crear múltiples reglas
router.post('/multiple', verificarToken, verificarRolesPermitidos, createMultipleFieldRules);

// PUT /api/field-rules/:id - Actualizar una regla
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingFieldRule);

// DELETE /api/field-rules/:id - Eliminar una regla
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteFieldRuleById);

// DELETE /api/field-rules/field/:field_id - Eliminar todas las reglas de una cancha
router.delete('/field/:field_id', verificarToken, verificarRolesPermitidos, deleteAllRulesByField);

module.exports = router;
