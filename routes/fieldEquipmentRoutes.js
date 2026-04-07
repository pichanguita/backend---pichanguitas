const express = require('express');

const router = express.Router();
const {
  getFieldEquipments,
  getFieldEquipment,
  getEquipmentByField,
  createNewFieldEquipment,
  updateExistingFieldEquipment,
  deleteFieldEquipmentById,
  deleteEquipmentByField,
} = require('../controllers/fieldEquipmentController');
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

// GET /api/field-equipment - Obtener todos los equipamientos (con filtros)
router.get('/', verificarToken, verificarRolesPermitidos, getFieldEquipments);

// GET /api/field-equipment/field/:field_id - Obtener equipamiento de una cancha
router.get('/field/:field_id', verificarToken, verificarRolesPermitidos, getEquipmentByField);

// GET /api/field-equipment/:id - Obtener un equipamiento por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getFieldEquipment);

// POST /api/field-equipment - Crear un nuevo equipamiento
router.post('/', verificarToken, verificarRolesPermitidos, createNewFieldEquipment);

// PUT /api/field-equipment/:id - Actualizar un equipamiento
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingFieldEquipment);

// DELETE /api/field-equipment/:id - Eliminar un equipamiento
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteFieldEquipmentById);

// DELETE /api/field-equipment/field/:field_id - Eliminar equipamiento por field_id
router.delete('/field/:field_id', verificarToken, verificarRolesPermitidos, deleteEquipmentByField);

module.exports = router;
