const pool = require('../config/db');

/**
 * Obtener todos los criterios de insignias
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de criterios
 */
const getAllCriteria = async (filters = {}) => {
  let query = `
    SELECT
      id,
      code,
      name,
      description,
      calculation_table,
      calculation_field,
      calculation_type,
      filter_conditions,
      is_active,
      date_time_registration
    FROM badge_criteria
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  if (filters.is_active !== undefined) {
    query += ` AND is_active = $${paramCount}`;
    params.push(filters.is_active);
    paramCount++;
  }

  query += ` ORDER BY name ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un criterio por ID
 * @param {number} id - ID del criterio
 * @returns {Promise<Object|null>}
 */
const getCriteriaById = async id => {
  const query = `SELECT * FROM badge_criteria WHERE id = $1`;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

/**
 * Obtener un criterio por código
 * @param {string} code - Código del criterio
 * @returns {Promise<Object|null>}
 */
const getCriteriaByCode = async code => {
  const query = `SELECT * FROM badge_criteria WHERE code = $1`;
  const result = await pool.query(query, [code]);
  return result.rows[0] || null;
};

/**
 * Calcular el valor de un criterio para un cliente
 * @param {number} customerId - ID del cliente
 * @param {Object} criteria - Objeto del criterio
 * @returns {Promise<number>} Valor calculado
 */
const calculateCriteriaValue = async (customerId, criteria) => {
  const { calculation_table, calculation_field, calculation_type, filter_conditions } = criteria;

  let query = '';
  const params = [customerId];
  let paramCount = 2;

  // Construir query según el tipo de cálculo
  switch (calculation_type) {
    case 'count':
      query = `SELECT COUNT(*) as value FROM ${calculation_table} WHERE customer_id = $1`;
      break;

    case 'sum':
      query = `SELECT COALESCE(SUM(${calculation_field}), 0) as value FROM ${calculation_table} WHERE customer_id = $1`;
      break;

    case 'max':
      query = `SELECT COALESCE(MAX(${calculation_field}), 0) as value FROM ${calculation_table} WHERE customer_id = $1`;
      break;

    case 'value':
      // Obtener valor directo de un campo (ej: total_spent de customers)
      query = `SELECT COALESCE(${calculation_field}, 0) as value FROM ${calculation_table} WHERE id = $1`;
      break;

    case 'count_grouped':
      // Para fidelidad a cancha: cuenta máxima en una sola cancha
      query = `
        SELECT COALESCE(MAX(cnt), 0) as value
        FROM (
          SELECT ${calculation_field}, COUNT(*) as cnt
          FROM ${calculation_table}
          WHERE customer_id = $1
          GROUP BY ${calculation_field}
        ) sub
      `;
      break;

    case 'streak':
      // Para semanas consecutivas (cálculo más complejo)
      query = `
        WITH weeks AS (
          SELECT DISTINCT DATE_TRUNC('week', date) as week_start
          FROM ${calculation_table}
          WHERE customer_id = $1
          AND status = 'completed'
          ORDER BY week_start DESC
        ),
        numbered AS (
          SELECT week_start,
                 ROW_NUMBER() OVER (ORDER BY week_start DESC) as rn
          FROM weeks
        ),
        streaks AS (
          SELECT week_start,
                 week_start + (rn * INTERVAL '7 days') as grp
          FROM numbered
        )
        SELECT COALESCE(MAX(streak_count), 0) as value
        FROM (
          SELECT grp, COUNT(*) as streak_count
          FROM streaks
          GROUP BY grp
        ) sub
      `;
      break;

    default:
      query = `SELECT COUNT(*) as value FROM ${calculation_table} WHERE customer_id = $1`;
  }

  // Agregar condiciones de filtro
  if (filter_conditions) {
    const conditions =
      typeof filter_conditions === 'string' ? JSON.parse(filter_conditions) : filter_conditions;

    if (conditions.status) {
      query = query.replace(
        'WHERE customer_id = $1',
        `WHERE customer_id = $1 AND status = $${paramCount}`
      );
      params.push(conditions.status);
      paramCount++;
    }

    if (conditions.time_before) {
      query = query.replace(
        'WHERE customer_id = $1',
        `WHERE customer_id = $1 AND start_time < $${paramCount}::time`
      );
      params.push(conditions.time_before);
      paramCount++;
    }

    if (conditions.time_after) {
      query = query.replace(
        'WHERE customer_id = $1',
        `WHERE customer_id = $1 AND start_time >= $${paramCount}::time`
      );
      params.push(conditions.time_after);
      paramCount++;
    }
  }

  try {
    const result = await pool.query(query, params);
    return parseFloat(result.rows[0]?.value || 0);
  } catch (error) {
    console.error('Error calculando criterio:', error);
    return 0;
  }
};

/**
 * Calcular todos los criterios para un cliente
 * @param {number} customerId - ID del cliente
 * @returns {Promise<Object>} Objeto con valores de cada criterio
 */
const calculateAllCriteriaForCustomer = async customerId => {
  const criteria = await getAllCriteria({ is_active: true });
  const results = {};

  for (const crit of criteria) {
    results[crit.code] = await calculateCriteriaValue(customerId, crit);
  }

  return results;
};

module.exports = {
  getAllCriteria,
  getCriteriaById,
  getCriteriaByCode,
  calculateCriteriaValue,
  calculateAllCriteriaForCustomer,
};
