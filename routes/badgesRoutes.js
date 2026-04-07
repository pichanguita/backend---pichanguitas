const express = require('express');

const router = express.Router();
const {
  getBadges,
  getBadge,
  createNewBadge,
  updateExistingBadge,
  deleteBadgeById,
  getCustomerBadgesById,
  getMyBadges,
  assignBadge,
  removeCustomerBadgeById,
  getStats,
  getCustomerBadgeProgress,
  checkAndAssignBadgesManually,
  getLeaderboardData,
} = require('../controllers/badgesController');
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

// GET /api/badges - Obtener todas las insignias (con filtros)
router.get('/', verificarToken, verificarRolesPermitidos, getBadges);

// GET /api/badges/stats - Obtener estadísticas
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/badges/leaderboard - Obtener top clientes con más insignias
router.get('/leaderboard', verificarToken, verificarRolesPermitidos, getLeaderboardData);

// GET /api/badges/my-badges - Obtener mis insignias (cliente autenticado)
router.get('/my-badges', verificarToken, verificarRolesPermitidos, getMyBadges);

// GET /api/badges/customer/:customer_id - Obtener insignias de un cliente
router.get(
  '/customer/:customer_id',
  verificarToken,
  verificarRolesPermitidos,
  getCustomerBadgesById
);

// GET /api/badges/customer/:customer_id/progress - Obtener progreso de insignias
router.get(
  '/customer/:customer_id/progress',
  verificarToken,
  verificarRolesPermitidos,
  getCustomerBadgeProgress
);

// POST /api/badges/customer/:customer_id/check - Verificar y asignar insignias manualmente
router.post(
  '/customer/:customer_id/check',
  verificarToken,
  verificarRolesPermitidos,
  checkAndAssignBadgesManually
);

// GET /api/badges/:id - Obtener una insignia por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getBadge);

// POST /api/badges - Crear una nueva insignia
router.post('/', verificarToken, verificarRolesPermitidos, createNewBadge);

// POST /api/badges/assign - Asignar insignia a un cliente
router.post('/assign', verificarToken, verificarRolesPermitidos, assignBadge);

// PUT /api/badges/:id - Actualizar una insignia
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingBadge);

// DELETE /api/badges/:id - Eliminar una insignia (soft delete)
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteBadgeById);

// DELETE /api/badges/customer-badge/:id - Eliminar insignia de un cliente
router.delete(
  '/customer-badge/:id',
  verificarToken,
  verificarRolesPermitidos,
  removeCustomerBadgeById
);

module.exports = router;
