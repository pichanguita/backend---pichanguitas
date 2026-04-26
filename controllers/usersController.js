const bcrypt = require('bcrypt');

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updatePassword,
  deleteUser,
  emailExists,
  usernameExists,
  assignFieldsToUser,
  getUsersStats,
} = require('../models/usersModel');
const { transformUserToCamelCase } = require('../utils/transformers');
const {
  logActivity,
  resolveIp,
  ACTIVITY_TYPES,
  ACTIVITY_STATUS,
} = require('../services/activityLogsService');

/**
 * Obtener todos los usuarios con filtros
 */
const getUsers = async (req, res) => {
  try {
    const filters = {
      role_id: req.query.role_id ? parseInt(req.query.role_id) : null,
      admin_type: req.query.admin_type,
      is_active:
        req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      status: req.query.status,
      search: req.query.search,
    };

    const users = await getAllUsers(filters);

    // Eliminar password_hash y transformar a camelCase
    const usersFormatted = users.map(user => {
      const { password_hash: _pwd, ...userWithoutPassword } = user;
      return transformUserToCamelCase(userWithoutPassword);
    });

    res.json({
      success: true,
      data: usersFormatted,
      count: usersFormatted.length,
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios',
    });
  }
};

/**
 * Obtener un usuario por ID
 */
const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    // Eliminar password_hash y transformar a camelCase
    const { password_hash: _pwd, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: transformUserToCamelCase(userWithoutPassword),
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuario',
    });
  }
};

/**
 * Crear un nuevo usuario
 */
const createNewUser = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      role_id,
      admin_type,
      name,
      phone,
      avatar_url,
      is_active,
      status,
    } = req.body;

    // Validaciones básicas
    if (!username || !username.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El username es requerido',
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El email es requerido',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres',
      });
    }

    if (!role_id) {
      return res.status(400).json({
        success: false,
        error: 'El rol es requerido',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido',
      });
    }

    // Verificar si el email ya existe
    const emailExist = await emailExists(email);
    if (emailExist) {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado',
      });
    }

    // Verificar si el username ya existe
    const usernameExist = await usernameExists(username);
    if (usernameExist) {
      return res.status(409).json({
        success: false,
        error: 'El username ya está registrado',
      });
    }

    const userData = {
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      role_id,
      admin_type,
      name: name.trim(),
      phone,
      avatar_url,
      is_active,
      status,
      created_by: req.user?.id || 1,
      user_id_registration: req.user?.id || 1,
    };

    const newUser = await createUser(userData);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: newUser,
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear usuario',
    });
  }
};

/**
 * Actualizar un usuario
 */
const updateExistingUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      username,
      email,
      role_id,
      admin_type,
      name,
      phone,
      avatar_url,
      is_active,
      is_blocked,
      block_until,
      status,
    } = req.body;

    // Verificar si el usuario existe
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    // Si se está actualizando el email, verificar que no exista
    if (email && email.trim()) {
      const emailExist = await emailExists(email, id);
      if (emailExist) {
        return res.status(409).json({
          success: false,
          error: 'El email ya está registrado',
        });
      }
    }

    // Si se está actualizando el username, verificar que no exista
    if (username && username.trim()) {
      const usernameExist = await usernameExists(username, id);
      if (usernameExist) {
        return res.status(409).json({
          success: false,
          error: 'El username ya está registrado',
        });
      }
    }

    const userData = {
      username: username?.trim(),
      email: email?.trim().toLowerCase(),
      role_id,
      admin_type,
      name: name?.trim(),
      phone,
      avatar_url,
      is_active,
      is_blocked,
      block_until,
      status,
      user_id_modification: req.user?.id || 1,
    };

    const updatedUser = await updateUser(id, userData);

    // Registrar actividad si cambió el estado de bloqueo (acción sensible)
    if (is_blocked !== undefined && is_blocked !== existingUser.is_blocked) {
      const actorName = req.user?.name || 'un administrador';
      await logActivity({
        userId: Number(id),
        action: is_blocked ? 'user.blocked' : 'user.unblocked',
        entityType: ACTIVITY_TYPES.SETTINGS,
        entityId: Number(id),
        description: is_blocked
          ? `Acceso bloqueado por ${actorName}`
          : `Acceso desbloqueado por ${actorName}`,
        status: is_blocked ? ACTIVITY_STATUS.WARNING : ACTIVITY_STATUS.SUCCESS,
        ipAddress: resolveIp(req),
        actorUserId: req.user?.id ?? null,
      });
    }

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar usuario',
    });
  }
};

