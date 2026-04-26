const bcrypt = require('bcrypt');

const pool = require('../config/db');
const { keyToProxyUrl } = require('../services/wasabiService');

// ========================================
// HELPERS DE RESPUESTA
// ========================================

const attachFiles = (request, filesByRequestId) => {
  const files = filesByRequestId.get(request.id) || [];
  return {
    ...request,
    files: files.map(f => ({
      id: f.id,
      kind: f.kind,
      originalName: f.original_name,
      mimeType: f.mime_type,
      sizeBytes: f.size_bytes !== null ? Number(f.size_bytes) : null,
      wasabiKey: f.wasabi_key,
      // URL "pública" vía proxy — sólo aplicable a módulos no sensibles.
      // Para documentos sensibles el FE debe usar el endpoint autenticado
      // /api/registration-requests/:id/files/:fileId/download.
      proxyUrl: keyToProxyUrl(f.wasabi_key),
      createdAt: f.date_time_registration,
    })),
  };
};

const attachSports = (request, sportsByRequestId) => {
  const sports = sportsByRequestId.get(request.id) || [];
  return {
    ...request,
    sports: sports.map(s => ({
      id: s.sport_type_id,
      name: s.sport_name,
    })),
  };
};

const fetchFilesFor = async (client, requestIds) => {
  const map = new Map();
  if (requestIds.length === 0) return map;
  const result = await client.query(
    `SELECT id, registration_request_id, wasabi_key, original_name, mime_type,
            size_bytes, kind, date_time_registration
     FROM registration_request_files
     WHERE registration_request_id = ANY($1::int[])
     ORDER BY id ASC`,
    [requestIds]
  );
  for (const row of result.rows) {
    const list = map.get(row.registration_request_id) || [];
    list.push(row);
    map.set(row.registration_request_id, list);
  }
  return map;
};

const fetchSportsFor = async (client, requestIds) => {
  const map = new Map();
  if (requestIds.length === 0) return map;
  const result = await client.query(
    `SELECT rrs.registration_request_id, rrs.sport_type_id, st.name AS sport_name
     FROM registration_request_sports rrs
     JOIN sport_types st ON st.id = rrs.sport_type_id
     WHERE rrs.registration_request_id = ANY($1::int[])
     ORDER BY st.name ASC`,
    [requestIds]
  );
  for (const row of result.rows) {
    const list = map.get(row.registration_request_id) || [];
    list.push(row);
    map.set(row.registration_request_id, list);
  }
  return map;
};

// ========================================
// QUERIES PRINCIPALES
// ========================================

const baseSelect = `
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
    rr.business_ruc,
    rr.business_phone,
    rr.business_reference,
    rr.business_latitude,
    rr.business_longitude,
    rr.address_references,
    rr.experience,
    rr.reason_to_join,
    rr.credentials_username,
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
`;

