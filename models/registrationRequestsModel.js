const pool = require('../config/db');

/**
 * Obtener todas las solicitudes de registro con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de solicitudes
 */
const getAllRegistrationRequests = async (filters = {}) => {
  let query = `
    SELECT
      rr.id,
      rr.name,
      rr.email,
      rr.phone,
      rr.dni,
      rr.field_name,
      rr.address,
      rr.department,
      rr.province,
      rr.district,
      rr.documents,
      rr.status,
      rr.reviewed_by,
      rr.reviewed_at,
      rr.rejection_reason,
      rr.user_id_registration,
      rr.date_time_registration,
      rr.user_id_modification,
      rr.date_time_modification,
      u.name AS reviewed_by_name
    FROM registration_requests rr
    LEFT JOIN users u ON rr.reviewed_by = u.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por estado
  if (filters.status) {
    query += ` AND rr.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por departamento
  if (filters.department) {
    query += ` AND rr.department = $${paramCount}`;
    params.push(filters.department);
    paramCount++;
  }

  // Filtro por provincia
  if (filters.province) {
    query += ` AND rr.province = $${paramCount}`;
    params.push(filters.province);
    paramCount++;
  }

  // Filtro por distrito
  if (filters.district) {
    query += ` AND rr.district = $${paramCount}`;
    params.push(filters.district);
    paramCount++;
  }

  // Búsqueda por nombre, email o teléfono
  if (filters.search) {
    query += ` AND (rr.name ILIKE $${paramCount} OR rr.email ILIKE $${paramCount} OR rr.phone ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` ORDER BY rr.date_time_registration DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener una solicitud por ID
 * @param {number} id - ID de la solicitud
 * @returns {Promise<Object|null>} Solicitud o null
 */
const getRegistrationRequestById = async id => {
  const query = `
    SELECT
      rr.*,
      u.name AS reviewed_by_name
    FROM registration_requests rr
    LEFT JOIN users u ON rr.reviewed_by = u.id
    WHERE rr.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear una nueva solicitud de registro
 * @param {Object} requestData - Datos de la solicitud
 * @returns {Promise<Object>} Solicitud creada
 */
const createRegistrationRequest = async requestData => {
  const {
    name,
    email,
    phone,
    dni,
    field_name,
    address,
    department,
    province,
    district,
    documents,
    user_id_registration = null,
  } = requestData;

  const query = `
    INSERT INTO registration_requests (
      name,
      email,
      phone,
      dni,
      field_name,
      address,
      department,
      province,
      district,
      documents,
      status,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    name,
    email,
    phone,
    dni,
    field_name,
    address,
    department,
    province,
    district,
    documents ? JSON.stringify(documents) : null,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar una solicitud de registro
 * @param {number} id - ID de la solicitud
 * @param {Object} requestData - Datos a actualizar
 * @returns {Promise<Object|null>} Solicitud actualizada o null
 */
const updateRegistrationRequest = async (id, requestData) => {
  const {
    name,
    email,
    phone,
    dni,
    field_name,
    address,
    department,
    province,
    district,
    documents,
    user_id_modification,
  } = requestData;

  const query = `
    UPDATE registration_requests
    SET name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        dni = COALESCE($4, dni),
        field_name = COALESCE($5, field_name),
        address = COALESCE($6, address),
        department = COALESCE($7, department),
        province = COALESCE($8, province),
        district = COALESCE($9, district),
        documents = COALESCE($10, documents),
        user_id_modification = $11,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $12
    RETURNING *
  `;

  const result = await pool.query(query, [
    name,
    email,
    phone,
    dni,
    field_name,
    address,
    department,
    province,
    district,
    documents ? JSON.stringify(documents) : null,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Aprobar una solicitud de registro
 * Esta función crea transaccionalmente:
 * 1. Usuario administrador con las credenciales proporcionadas
 * 2. Cancha asignada a ese administrador con TODOS los campos
 * 3. Deportes asociados en field_sports
 * 4. Actualiza la solicitud a estado 'approved'
 *
 * @param {number} id - ID de la solicitud
 * @param {number} reviewed_by - ID del usuario que aprueba
 * @returns {Promise<Object>} Objeto con la solicitud aprobada, userId y fieldId
 */
const approveRegistrationRequest = async (id, reviewed_by) => {
  const bcrypt = require('bcrypt');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener la solicitud completa
    const requestQuery = `SELECT * FROM registration_requests WHERE id = $1`;
    const requestResult = await client.query(requestQuery, [id]);
    const request = requestResult.rows[0];

    if (!request) {
      throw new Error('Solicitud no encontrada');
    }

    if (request.status !== 'pending') {
      throw new Error('Solo se pueden aprobar solicitudes pendientes');
    }

    // 2. Extraer y parsear documents
    const documents =
      typeof request.documents === 'string' ? JSON.parse(request.documents) : request.documents;

    // 3. Extraer credenciales
    const credentials = documents?.credentials || {};
    const username = credentials.username;
    const passwordBase64 = credentials.password;

    if (!username || !passwordBase64) {
      throw new Error('Credenciales no encontradas en la solicitud');
    }

    const plainPassword = Buffer.from(passwordBase64, 'base64').toString('utf-8');

    // 4. Verificar email y username únicos
    const checkUserQuery = `SELECT id FROM users WHERE email = $1 OR username = $2`;
    const checkResult = await client.query(checkUserQuery, [request.email, username]);

    if (checkResult.rows.length > 0) {
      throw new Error('El email o username ya está registrado');
    }

    // 5. Obtener role_id dinámicamente desde la tabla roles
    const roleQuery = `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`;
    const roleResult = await client.query(roleQuery);
    if (roleResult.rows.length === 0) {
      throw new Error('No se encontró el rol de administrador en la base de datos');
    }
    const adminRoleId = roleResult.rows[0].id;

    // 6. Hashear contraseña y crear usuario administrador
    const password_hash = await bcrypt.hash(plainPassword, 10);

    const createUserQuery = `
      INSERT INTO users (
        username, email, password_hash, role_id, admin_type, name, phone,
        is_active, status, created_by, user_id_registration, date_time_registration
      ) VALUES ($1, $2, $3, $4, 'field', $5, $6, true, 'active', $7, $7, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    const userResult = await client.query(createUserQuery, [
      username,
      request.email,
      password_hash,
      adminRoleId,
      request.name,
      request.phone,
      reviewed_by,
    ]);
    const newUserId = userResult.rows[0].id;

    // 7. Extraer datos adicionales del JSON documents
    const businessCoords = documents?.businessCoordinates || {};
    const latitude = businessCoords.latitude || null;
    const longitude = businessCoords.longitude || null;
    const businessPhone = documents?.businessPhone || null;
    const sportTypes = documents?.sportTypes || [];
    const isMultiSport = sportTypes.length > 1;

    // 8. Obtener district_id mediante JOIN con provinces y departments
    let districtId = null;
    if (request.district && request.province && request.department) {
      const districtQuery = `
        SELECT d.id
        FROM districts d
        INNER JOIN provinces p ON d.province_id = p.id
        INNER JOIN departments dep ON d.department_id = dep.id
        WHERE d.name = $1 AND p.name = $2 AND dep.name = $3
      `;
      const districtResult = await client.query(districtQuery, [
        request.district,
        request.province,
        request.department,
      ]);

      if (districtResult.rows.length > 0) {
        districtId = districtResult.rows[0].id;
      }
    }

    // 9. Obtener sport_type_id del primer deporte seleccionado
    let sportTypeId = null;
    if (sportTypes.length > 0) {
      const sportQuery = `SELECT id FROM sport_types WHERE name = $1 LIMIT 1`;
      const sportResult = await client.query(sportQuery, [sportTypes[0]]);

      if (sportResult.rows.length > 0) {
        sportTypeId = sportResult.rows[0].id;
      }
    }

    // 10. Generar campo location (jerarquía geográfica)
    const location = `${request.district}, ${request.province}, ${request.department}`;

    // 11. Crear cancha (price_per_hour=0 indica que el admin debe configurar su precio)
    const createFieldQuery = `
      INSERT INTO fields (
        admin_id, name, location, address, departamento, provincia, distrito,
        district_id, phone, latitude, longitude, price_per_hour,
        status, approval_status, sport_type, is_multi_sport, is_active,
        approved_by, approved_at, created_by, user_id_registration, date_time_registration
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0.00,
        'available', 'approved', $12, $13, true, $14, CURRENT_TIMESTAMP, $14, $14, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    const fieldResult = await client.query(createFieldQuery, [
      newUserId,
      request.field_name,
      location,
      request.address,
      request.department,
      request.province,
      request.district,
      districtId,
      businessPhone,
      latitude,
      longitude,
      sportTypeId,
      isMultiSport,
      reviewed_by,
    ]);

    const newFieldId = fieldResult.rows[0].id;

    // 12. Insertar TODOS los deportes seleccionados en field_sports
    for (const sportName of sportTypes) {
      const sportQuery = `SELECT id FROM sport_types WHERE name = $1`;
      const sportResult = await client.query(sportQuery, [sportName]);

      if (sportResult.rows.length > 0) {
        const sportId = sportResult.rows[0].id;
        await client.query(
          `INSERT INTO field_sports (field_id, sport_id, user_id_registration, date_time_registration)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [newFieldId, sportId, reviewed_by]
        );
      }
    }

    // 13. Actualizar solicitud a "approved"
    const updateRequestQuery = `
      UPDATE registration_requests
      SET status = 'approved', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP,
          user_id_modification = $1, date_time_modification = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const updatedRequestResult = await client.query(updateRequestQuery, [reviewed_by, id]);

    await client.query('COMMIT');

    return {
      request: updatedRequestResult.rows[0],
      userId: newUserId,
      fieldId: newFieldId,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Rechazar una solicitud de registro
 * @param {number} id - ID de la solicitud
 * @param {number} reviewed_by - ID del usuario que rechaza
 * @param {string} rejection_reason - Razón del rechazo
 * @returns {Promise<Object|null>} Solicitud rechazada o null
 */
const rejectRegistrationRequest = async (id, reviewed_by, rejection_reason) => {
  const query = `
    UPDATE registration_requests
    SET status = 'rejected',
        reviewed_by = $1,
        reviewed_at = CURRENT_TIMESTAMP,
        rejection_reason = $2,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [reviewed_by, rejection_reason, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar una solicitud de registro
 * @param {number} id - ID de la solicitud
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteRegistrationRequest = async id => {
  const query = `
    DELETE FROM registration_requests
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Verificar si un email ya tiene una solicitud pendiente o aprobada
 * @param {string} email - Email a verificar
 * @param {number|null} excludeId - ID a excluir de la búsqueda
 * @returns {Promise<boolean>} True si existe
 */
const emailHasPendingRequest = async (email, excludeId = null) => {
  let query = `
    SELECT id FROM registration_requests
    WHERE email = $1 AND status IN ('pending', 'approved')
  `;
  const params = [email];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Obtener estadísticas de solicitudes
 * @returns {Promise<Object>} Estadísticas
 */
const getRegistrationRequestStats = async () => {
  const query = `
    SELECT
      COUNT(*) AS total_requests,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_requests,
      COUNT(*) FILTER (WHERE status = 'approved') AS approved_requests,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_requests,
      COUNT(*) FILTER (WHERE date_time_registration >= CURRENT_DATE - INTERVAL '30 days') AS requests_last_30_days,
      COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at >= CURRENT_DATE - INTERVAL '30 days') AS approved_last_30_days
    FROM registration_requests
  `;

  const result = await pool.query(query);
  return result.rows[0];
};

module.exports = {
  getAllRegistrationRequests,
  getRegistrationRequestById,
  createRegistrationRequest,
  updateRegistrationRequest,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  deleteRegistrationRequest,
  emailHasPendingRequest,
  getRegistrationRequestStats,
};
