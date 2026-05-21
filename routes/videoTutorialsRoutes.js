const express = require('express');

const {
  listVideoTutorials,
  updateVideoTutorial,
} = require('../controllers/videoTutorialsController');
const verificarToken = require('../middleware/authMiddleware');

const router = express.Router();

// Solo administradores (rol 1) pueden modificar tutoriales.
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1].includes(rol)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: Solo administradores pueden modificar tutoriales',
    });
  }
  next();
};

// PÚBLICO: la landing lo consume sin autenticación.
router.get('/', listVideoTutorials);

// PROTEGIDO: solo admins editan.
router.put('/:slug', verificarToken, verificarRolesPermitidos, updateVideoTutorial);

module.exports = router;
