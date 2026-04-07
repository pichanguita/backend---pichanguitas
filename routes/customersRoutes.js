const express = require('express');

const router = express.Router();
const {
  getCustomers,
  getCustomer,
  getCustomerByPhoneNumber,
  createNewCustomer,
  updateExistingCustomer,
  updateStats,
  deleteCustomerById,
  getPromotionHistory,
  getMyClients,
  getMyFreeHours,
} = require('../controllers/customersController');
// Importar middleware de autenticación
const verificarToken = require('../middleware/authMiddleware');
const { verificarTokenOpcional } = require('../middleware/authMiddleware');

// Middleware para validar los roles permitidos
const verificarRolesPermitidos = (req, res, next) => {
  const rol = req.user?.id_rol;
  if (![1, 2, 3].includes(rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: Rol no autorizado' });
  }
  next();
};

// ==================== RUTAS PÚBLICAS (Sin autenticación) ====================

// GET /api/customers/phone/:phone - Obtener un cliente por número de teléfono
// PÚBLICO: Permite verificar si un cliente existe por teléfono
// IMPORTANTE: Esta ruta debe ir ANTES de '/:id' para evitar conflictos
router.get('/phone/:phone', getCustomerByPhoneNumber);

// POST /api/customers - Crear un nuevo cliente
// SEMI-PÚBLICO: Permite crear clientes durante el proceso de reserva
// Usa verificarTokenOpcional para obtener el ID del admin si está autenticado
router.post('/', verificarTokenOpcional, createNewCustomer);

// ==================== RUTAS PROTEGIDAS (Requieren autenticación) ====================

// GET /api/customers/my-free-hours - Obtener horas gratis disponibles del cliente autenticado
router.get('/my-free-hours', verificarToken, verificarRolesPermitidos, getMyFreeHours);

// GET /api/customers/my-clients - Obtener clientes que han reservado en las canchas del admin
// IMPORTANTE: Esta ruta debe ir ANTES de '/:id' para evitar conflictos
router.get('/my-clients', verificarToken, verificarRolesPermitidos, getMyClients);

// GET /api/customers/by-admin/:adminId - Obtener clientes de un admin específico (solo super_admin)
router.get('/by-admin/:adminId', verificarToken, verificarRolesPermitidos, getMyClients);

// GET /api/customers - Obtener todos los clientes (con filtros opcionales)
router.get('/', verificarToken, verificarRolesPermitidos, getCustomers);

// GET /api/customers/:id/promotions - Obtener historial de promociones de un cliente
// IMPORTANTE: Esta ruta debe ir ANTES de '/:id' para evitar conflictos
router.get('/:id/promotions', verificarToken, verificarRolesPermitidos, getPromotionHistory);

// GET /api/customers/:id - Obtener un cliente por ID
router.get('/:id', verificarToken, verificarRolesPermitidos, getCustomer);

// PUT /api/customers/:id - Actualizar un cliente
router.put('/:id', verificarToken, verificarRolesPermitidos, updateExistingCustomer);

// PUT /api/customers/:id/stats - Actualizar estadísticas de un cliente
router.put('/:id/stats', verificarToken, verificarRolesPermitidos, updateStats);

// DELETE /api/customers/:id - Eliminar un cliente (soft delete)
router.delete('/:id', verificarToken, verificarRolesPermitidos, deleteCustomerById);

module.exports = router;
