const {
  getAllRoles,
  getRoleById,
  assignPermissionsToRole,
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
  permissionNameExists,
} = require('../models/rolesPermissionsModel');

// ============= ROLES =============

/**
 * Obtener todos los roles
 */
const getRoles = async (req, res) => {
  try {
    const onlyActive = req.query.only_active === 'true';
    const roles = await getAllRoles(onlyActive);

    res.json({
      success: true,
      data: roles,
      count: roles.length,
    });
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener roles',
    });
  }
};

/**
 * Obtener un rol por ID
 */
const getRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await getRoleById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Rol no encontrado',
      });
    }

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Error al obtener rol:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener rol',
    });
  }
};

/**
 * Asignar permisos a un rol
 */
const assignPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permission_ids } = req.body;

    // Validaciones
    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de IDs de permisos',
      });
    }

    // Verificar si el rol existe
    const existingRole = await getRoleById(id);
    if (!existingRole) {
      return res.status(404).json({
        success: false,
        error: 'Rol no encontrado',
      });
    }

    const userId = req.user?.id || 1;
    await assignPermissionsToRole(id, permission_ids, userId);

    // Obtener el rol actualizado con sus nuevos permisos
    const updatedRole = await getRoleById(id);

    res.json({
      success: true,
      message: 'Permisos asignados exitosamente',
      data: updatedRole,
    });
  } catch (error) {
    console.error('Error al asignar permisos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al asignar permisos',
    });
  }
};

// ============= PERMISSIONS =============

/**
 * Obtener todos los permisos
 */
const getPermissions = async (req, res) => {
  try {
    const onlyActive = req.query.only_active === 'true';
    const permissions = await getAllPermissions(onlyActive);

    res.json({
      success: true,
      data: permissions,
      count: permissions.length,
    });
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener permisos',
    });
  }
};

/**
 * Obtener un permiso por ID
 */
const getPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const permission = await getPermissionById(id);

    if (!permission) {
      return res.status(404).json({
        success: false,
        error: 'Permiso no encontrado',
      });
    }

    res.json({
      success: true,
      data: permission,
    });
  } catch (error) {
    console.error('Error al obtener permiso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener permiso',
    });
  }
};

/**
 * Crear un nuevo permiso
 */
const createNewPermission = async (req, res) => {
  try {
    const { name, description, module, is_active } = req.body;

    // Validaciones
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre del permiso es requerido',
      });
    }

    // Verificar si el nombre ya existe
    const nameExists = await permissionNameExists(name);
    if (nameExists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un permiso con ese nombre',
      });
    }

    const permissionData = {
      name: name.trim(),
      description,
      module,
      is_active,
      user_id_registration: req.user?.id || 1,
    };

    const newPermission = await createPermission(permissionData);

    res.status(201).json({
      success: true,
      message: 'Permiso creado exitosamente',
      data: newPermission,
    });
  } catch (error) {
    console.error('Error al crear permiso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear permiso',
    });
  }
};

/**
 * Actualizar un permiso
 */
const updateExistingPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, module, is_active } = req.body;

    // Verificar si el permiso existe
    const existingPermission = await getPermissionById(id);
    if (!existingPermission) {
      return res.status(404).json({
        success: false,
        error: 'Permiso no encontrado',
      });
    }

    // Si se está actualizando el nombre, verificar que no exista
    if (name && name.trim()) {
      const nameExists = await permissionNameExists(name, id);
      if (nameExists) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe un permiso con ese nombre',
        });
      }
    }

    const permissionData = {
      name: name?.trim(),
      description,
      module,
      is_active,
      user_id_modification: req.user?.id || 1,
    };

    const updatedPermission = await updatePermission(id, permissionData);

    res.json({
      success: true,
      message: 'Permiso actualizado exitosamente',
      data: updatedPermission,
    });
  } catch (error) {
    console.error('Error al actualizar permiso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar permiso',
    });
  }
};

/**
 * Eliminar un permiso (soft delete)
 */
const deletePermissionById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el permiso existe
    const existingPermission = await getPermissionById(id);
    if (!existingPermission) {
      return res.status(404).json({
        success: false,
        error: 'Permiso no encontrado',
      });
    }

    const user_id = req.user?.id || 1;
    const deleted = await deletePermission(id, user_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Permiso eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el permiso',
      });
    }
  } catch (error) {
    console.error('Error al eliminar permiso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar permiso',
    });
  }
};

module.exports = {
  // Roles
  getRoles,
  getRole,
  assignPermissions,
  // Permissions
  getPermissions,
  getPermission,
  createNewPermission,
  updateExistingPermission,
  deletePermissionById,
};
