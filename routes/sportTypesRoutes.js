const express = require('express');

const {
  getSportTypes,
  getSportType,
  createNewSportType,
  updateExistingSportType,
  deleteSportTypeById,
} = require('../controllers/sportTypesController');
const verificarToken = require('../middleware/authMiddleware');

const router = express.Router();

// Middleware para validar los roles permitidos
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2, 3].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// GET /api/sport-types - Obtener todos los tipos de deportes
// PÚBLICO: Permite acceso sin autenticación para mostrar tipos de deportes disponibles
router.get('/', getSportTypes);

// GET /api/sport-types/:id - Obtener un tipo de deporte por ID
// PÚBLICO: Permite acceso sin autenticación para ver detalles de un tipo de deporte
router.get('/:id', getSportType);

// POST /api/sport-types - Crear un nuevo tipo de deporte
router.post('/', verificarToken, verificarRolesPermitidos, createNewSportType);

// PUT /api/sport-types/:id - Actualizar un tipo de deporte
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingSportType);

// DELETE /api/sport-types/:id - Eliminar un tipo de deporte (soft delete)
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteSportTypeById);

module.exports = router;
