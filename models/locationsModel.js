const pool = require('../config/db');

// ============= DEPARTMENTS =============

/**
 * Obtener todos los departamentos
 * @returns {Promise<Array>} Lista de departamentos
 */
const getAllDepartments = async () => {
  const query = `
    SELECT
      id,
      code,
      name,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM departments
    ORDER BY name ASC
  `;

  const result = await pool.query(query);
  return result.rows;
};

/**
 * Obtener un departamento por ID
 * @param {number} id - ID del departamento
 * @returns {Promise<Object|null>} Departamento o null
 */
const getDepartmentById = async id => {
  const query = `
    SELECT
      id,
      code,
      name,
      user_id_registration,
      date_time_registration,
      user_id_modification,
      date_time_modification
    FROM departments
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

// ============= PROVINCES =============

/**
 * Obtener todas las provincias (opcionalmente filtradas por departamento)
 * @param {number|null} departmentId - ID del departamento (opcional)
 * @returns {Promise<Array>} Lista de provincias
 */
const getAllProvinces = async (departmentId = null) => {
  let query = `
    SELECT
      p.id,
      p.code,
      p.name,
      p.department_id,
      d.name AS department_name,
      p.user_id_registration,
      p.date_time_registration,
      p.user_id_modification,
      p.date_time_modification
    FROM provinces p
    LEFT JOIN departments d ON p.department_id = d.id
  `;

  const params = [];

  if (departmentId) {
    query += ` WHERE p.department_id = $1`;
    params.push(departmentId);
  }

  query += ` ORDER BY p.name ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener una provincia por ID
 * @param {number} id - ID de la provincia
 * @returns {Promise<Object|null>} Provincia o null
 */
const getProvinceById = async id => {
  const query = `
    SELECT
      p.id,
      p.code,
      p.name,
      p.department_id,
      d.name AS department_name,
      p.user_id_registration,
      p.date_time_registration,
      p.user_id_modification,
      p.date_time_modification
    FROM provinces p
    LEFT JOIN departments d ON p.department_id = d.id
    WHERE p.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

// ============= DISTRICTS =============

/**
 * Obtener todos los distritos (opcionalmente filtrados por provincia)
 * @param {number|null} provinceId - ID de la provincia (opcional)
 * @returns {Promise<Array>} Lista de distritos
 */
const getAllDistricts = async (provinceId = null) => {
  let query = `
    SELECT
      d.id,
      d.code,
      d.name,
      d.province_id,
      p.name AS province_name,
      d.department_id,
      dep.name AS department_name,
      d.user_id_registration,
      d.date_time_registration,
      d.user_id_modification,
      d.date_time_modification
    FROM districts d
    LEFT JOIN provinces p ON d.province_id = p.id
    LEFT JOIN departments dep ON d.department_id = dep.id
  `;

  const params = [];

  if (provinceId) {
    query += ` WHERE d.province_id = $1`;
    params.push(provinceId);
  }

  query += ` ORDER BY d.name ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un distrito por ID
 * @param {number} id - ID del distrito
 * @returns {Promise<Object|null>} Distrito o null
 */
const getDistrictById = async id => {
  const query = `
    SELECT
      d.id,
      d.code,
      d.name,
      d.province_id,
      p.name AS province_name,
      d.department_id,
      dep.name AS department_name,
      d.user_id_registration,
      d.date_time_registration,
      d.user_id_modification,
      d.date_time_modification
    FROM districts d
    LEFT JOIN provinces p ON d.province_id = p.id
    LEFT JOIN departments dep ON d.department_id = dep.id
    WHERE d.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener ubicación completa (departamento, provincia, distrito) dado un distrito
 * @param {number} districtId - ID del distrito
 * @returns {Promise<Object|null>} Ubicación completa o null
 */
const getCompleteLocation = async districtId => {
  const query = `
    SELECT
      d.id AS district_id,
      d.name AS district_name,
      d.code AS district_code,
      p.id AS province_id,
      p.name AS province_name,
      p.code AS province_code,
      dep.id AS department_id,
      dep.name AS department_name,
      dep.code AS department_code
    FROM districts d
    JOIN provinces p ON d.province_id = p.id
    JOIN departments dep ON d.department_id = dep.id
    WHERE d.id = $1
  `;

  const result = await pool.query(query, [districtId]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

// ============= UBICACIONES CON CANCHAS =============

/**
 * Obtener departamentos que tienen al menos una cancha registrada y activa
 * @returns {Promise<Array>} Lista de departamentos con canchas
 */
const getDepartmentsWithFields = async () => {
  const query = `
    SELECT DISTINCT
      dep.id,
      dep.code,
      dep.name,
      dep.user_id_registration,
      dep.date_time_registration,
      dep.user_id_modification,
      dep.date_time_modification,
      COUNT(DISTINCT f.id) AS fields_count
    FROM departments dep
    INNER JOIN fields f ON LOWER(TRIM(f.departamento)) = LOWER(TRIM(dep.name))
    WHERE f.is_active = true
      AND f.approval_status = 'approved'
    GROUP BY dep.id, dep.code, dep.name, dep.user_id_registration,
             dep.date_time_registration, dep.user_id_modification, dep.date_time_modification
    ORDER BY dep.name ASC
  `;

  const result = await pool.query(query);
  return result.rows;
};

/**
 * Obtener provincias que tienen al menos una cancha registrada y activa
 * @param {number|null} departmentId - ID del departamento (opcional)
 * @param {string|null} departmentName - Nombre del departamento (opcional)
 * @returns {Promise<Array>} Lista de provincias con canchas
 */
const getProvincesWithFields = async (departmentId = null, departmentName = null) => {
  let query = `
    SELECT DISTINCT
      p.id,
      p.code,
      p.name,
      p.department_id,
      dep.name AS department_name,
      p.user_id_registration,
      p.date_time_registration,
      p.user_id_modification,
      p.date_time_modification,
      COUNT(DISTINCT f.id) AS fields_count
    FROM provinces p
    INNER JOIN departments dep ON p.department_id = dep.id
    INNER JOIN fields f ON LOWER(TRIM(f.provincia)) = LOWER(TRIM(p.name))
    WHERE f.is_active = true
      AND f.approval_status = 'approved'
  `;

  const params = [];

  if (departmentId) {
    query += ` AND p.department_id = $1`;
    params.push(departmentId);
  } else if (departmentName) {
    query += ` AND LOWER(TRIM(dep.name)) = LOWER(TRIM($1))`;
    params.push(departmentName);
  }

  query += `
    GROUP BY p.id, p.code, p.name, p.department_id, dep.name,
             p.user_id_registration, p.date_time_registration,
             p.user_id_modification, p.date_time_modification
    ORDER BY p.name ASC
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener distritos que tienen al menos una cancha registrada y activa
 * @param {number|null} provinceId - ID de la provincia (opcional)
 * @param {string|null} provinceName - Nombre de la provincia (opcional)
 * @returns {Promise<Array>} Lista de distritos con canchas
 */
const getDistrictsWithFields = async (provinceId = null, provinceName = null) => {
  let query = `
    SELECT DISTINCT
      d.id,
      d.code,
      d.name,
      d.province_id,
      p.name AS province_name,
      d.department_id,
      dep.name AS department_name,
      d.user_id_registration,
      d.date_time_registration,
      d.user_id_modification,
      d.date_time_modification,
      COUNT(DISTINCT f.id) AS fields_count
    FROM districts d
    INNER JOIN provinces p ON d.province_id = p.id
    INNER JOIN departments dep ON d.department_id = dep.id
    INNER JOIN fields f ON LOWER(TRIM(f.distrito)) = LOWER(TRIM(d.name))
    WHERE f.is_active = true
      AND f.approval_status = 'approved'
  `;

  const params = [];

  if (provinceId) {
    query += ` AND d.province_id = $1`;
    params.push(provinceId);
  } else if (provinceName) {
    query += ` AND LOWER(TRIM(p.name)) = LOWER(TRIM($1))`;
    params.push(provinceName);
  }

  query += `
    GROUP BY d.id, d.code, d.name, d.province_id, p.name, d.department_id, dep.name,
             d.user_id_registration, d.date_time_registration,
             d.user_id_modification, d.date_time_modification
    ORDER BY d.name ASC
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

module.exports = {
  // Departments
  getAllDepartments,
  getDepartmentById,
  // Provinces
  getAllProvinces,
  getProvinceById,
  // Districts
  getAllDistricts,
  getDistrictById,
  // Utilities
  getCompleteLocation,
  // Ubicaciones con canchas
  getDepartmentsWithFields,
  getProvincesWithFields,
  getDistrictsWithFields,
};
