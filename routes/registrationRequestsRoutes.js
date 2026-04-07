const express = require('express');

const router = express.Router();
const {
  getRegistrationRequests,
  getRegistrationRequest,
  createNewRegistrationRequest,
  createNewRegistrationRequestWithFiles,
  updateExistingRegistrationRequest,
  approveRequest,
  rejectRequest,
  deleteRegistrationRequestById,
  getStats,
} = require('../controllers/registrationRequestsController');
// Importar middleware de autenticación
const verificarToken = require('../middleware/authMiddleware');
// Importar middleware de upload
const { uploadRegistrationFiles } = require('../middleware/uploadMiddleware');

// Middleware para validar los roles permitidos
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2, 3].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// GET /api/registration-requests - Obtener todas las solicitudes (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getRegistrationRequests);

// GET /api/registration-requests/stats - Obtener estadísticas de solicitudes
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/registration-requests/:id - Obtener una solicitud por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getRegistrationRequest);

// POST /api/registration-requests/with-files - Crear solicitud CON archivos (multipart/form-data)
router.post('/with-files', uploadRegistrationFiles.any(), createNewRegistrationRequestWithFiles);

// POST /api/registration-requests - Crear una nueva solicitud SIN archivos (JSON puro)
router.post('/', createNewRegistrationRequest);

// PUT /api/registration-requests/:id - Actualizar una solicitud
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingRegistrationRequest);

// PUT /api/registration-requests/:id/approve - Aprobar una solicitud
router.put('/:id/approve', verificarToken, verificarRolesPermitidos, approveRequest);

// PUT /api/registration-requests/:id/reject - Rechazar una solicitud
router.put('/:id/reject', verificarToken, verificarRolesPermitidos, rejectRequest);

// DELETE /api/registration-requests/:id - Eliminar una solicitud
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteRegistrationRequestById);

module.exports = router;
