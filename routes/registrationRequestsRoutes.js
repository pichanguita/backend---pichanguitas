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
  downloadRequestFile,
  getStats,
} = require('../controllers/registrationRequestsController');
const verificarToken = require('../middleware/authMiddleware');
const { uploadRegistrationFiles } = require('../middleware/uploadMiddleware');

// Roles permitidos para gestionar solicitudes (SA / admin / staff autorizado)
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2, 3].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// GET /api/registration-requests - Listado con filtros
router.get('/', verificarToken, verificarRolesPermitidos, getRegistrationRequests);

// GET /api/registration-requests/stats - Estadísticas
router.get('/stats', verificarToken, verificarRolesPermitidos, getStats);

// GET /api/registration-requests/:id - Detalle por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getRegistrationRequest);

// GET /api/registration-requests/:id/files/:fileId/download - Descarga/preview autenticada
router.get(
  '/:id/files/:fileId/download',
  verificarToken,
  verificarRolesPermitidos,
  downloadRequestFile
);

// POST /api/registration-requests/with-files - Crear con archivos (público)
router.post('/with-files', uploadRegistrationFiles.any(), createNewRegistrationRequestWithFiles);

// POST /api/registration-requests - Crear sin archivos (público)
router.post('/', createNewRegistrationRequest);

// PUT /api/registration-requests/:id - Actualizar
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingRegistrationRequest);

// PUT /api/registration-requests/:id/approve - Aprobar
router.put('/:id/approve', verificarToken, verificarRolesPermitidos, approveRequest);

// PUT /api/registration-requests/:id/reject - Rechazar
router.put('/:id/reject', verificarToken, verificarRolesPermitidos, rejectRequest);

// DELETE /api/registration-requests/:id - Eliminar (borra archivos en Wasabi)
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteRegistrationRequestById);

module.exports = router;