const getAllRegistrationRequests = async (filters = {}) => {
  const client = await pool.connect();
  try {
    let query = `${baseSelect} WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      query += ` AND rr.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }
    if (filters.department) {
      query += ` AND rr.department = $${paramCount}`;
      params.push(filters.department);
      paramCount++;
    }
    if (filters.province) {
      query += ` AND rr.province = $${paramCount}`;
      params.push(filters.province);
      paramCount++;
    }
    if (filters.district) {
      query += ` AND rr.district = $${paramCount}`;
      params.push(filters.district);
      paramCount++;
    }
    if (filters.search) {
      query += ` AND (rr.name ILIKE $${paramCount} OR rr.email ILIKE $${paramCount} OR rr.phone ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    query += ` ORDER BY rr.date_time_registration DESC`;

    const result = await client.query(query, params);
    const ids = result.rows.map(r => r.id);
    const filesByRequest = await fetchFilesFor(client, ids);
    const sportsByRequest = await fetchSportsFor(client, ids);

    return result.rows.map(row => attachSports(attachFiles(row, filesByRequest), sportsByRequest));
  } finally {
    client.release();
  }
};

const getRegistrationRequestById = async id => {
  const client = await pool.connect();
  try {
    const result = await client.query(`${baseSelect} WHERE rr.id = $1`, [id]);
    if (result.rows.length === 0) return null;
    const filesByRequest = await fetchFilesFor(client, [id]);
    const sportsByRequest = await fetchSportsFor(client, [id]);
    return attachSports(attachFiles(result.rows[0], filesByRequest), sportsByRequest);
  } finally {
    client.release();
  }
};

// ========================================
// CREATE
// ========================================

/**
 * Crea una solicitud con sus archivos y deportes en una transacción.
 *
 * @param {Object} requestData - Campos planos del request.
 * @param {Array}  [files]     - [{ wasabi_key, original_name, mime_type, size_bytes, kind }]
 * @param {Array}  [sportNames]- Nombres de deportes (se resuelven contra sport_types).
 */
const createRegistrationRequest = async (requestData, files = [], sportNames = []) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertQuery = `
      INSERT INTO registration_requests (
        name, email, phone, dni, field_name, address,
        department, province, district,
        business_ruc, business_phone, business_reference,
        business_latitude, business_longitude, address_references,
        experience, reason_to_join,
        credentials_username, credentials_password_enc,
        status, user_id_registration, date_time_registration
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'pending', $20, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const insertResult = await client.query(insertQuery, [
      requestData.name,
      requestData.email,
      requestData.phone,
      requestData.dni,
      requestData.field_name,
      requestData.address,
      requestData.department,
      requestData.province,
      requestData.district,
      requestData.business_ruc || null,
      requestData.business_phone || null,
      requestData.business_reference || null,
      requestData.business_latitude ?? null,
      requestData.business_longitude ?? null,
      requestData.address_references || null,
      requestData.experience || null,
      requestData.reason_to_join || null,
      requestData.credentials_username || null,
      requestData.credentials_password_enc || null,
      requestData.user_id_registration ?? null,
    ]);

    const newId = insertResult.rows[0].id;

    for (const file of files) {
      await client.query(
        `INSERT INTO registration_request_files
           (registration_request_id, wasabi_key, original_name, mime_type, size_bytes, kind, user_id_registration)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newId,
          file.wasabi_key,
          file.original_name,
          file.mime_type,
          file.size_bytes ?? null,
          file.kind,
          requestData.user_id_registration ?? null,
        ]
      );
    }

    for (const sportName of sportNames) {
      if (!sportName) continue;
      const sportResult = await client.query(
        `SELECT id FROM sport_types WHERE name = $1 LIMIT 1`,
        [sportName]
      );
      if (sportResult.rows.length > 0) {
        await client.query(
          `INSERT INTO registration_request_sports
             (registration_request_id, sport_type_id, user_id_registration)
           VALUES ($1, $2, $3)
           ON CONFLICT (registration_request_id, sport_type_id) DO NOTHING`,
          [newId, sportResult.rows[0].id, requestData.user_id_registration ?? null]
        );
      }
    }

    await client.query('COMMIT');

    return getRegistrationRequestById(newId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========================================
// UPDATE
// ========================================

const updateRegistrationRequest = async (id, requestData) => {
  const query = `
    UPDATE registration_requests
    SET name               = COALESCE($1,  name),
        email              = COALESCE($2,  email),
        phone              = COALESCE($3,  phone),
        dni                = COALESCE($4,  dni),
        field_name         = COALESCE($5,  field_name),
        address            = COALESCE($6,  address),
        department         = COALESCE($7,  department),
        province           = COALESCE($8,  province),
        district           = COALESCE($9,  district),
        business_ruc       = COALESCE($10, business_ruc),
        business_phone     = COALESCE($11, business_phone),
        business_reference = COALESCE($12, business_reference),
        business_latitude  = COALESCE($13, business_latitude),
        business_longitude = COALESCE($14, business_longitude),
        address_references = COALESCE($15, address_references),
        experience         = COALESCE($16, experience),
        reason_to_join     = COALESCE($17, reason_to_join),
        user_id_modification   = $18,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $19
    RETURNING id
  `;

  const result = await pool.query(query, [
    requestData.name || null,
    requestData.email || null,
    requestData.phone || null,
    requestData.dni || null,
    requestData.field_name || null,
    requestData.address || null,
    requestData.department || null,
    requestData.province || null,
    requestData.district || null,
    requestData.business_ruc || null,
    requestData.business_phone || null,
    requestData.business_reference || null,
    requestData.business_latitude ?? null,
    requestData.business_longitude ?? null,
    requestData.address_references || null,
    requestData.experience || null,
    requestData.reason_to_join || null,
    requestData.user_id_modification ?? null,
    id,
  ]);

  if (result.rows.length === 0) return null;
  return getRegistrationRequestById(id);
};

// ========================================
// APPROVE
// ========================================

/**
 * Aprueba la solicitud: crea usuario admin, cancha, registros en field_sports
 * y marca la solicitud como 'approved' en una transacción.
 */
const approveRegistrationRequest = async (id, reviewed_by) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT * FROM registration_requests WHERE id = $1`,
      [id]
    );
    const request = requestResult.rows[0];

    if (!request) throw new Error('Solicitud no encontrada');
    if (request.status !== 'pending') {
      throw new Error('Solo se pueden aprobar solicitudes pendientes');
    }

    const username = request.credentials_username;
    const passwordEncoded = request.credentials_password_enc;

    if (!username || !passwordEncoded) {
      throw new Error('Credenciales no encontradas en la solicitud');
    }

    const plainPassword = Buffer.from(passwordEncoded, 'base64').toString('utf-8');

    const checkResult = await client.query(
      `SELECT id FROM users WHERE email = $1 OR username = $2`,
      [request.email, username]
    );
    if (checkResult.rows.length > 0) {
      throw new Error('El email o username ya está registrado');
    }

    const roleResult = await client.query(
      `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`
    );
    if (roleResult.rows.length === 0) {
      throw new Error('No se encontró el rol de administrador en la base de datos');
    }
    const adminRoleId = roleResult.rows[0].id;

    const password_hash = await bcrypt.hash(plainPassword, 10);

    const userResult = await client.query(
      `INSERT INTO users (
         username, email, password_hash, role_id, admin_type, name, phone,
         is_active, status, created_by, user_id_registration, date_time_registration
       ) VALUES ($1, $2, $3, $4, 'field', $5, $6, true, 'active', $7, $7, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        username,
        request.email,
        password_hash,
        adminRoleId,
        request.name,
        request.phone,
        reviewed_by,
      ]
    );
    const newUserId = userResult.rows[0].id;

    // Deportes asociados a la solicitud
    const sportsResult = await client.query(
      `SELECT rrs.sport_type_id, st.name
       FROM registration_request_sports rrs
       JOIN sport_types st ON st.id = rrs.sport_type_id
       WHERE rrs.registration_request_id = $1
       ORDER BY rrs.id ASC`,
      [id]
    );
    const sports = sportsResult.rows;
    const primarySportId = sports.length > 0 ? sports[0].sport_type_id : null;
    const isMultiSport = sports.length > 1;

    // district_id por nombres jerárquicos
    let districtId = null;
    if (request.district && request.province && request.department) {
      const districtQuery = await client.query(
        `SELECT d.id
         FROM districts d
         INNER JOIN provinces p ON d.province_id = p.id
         INNER JOIN departments dep ON d.department_id = dep.id
         WHERE d.name = $1 AND p.name = $2 AND dep.name = $3`,
        [request.district, request.province, request.department]
      );
      if (districtQuery.rows.length > 0) districtId = districtQuery.rows[0].id;
    }

    const location = `${request.district}, ${request.province}, ${request.department}`;

    const fieldResult = await client.query(
      `INSERT INTO fields (
         admin_id, name, location, address, departamento, provincia, distrito,
         district_id, phone, latitude, longitude, price_per_hour,
         status, approval_status, sport_type, is_multi_sport, is_active,
         approved_by, approved_at, created_by, user_id_registration, date_time_registration
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0.00,
         'available', 'approved', $12, $13, true, $14, CURRENT_TIMESTAMP, $14, $14, CURRENT_TIMESTAMP
       )
       RETURNING id`,
      [
        newUserId,
        request.field_name,
        location,
        request.address,
        request.department,
        request.province,
        request.district,
        districtId,
        request.business_phone,
        request.business_latitude,
        request.business_longitude,
        primarySportId,
        isMultiSport,
        reviewed_by,
      ]
    );

    const newFieldId = fieldResult.rows[0].id;

    for (const sport of sports) {
      await client.query(
        `INSERT INTO field_sports (field_id, sport_id, user_id_registration, date_time_registration)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [newFieldId, sport.sport_type_id, reviewed_by]
      );
    }

    await client.query(
      `UPDATE registration_requests
         SET status = 'approved',
             reviewed_by = $1,
             reviewed_at = CURRENT_TIMESTAMP,
             user_id_modification = $1,
             date_time_modification = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reviewed_by, id]
    );

    await client.query('COMMIT');

    const updatedRequest = await getRegistrationRequestById(id);

    return {
      request: updatedRequest,
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

// ========================================
// REJECT
// ========================================

const rejectRegistrationRequest = async (id, reviewed_by, rejection_reason) => {
  const result = await pool.query(
    `UPDATE registration_requests
     SET status = 'rejected',
         reviewed_by = $1,
         reviewed_at = CURRENT_TIMESTAMP,
         rejection_reason = $2,
         user_id_modification = $1,
         date_time_modification = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING id`,
    [reviewed_by, rejection_reason, id]
  );
  if (result.rows.length === 0) return null;
  return getRegistrationRequestById(id);
};

// ========================================
// DELETE
// ========================================

/**
 * Elimina la solicitud. Los archivos en registration_request_files se
 * borran por CASCADE; se devuelven las keys para que el controller
 * elimine los objetos en Wasabi.
 */
const deleteRegistrationRequest = async id => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const filesResult = await client.query(
      `SELECT wasabi_key FROM registration_request_files WHERE registration_request_id = $1`,
      [id]
    );
    const keys = filesResult.rows.map(r => r.wasabi_key);

    const deleteResult = await client.query(
      `DELETE FROM registration_requests WHERE id = $1 RETURNING id`,
      [id]
    );
    const deleted = deleteResult.rows.length > 0;

    await client.query('COMMIT');
    return { deleted, keys };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========================================
// MISC
// ========================================

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

const getRegistrationRequestStats = async () => {
  const result = await pool.query(`
    SELECT
      COUNT(*) AS total_requests,
      COUNT(*) FILTER (WHERE status = 'pending')  AS pending_requests,
      COUNT(*) FILTER (WHERE status = 'approved') AS approved_requests,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_requests,
      COUNT(*) FILTER (WHERE date_time_registration >= CURRENT_DATE - INTERVAL '30 days') AS requests_last_30_days,
      COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at >= CURRENT_DATE - INTERVAL '30 days') AS approved_last_30_days
    FROM registration_requests
  `);
  return result.rows[0];
};

const getRegistrationRequestFileById = async (requestId, fileId) => {
  const result = await pool.query(
    `SELECT id, registration_request_id, wasabi_key, original_name, mime_type, size_bytes, kind
     FROM registration_request_files
     WHERE id = $1 AND registration_request_id = $2`,
    [fileId, requestId]
  );
  return result.rows[0] || null;
};

module.exports = {
  getAllRegistrationRequests,
  getRegistrationRequestById,
  getRegistrationRequestFileById,
  createRegistrationRequest,
  updateRegistrationRequest,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  deleteRegistrationRequest,
  emailHasPendingRequest,
  getRegistrationRequestStats,
};
