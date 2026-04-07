const pool = require('../config/db');

// ============= ROLES =============

/**
 * Obtener todos los roles con sus permisos
 * @param {boolean} onlyActive - Si es true, solo devuelve roles activos
 * @returns {Promise<Array>} Lista de roles
 */
const getAllRoles = async (onlyActive = false) => {
  let query = `
    SELECT
      r.id,
      r.name,
      r.description,
      r.is_active,
      r.user_id_registration,
      r.date_time_registration,
      r.user_id_modification,
      r.date_time_modification,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'module', p.module
          )
        ) FILTER (WHERE p.id IS NOT NULL),
        '[]'
      ) AS permissions
    FROM roles r
    LEFT JOIN roles_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
  `;

  if (onlyActive) {
    query += ` WHERE r.is_active = true`;
  }

  query += ` GROUP BY r.id, r.name, r.description, r.is_active,
             r.user_id_registration, r.date_time_registration,
             r.user_id_modification, r.date_time_modification
             ORDER BY r.name ASC`;

  const result = await pool.query(query);
  return result.rows;
};

/**
 * Obtener un rol por ID con sus permisos
 * @param {number} id - ID del rol
 * @returns {Promise<Object|null>} Rol o null
 */
const getRoleById = async id => {
  const query = `
    SELECT
      r.id,
      r.name,
      r.description,
      r.is_active,
      r.user_id_registration,
      r.date_time_registration,
      r.user_id_modification,
      r.date_time_modification,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'module', p.module
          )
        ) FILTER (WHERE p.id IS NOT NULL),
        '[]'
      ) AS permissions
    FROM roles r
    LEFT JOIN roles_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
    WHERE r.id = $1
    GROUP BY r.id, r.name, r.description, r.is_active,
             r.user_id_registration, r.date_time_registration,
             r.user_id_modification, r.date_time_modification
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Asignar permisos a un rol
 * @param {number} roleId - ID del rol
 * @param {Array} permissionIds - Array de IDs de permisos
 * @param {number} userId - ID del usuario que realiza la acción
 * @returns {Promise<boolean>} True si se asignaron correctamente
 */
const assignPermissionsToRole = async (roleId, permissionIds, userId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Eliminar permisos existentes del rol
    await client.query('DELETE FROM roles_permissions WHERE role_id = $1', [roleId]);

    // Insertar nuevos permisos
    if (permissionIds && permissionIds.length > 0) {
      const values = permissionIds
        .map((permId, index) => {
          const offset = index * 3;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, CURRENT_TIMESTAMP)`;
        })
        .join(', ');

      const params = [];
      permissionIds.forEach(permId => {
        params.push(roleId, permId, userId);
      });

      const insertQuery = `
        INSERT INTO roles_permissions (role_id, permission_id, user_id_registration, date_time_registration)
        VALUES ${values}
      `;

      await client.query(insertQuery, params);
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ============= PERMISSIONS =============

/**
 * Obtener todos los permisos
 * @param {boolean} onlyActive - Si es true, solo devuelve permisos activos
 * @returns {Promise<Array>} Lista de permisos
 */
const getAllPermissions = async (onlyActive = false) => {
  let query = `
    SELECT
      id,
      name,
      description,
      module,
      is_active,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM permissions
  `;

  if (onlyActive) {
    query += ` WHERE is_active = true`;
  }

  query += ` ORDER BY module ASC, name ASC`;

  const result = await pool.query(query);
  return result.rows;
};

/**
 * Obtener un permiso por ID
 * @param {number} id - ID del permiso
 * @returns {Promise<Object|null>} Permiso o null
 */
const getPermissionById = async id => {
  const query = `
    SELECT
      id,
      name,
      description,
      module,
      is_active,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM permissions
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear un nuevo permiso
 * @param {Object} permissionData - Datos del permiso
 * @returns {Promise<Object>} Permiso creado
 */
const createPermission = async permissionData => {
  const { name, description, module, is_active = true, user_id_registration } = permissionData;

  const query = `
    INSERT INTO permissions (
      name,
      description,
      module,
      is_active,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    name,
    description,
    module,
    is_active,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un permiso
 * @param {number} id - ID del permiso
 * @param {Object} permissionData - Datos a actualizar
 * @returns {Promise<Object|null>} Permiso actualizado o null
 */
const updatePermission = async (id, permissionData) => {
  const { name, description, module, is_active, user_id_modification } = permissionData;

  const query = `
    UPDATE permissions
    SET name = COALESCE($1, name),
        description = COALESCE($2, description),
        module = COALESCE($3, module),
        is_active = COALESCE($4, is_active),
        user_id_modification = $5,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `;

  const result = await pool.query(query, [
    name,
    description,
    module,
    is_active,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar (soft delete) un permiso
 * @param {number} id - ID del permiso
 * @param {number} user_id_modification - ID del usuario que realiza la acción
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deletePermission = async (id, user_id_modification) => {
  const query = `
    UPDATE permissions
    SET is_active = false,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0;
};

/**
 * Verificar si un nombre de permiso ya existe
 * @param {string} name - Nombre del permiso
 * @param {number|null} excludeId - ID a excluir de la búsqueda (para updates)
 * @returns {Promise<boolean>} True si existe
 */
const permissionNameExists = async (name, excludeId = null) => {
  let query = `SELECT id FROM permissions WHERE LOWER(name) = LOWER($1)`;
  const params = [name];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

module.exports = {
  // Roles
  getAllRoles,
  getRoleById,
  assignPermissionsToRole,
  // Permissions
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
  permissionNameExists,
};
