const crypto = require('crypto');
const bcrypt = require('bcrypt');

const pool = require('../config/db');
const { sendEmail } = require('../config/mailer');
const { resetPasswordTemplate } = require('../templates/resetEmail');
const {
  createResetToken,
  findValidToken,
  markTokenAsUsed,
  countRecentRequests,
} = require('../models/passwordResetModel');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3009';

/**
 * POST /api/auth/forgot-password
 * Solicitar recuperacion de contrasena
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El correo electronico es requerido',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Respuesta generica para no revelar si el email existe
    const genericResponse = {
      success: true,
      message: 'Si el correo esta registrado, recibiras un enlace para restablecer tu contrasena.',
    };

    // Buscar usuario por email
    const userResult = await pool.query(
      'SELECT id, name, email FROM users WHERE LOWER(email) = $1 AND is_active = true',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      // No revelar que el email no existe
      return res.json(genericResponse);
    }

    const user = userResult.rows[0];

    // No enviar recovery a emails temporales
    if (user.email.endsWith('@pichanguitas.temp')) {
      return res.json(genericResponse);
    }

    // Rate limiting: maximo 3 solicitudes cada 15 minutos
    const recentCount = await countRecentRequests(user.id, 15);
    if (recentCount >= 3) {
      return res.status(429).json({
        success: false,
        error: 'Demasiadas solicitudes. Intenta nuevamente en 15 minutos.',
      });
    }

    // Generar token aleatorio
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Guardar hash del token en BD (nunca el token en texto plano)
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Expiracion: 1 hora
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await createResetToken(user.id, tokenHash, expiresAt);

    // Construir URL de reset
    const resetUrl = `${FRONTEND_URL}/reset-password/${rawToken}`;

    // Enviar email
    await sendEmail({
      to: user.email,
      subject: 'Recupera tu contrasena - Pichanguitas',
      html: resetPasswordTemplate(user.name, resetUrl),
    });

    return res.json(genericResponse);
  } catch (error) {
    console.error('Error en forgot-password:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al procesar la solicitud. Intenta nuevamente.',
    });
  }
};

/**
 * GET /api/auth/verify-reset-token/:token
 * Verificar si un token de reset es valido
 */
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token requerido' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenRecord = await findValidToken(tokenHash);

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        error: 'El enlace es invalido o ha expirado. Solicita uno nuevo.',
      });
    }

    return res.json({
      success: true,
      message: 'Token valido',
      data: { name: tokenRecord.name, email: tokenRecord.email },
    });
  } catch (error) {
    console.error('Error en verify-reset-token:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al verificar el token.',
    });
  }
};

/**
 * POST /api/auth/reset-password
 * Restablecer contrasena con token
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token requerido' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La contrasena debe tener al menos 6 caracteres',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenRecord = await findValidToken(tokenHash);

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        error: 'El enlace es invalido o ha expirado. Solicita uno nuevo.',
      });
    }

    // Hashear nueva contrasena
    const passwordHash = await bcrypt.hash(password, 10);

    // Actualizar contrasena del usuario
    await pool.query(
      `UPDATE users SET password_hash = $1, date_time_modification = NOW() WHERE id = $2`,
      [passwordHash, tokenRecord.user_id]
    );

    // Marcar token como usado
    await markTokenAsUsed(tokenRecord.id);

    // Resetear intentos de login y desbloquear si estaba bloqueado
    await pool.query(
      `UPDATE users SET login_attempts = 0, is_blocked = false, block_until = NULL WHERE id = $1`,
      [tokenRecord.user_id]
    );

    return res.json({
      success: true,
      message: 'Contrasena restablecida exitosamente. Ya puedes iniciar sesion.',
    });
  } catch (error) {
    console.error('Error en reset-password:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al restablecer la contrasena.',
    });
  }
};

module.exports = { forgotPassword, verifyResetToken, resetPassword };
