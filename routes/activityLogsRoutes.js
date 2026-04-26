const express = require('express');

const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const { getUserActivity } = require('../controllers/activityLogsController');

// Roles permitidos: SA (1) y admin (2) para ver su propia actividad.
// El SA puede consultar cualquier userId; los admins solo la suya.
const restrictToSelfUnlessSA = (req, res, next) => {
  const rol = req.user?.id_rol;
  const requestedId = parseInt(req.params.userId, 10);
  if (rol === 1) return next(); // SA pasa
  if (rol === 2 && req.user?.id === requestedId) return next();
  return res
    .status(403)
    .json({ success: false, error: 'No tienes permisos para ver esta actividad' });
};

router.get(
  '/user/:userId',
  verificarToken,
  restrictToSelfUnlessSA,
  getUserActivity
);

module.exports = router;
