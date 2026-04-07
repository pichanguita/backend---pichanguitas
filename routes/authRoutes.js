const express = require('express');

const router = express.Router();
const { login } = require('../controllers/authController');
const { registerCustomer } = require('../controllers/authPublicController');

// POST /api/auth/login - Iniciar sesión
router.post('/login', login);

// POST /api/auth/register - Registro público de clientes (sin autenticación)
router.post('/register', registerCustomer);

module.exports = router;
