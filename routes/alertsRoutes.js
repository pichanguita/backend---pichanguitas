const express = require('express');

const router = express.Router();
const {
  getAlerts,
  getAlert,
  createNewAlert,
  markAlertAsRead,
  markMultipleAlertsAsRead,
  markAllAlertsAsRead,
  deleteAlertById,
  deleteMultipleAlertsById,
  getUnreadAlertCount,
  getStats,
} = require('../controllers/alertsController');
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

// GET /api/alerts - Obtener todas las alertas (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getAlerts);

// GET /api/alerts/unread-count/:admin_id - Obtener conteo de alertas no leídas
router.get(
  '/unread-count/:admin_id',
  verificarToken,
  verificarRolesPermitidos,
  getUnreadAlertCount
);

// GET /api/alerts/stats/:admin_id - Obtener estadísticas de alertas
router.get('/stats/:admin_id', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/alerts/:id - Obtener una alerta por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getAlert);

// POST /api/alerts - Crear una nueva alerta
router.post('/', verificarToken, verificarRolesPermitidos, createNewAlert);

// PUT /api/alerts/read-all - Marcar TODAS las alertas como leídas
router.put('/read-all', verificarToken, verificarRolesPermitidos, markAllAlertsAsRead);

// PUT /api/alerts/:id/mark-read - Marcar una alerta como leída
router.put('/:id/mark-read', verificarToken, verificarRolesPermitidos, markAlertAsRead);

// PUT /api/alerts/mark-read-multiple - Marcar múltiples alertas como leídas
router.put(
  '/mark-read-multiple',
  verificarToken,
  verificarRolesPermitidos,
  markMultipleAlertsAsRead
);

// DELETE /api/alerts/:id - Eliminar una alerta
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteAlertById);

// DELETE /api/alerts/delete-multiple - Eliminar múltiples alertas
router.delete(
  '/delete-multiple',
  verificarToken,
  verificarRolesPermitidos,
  deleteMultipleAlertsById
);

module.exports = router;
