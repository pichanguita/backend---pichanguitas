const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { findUserByIdentifier, resetLoginAttempts } = require('../models/authModel');

const login = async (req, res) => {
  const { identifier, password } = req.body;

  try {
    // Validar que se envíen los campos requeridos
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Usuario/Email/Teléfono y contraseña son requeridos' });
    }

    // Buscar usuario con su rol y permisos (por username, email o phone)
    const user = await findUserByIdentifier(identifier);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no registrado o inactivo' });
    }

    // Verificar si el usuario está bloqueado
    if (user.is_blocked) {
      // Verificar si es bloqueo temporal (con fecha de expiración aún vigente)
      if (user.block_until) {
        const blockExpiration = new Date(user.block_until);
        const now = new Date();
        if (blockExpiration > now) {
          // Bloqueo temporal aún vigente
          return res.status(403).json({
            error: 'Usuario bloqueado temporalmente',
            blockUntil: user.block_until,
            message: `Acceso bloqueado hasta: ${blockExpiration.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`,
          });
        }
        // El bloqueo temporal expiró - permitir acceso (auto-desbloqueo)
        // Nota: Se podría actualizar is_blocked = false aquí automáticamente
      } else {
        // Bloqueo permanente (manual por administrador)
        return res.status(403).json({
          error: 'Usuario bloqueado. Contacte al administrador.',
        });
      }
    }

    // Comparar contraseñas
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Contraseña incorrecta',
      });
    }

    // Login exitoso: resetear intentos
    await resetLoginAttempts(user.id);

    // Generar token JWT
    const token = jwt.sign(
      {
        id: user.id,
        id_rol: user.role_id,
        email: user.email,
        role: user.role,
        adminType: user.admin_type,
      },
      process.env.JWT_SECRET,
      { expiresIn: '4h' }
    );

    // Excluir password_hash de la respuesta
    const { password_hash: _password_hash, ...userWithoutPassword } = user;

    // Transformar campos snake_case → camelCase para el frontend
    const userResponse = {
      id: userWithoutPassword.id,
      username: userWithoutPassword.username,
      email: userWithoutPassword.email,
      name: userWithoutPassword.name,
      phone: userWithoutPassword.phone,
      avatar_url: userWithoutPassword.avatar_url,

      // Campos críticos transformados
      role: userWithoutPassword.role,
      id_rol: userWithoutPassword.role_id, // Transformación: role_id → id_rol
      adminType: userWithoutPassword.admin_type, // Transformación: admin_type → adminType
      isActive: userWithoutPassword.is_active, // Transformación: is_active → isActive

      // Customer ID para clientes (usado en filtro de reservas)
      customerId: userWithoutPassword.customer_id,

      // Permisos y campos adicionales
      permissions: userWithoutPassword.permissions || [],
      managedFields: userWithoutPassword.managed_fields || [],

      // Campos de auditoría
      lastLogin: userWithoutPassword.last_login,
      status: userWithoutPassword.status,
      createdBy: userWithoutPassword.created_by,
      dateTimeRegistration: userWithoutPassword.date_time_registration,
    };

    // Responder con datos del usuario transformados + token
    res.json({
      message: 'Login exitoso',
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

module.exports = { login };
