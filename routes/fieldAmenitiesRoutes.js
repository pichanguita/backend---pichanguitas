const express = require('express');

const router = express.Router();
const {
  getFieldAmenities,
  getFieldAmenity,
  getAmenitiesByField,
  createNewFieldAmenity,
  createMultipleFieldAmenities,
  updateExistingFieldAmenity,
  deleteFieldAmenityById,
  deleteAllAmenitiesByField,
} = require('../controllers/fieldAmenitiesController');
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

// GET /api/field-amenities - Obtener todas las amenidades (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getFieldAmenities);

// GET /api/field-amenities/field/:field_id - Obtener amenidades de una cancha
router.get('/field/:field_id', verificarToken, verificarRolesPermitidos, getAmenitiesByField);

// GET /api/field-amenities/:id - Obtener una amenidad por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getFieldAmenity);

// POST /api/field-amenities - Crear una nueva amenidad
router.post('/', verificarToken, verificarRolesPermitidos, createNewFieldAmenity);

// POST /api/field-amenities/multiple - Crear múltiples amenidades
router.post('/multiple', verificarToken, verificarRolesPermitidos, createMultipleFieldAmenities);

// PUT /api/field-amenities/:id - Actualizar una amenidad
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingFieldAmenity);

// DELETE /api/field-amenities/:id - Eliminar una amenidad
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteFieldAmenityById);

// DELETE /api/field-amenities/field/:field_id - Eliminar todas las amenidades de una cancha
router.delete(
  '/field/:field_id',
  verificarToken,
  verificarRolesPermitidos,
  deleteAllAmenitiesByField
);

module.exports = router;
