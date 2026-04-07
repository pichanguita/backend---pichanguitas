const express = require('express');
const router = express.Router();

const {
  forgotPassword,
  verifyResetToken,
  resetPassword,
} = require('../controllers/passwordResetController');

// POST /api/auth/forgot-password - Solicitar recuperacion
router.post('/forgot-password', forgotPassword);

// GET /api/auth/verify-reset-token/:token - Verificar token
router.get('/verify-reset-token/:token', verifyResetToken);

// POST /api/auth/reset-password - Restablecer contrasena
router.post('/reset-password', resetPassword);

module.exports = router;
