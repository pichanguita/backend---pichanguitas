const express = require('express');

const router = express.Router();
const {
  getFieldSpecialPricings,
  getFieldSpecialPricing,
  getSpecialPricingsByField,
  getApplicablePricing,
  createNewFieldSpecialPricing,
  updateExistingFieldSpecialPricing,
  deleteFieldSpecialPricingById,
  hardDeletePricing,
} = require('../controllers/fieldSpecialPricingController');
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

// GET /api/field-special-pricing - Obtener todos los precios especiales (con filtros)
router.get('/', verificarToken, verificarRolesPermitidos, getFieldSpecialPricings);

// GET /api/field-special-pricing/field/:field_id - Obtener precios especiales de una cancha
router.get('/field/:field_id', verificarToken, verificarRolesPermitidos, getSpecialPricingsByField);

// GET /api/field-special-pricing/field/:field_id/applicable - Obtener precios aplicables para día/hora
router.get(
  '/field/:field_id/applicable',
  verificarToken,
  verificarRolesPermitidos,
  getApplicablePricing
);

// GET /api/field-special-pricing/:id - Obtener un precio especial por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getFieldSpecialPricing);

// POST /api/field-special-pricing - Crear un nuevo precio especial
router.post('/', verificarToken, verificarRolesPermitidos, createNewFieldSpecialPricing);

// PUT /api/field-special-pricing/:id - Actualizar un precio especial
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingFieldSpecialPricing);

// DELETE /api/field-special-pricing/:id - Eliminar un precio especial (soft delete)
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteFieldSpecialPricingById);

// DELETE /api/field-special-pricing/:id/hard - Eliminar permanentemente un precio especial
router.delete('/:id/hard', verificarToken, verificarRolesPermitidos, hardDeletePricing);

module.exports = router;
