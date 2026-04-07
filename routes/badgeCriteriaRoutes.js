const express = require('express');

const router = express.Router();
const {
  getCriteria,
  getCriteriaByIdController,
  calculateCustomerCriteria,
} = require('../controllers/badgeCriteriaController');
const verificarToken = require('../middleware/authMiddleware');

// Obtener todos los criterios disponibles (para el select del admin)
router.get('/', verificarToken, getCriteria);

// Obtener un criterio específico
router.get('/:id', verificarToken, getCriteriaByIdController);

// Calcular valores de criterios para un cliente
router.get('/customer/:customer_id/calculate', verificarToken, calculateCustomerCriteria);

module.exports = router;
