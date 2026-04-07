const express = require('express');

const router = express.Router();
const {
  getPromotionRules,
  getPromotionRule,
  getActiveRules,
  getApplicableRule,
  createNewPromotionRule,
  updateExistingPromotionRule,
  deletePromotionRuleById,
  getStats,
  getMyPromotions,
  redeemPromotionController,
  getMyHistory,
  getFieldsWithActiveRulesController,
} = require('../controllers/promotionRulesController');
// Importar middleware de autenticación
const verificarToken = require('../middleware/authMiddleware');

// Middleware para validar los roles permitidos (admin)
const verificarRolesAdmin = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// Middleware para validar todos los roles autenticados (incluyendo clientes)
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2, 3].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// GET /api/promotion-rules/my-promotions - Obtener promociones del cliente autenticado
router.get('/my-promotions', verificarToken, verificarRolesPermitidos, getMyPromotions);

// GET /api/promotion-rules/my-history - Obtener historial de promociones canjeadas
router.get('/my-history', verificarToken, verificarRolesPermitidos, getMyHistory);

// POST /api/promotion-rules/redeem - Canjear una promoción
router.post('/redeem', verificarToken, verificarRolesPermitidos, redeemPromotionController);

// GET /api/promotion-rules - Obtener todas las reglas (con filtros)
router.get('/', verificarToken, verificarRolesAdmin, getPromotionRules);

// GET /api/promotion-rules/active - Obtener reglas activas
router.get('/active', verificarToken, verificarRolesPermitidos, getActiveRules);

// GET /api/promotion-rules/applicable - Obtener regla aplicable para horas específicas
router.get('/applicable', verificarToken, verificarRolesPermitidos, getApplicableRule);

// GET /api/promotion-rules/stats - Obtener estadísticas
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/promotion-rules/fields-with-rules - Obtener canchas que ya tienen reglas activas
router.get('/fields-with-rules', verificarToken, verificarRolesAdmin, getFieldsWithActiveRulesController);

// GET /api/promotion-rules/:id - Obtener una regla por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getPromotionRule);

// POST /api/promotion-rules - Crear una nueva regla
router.post('/', verificarToken, verificarRolesAdmin, createNewPromotionRule);

// PUT /api/promotion-rules/:id - Actualizar una regla
router.put('/:id', verificarToken, verificarRolesAdmin, updateExistingPromotionRule);

// DELETE /api/promotion-rules/:id - Eliminar una regla (soft delete)
router.delete('/:id', verificarToken, verificarRolesAdmin, deletePromotionRuleById);

module.exports = router;