/**
 * Cambiar contraseña de un usuario
 */
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { current_password, new_password } = req.body;

    // Validaciones
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La nueva contraseña debe tener al menos 6 caracteres',
      });
    }

    // Verificar si el usuario existe
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    // Si el usuario está cambiando su propia contraseña, verificar la actual
    const requestingUserId = req.user?.id;
    const isOwnPassword = parseInt(id) === requestingUserId;

    if (isOwnPassword && current_password) {
      // Verificar contraseña actual
      const isValidPassword = await bcrypt.compare(current_password, existingUser.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          error: 'La contraseña actual es incorrecta',
        });
      }
    }

    const user_id_modification = req.user?.id || 1;
    const updated = await updatePassword(id, new_password, user_id_modification);

    if (updated) {
      await logActivity({
        userId: Number(id),
        action: 'user.password_changed',
        entityType: ACTIVITY_TYPES.SETTINGS,
        entityId: Number(id),
        description: isOwnPassword
          ? 'Cambió su contraseña'
          : `Contraseña modificada por ${req.user?.name || 'un administrador'}`,
        status: ACTIVITY_STATUS.SUCCESS,
        ipAddress: resolveIp(req),
        actorUserId: req.user?.id ?? null,
      });

      res.json({
        success: true,
        message: 'Contraseña actualizada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo actualizar la contraseña',
      });
    }
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar contraseña',
    });
  }
};

/**
 * Eliminar un usuario (soft delete)
 */
const deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el usuario existe
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    // No permitir eliminar al mismo usuario que está autenticado
    if (parseInt(id) === req.user?.id) {
      return res.status(400).json({
        success: false,
        error: 'No puedes eliminarte a ti mismo',
      });
    }

    const user_id = req.user?.id || 1;
    const deleted = await deleteUser(id, user_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el usuario',
      });
    }
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar usuario',
    });
  }
};

/**
 * Asignar canchas a un usuario
 */
const assignFields = async (req, res) => {
  try {
    const { id } = req.params;
    const { field_ids } = req.body;

    // Validaciones
    if (!Array.isArray(field_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de IDs de canchas',
      });
    }

    // Verificar si el usuario existe
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    const assignedBy = req.user?.id || 1;
    await assignFieldsToUser(id, field_ids, assignedBy);

    // Obtener el usuario actualizado con sus canchas
    const updatedUser = await getUserById(id);
    const { password_hash: _pwd, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'Canchas asignadas exitosamente',
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Error al asignar canchas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al asignar canchas',
    });
  }
};

/**
 * Obtener estadísticas de usuarios
 */
const getStats = async (req, res) => {
  try {
    const stats = await getUsersStats();

    res.json({
      success: true,
      data: {
        total_users: parseInt(stats.total_users),
        active_users: parseInt(stats.active_users),
        inactive_users: parseInt(stats.inactive_users),
        users_with_fields: parseInt(stats.users_with_fields),
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de usuarios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de usuarios',
    });
  }
};

module.exports = {
  getUsers,
  getUser,
  createNewUser,
  updateExistingUser,
  changePassword,
  deleteUserById,
  assignFields,
  getStats,
};

/**
 * Actualizar el perfil del usuario autenticado (Mi Perfil)
 * Permite a cualquier usuario autenticado actualizar su propio perfil
 */
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    const { name, email, phone } = req.body;

    // Verificar si el usuario existe
    const existingUser = await getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    // Si se está actualizando el email, verificar que no exista
    if (email && email.trim() && email.trim().toLowerCase() !== existingUser.email) {
      const emailExist = await emailExists(email, userId);
      if (emailExist) {
        return res.status(409).json({
          success: false,
          error: 'El email ya está registrado por otro usuario',
        });
      }
    }

    const userData = {
      name: name?.trim(),
      email: email?.trim().toLowerCase(),
      phone: phone?.trim(),
      user_id_modification: userId,
    };

    const updatedUser = await updateUser(userId, userData);

    // Eliminar password_hash de la respuesta
    const { password_hash: _pwd, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: transformUserToCamelCase(userWithoutPassword),
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar perfil',
    });
  }
};

module.exports.updateMyProfile = updateMyProfile;

/**
 * Resetear contraseña de un usuario (genera contraseña temporal)
 * Solo disponible para SuperAdmin (role_id = 1)
 */
const resetPasswordTemporary = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el usuario existe
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    // No permitir resetear contraseña de otros super_admin
    if (existingUser.role_id === 1) {
      return res.status(403).json({
        success: false,
        error: 'No se puede resetear la contraseña de otro SuperAdmin',
      });
    }

    // Generar contraseña temporal aleatoria (8 caracteres)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let temporaryPassword = '';
    for (let i = 0; i < 8; i++) {
      temporaryPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Actualizar la contraseña del usuario
    const user_id_modification = req.user?.id || 1;
    const updated = await updatePassword(id, temporaryPassword, user_id_modification);

    if (updated) {
      // Registrar actividad (password reset por SA)
      const actorName = req.user?.name || 'un administrador';
      await logActivity({
        userId: Number(id),
        action: 'user.password_reset',
        entityType: ACTIVITY_TYPES.SETTINGS,
        entityId: Number(id),
        description: `Contraseña reseteada por ${actorName}`,
        status: ACTIVITY_STATUS.WARNING,
        ipAddress: resolveIp(req),
        actorUserId: req.user?.id ?? null,
      });

      res.json({
        success: true,
        message: 'Contraseña reseteada exitosamente',
        data: {
          temporaryPassword,
          userName: existingUser.name,
          userEmail: existingUser.email,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo resetear la contraseña',
      });
    }
  } catch (error) {
    console.error('Error al resetear contraseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al resetear contraseña',
    });
  }
};

module.exports.resetPasswordTemporary = resetPasswordTemporary;
