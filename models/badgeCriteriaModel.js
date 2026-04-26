const pool = require('../config/db');

/**
 * Identificadores SQL permitidos: solo letras, números y guión bajo.
 * Bloquea inyección porque calculation_table/calculation_field/clave de filter_conditions
 * se interpolan textualmente (no se pueden parametrizar con $N).
 */
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const assertSafeIdentifier = (value, label) => {
  if (typeof value !== 'string' || !SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Identificador SQL inválido en ${label}: ${value}`);
  }
};

/**
 * Tipos de cálculo soportados. Cada handler devuelve { sql, params }.
 * - "count":         COUNT(*)
 * - "sum":           SUM(field)
 * - "max":           MAX(field)
 * - "value":         valor directo de un campo del registro principal
 *                    (calculation_table debe ser 'customers', WHERE id = customerId)
 * - "count_grouped": MAX de la cuenta agrupada por field
 *                    (ej. fidelidad a una cancha)
 * - "streak":        máxima racha de semanas consecutivas con actividad
 */
const buildBaseQuery = (criteria, customerId) => {
  const { calculation_table, calculation_field, calculation_type } = criteria;
  assertSafeIdentifier(calculation_table, 'calculation_table');
  assertSafeIdentifier(calculation_field, 'calculation_field');

  const params = [customerId];

  switch (calculation_type) {
    case 'count':
      return {
        sql: `SELECT COUNT(*)::int AS value FROM "${calculation_table}" WHERE "customer_id" = $1`,
        params,
        whereOwner: 'customer_id',
        nextParamIndex: 2,
      };

    case 'sum':
      return {
        sql: `SELECT COALESCE(SUM("${calculation_field}"), 0) AS value FROM "${calculation_table}" WHERE "customer_id" = $1`,
        params,
        whereOwner: 'customer_id',
        nextParamIndex: 2,
      };

    case 'max':
      return {
        sql: `SELECT COALESCE(MAX("${calculation_field}"), 0) AS value FROM "${calculation_table}" WHERE "customer_id" = $1`,
        params,
        whereOwner: 'customer_id',
        nextParamIndex: 2,
      };

    case 'value':
      // Campo directo del cliente: WHERE id = customerId, no admite filtros adicionales
      return {
        sql: `SELECT COALESCE("${calculation_field}", 0) AS value FROM "${calculation_table}" WHERE "id" = $1`,
        params,
        whereOwner: null,
        nextParamIndex: 2,
      };

    case 'count_grouped':
      return {
        sql: `
          SELECT COALESCE(MAX(cnt), 0) AS value
          FROM (
            SELECT "${calculation_field}", COUNT(*) AS cnt
            FROM "${calculation_table}"
            WHERE "customer_id" = $1
            GROUP BY "${calculation_field}"
          ) sub
        `,
        params,
        whereOwner: 'customer_id',
        nextParamIndex: 2,
      };

    case 'streak':
      // Racha máxima de semanas consecutivas con actividad
      return {
        sql: `
          WITH base AS (
            SELECT DISTINCT DATE_TRUNC('week', "${calculation_field}")::date AS week_start
            FROM "${calculation_table}"
            WHERE "customer_id" = $1
          ),
          numbered AS (
            SELECT week_start,
                   ROW_NUMBER() OVER (ORDER BY week_start) AS rn
            FROM base
          ),
          grouped AS (
            SELECT week_start - (rn * INTERVAL '7 days') AS grp
            FROM numbered
          )
          SELECT COALESCE(MAX(streak_count), 0) AS value
          FROM (
            SELECT grp, COUNT(*) AS streak_count
            FROM grouped
            GROUP BY grp
          ) sub
        `,
        params,
        whereOwner: 'customer_id',
        nextParamIndex: 2,
      };

    default:
      throw new Error(`calculation_type no soportado: ${calculation_type}`);
  }
};

/**
 * Aplica filter_conditions de forma dinámica al WHERE base.
 * - Si whereOwner es null, los filtros no aplican (calculation_type='value').
 * - Cada clave del JSON se traduce a `"col" OP $N`.
 *   - { col: valor }                → col = valor
 *   - { col: [v1, v2] }             → col IN (v1, v2)
 *   - { col: { op: '<', value: x } } → col <  x   (operadores soportados: =, <>, <, <=, >, >=)
 *   - Sufijos especiales:
 *     - col_before: x → col <  x (cast a time si parece time)
 *     - col_after:  x → col >= x
 */
const SUPPORTED_OPS = new Set(['=', '<>', '!=', '<', '<=', '>', '>=']);
const TIME_SUFFIXES = { _before: '<', _after: '>=' };

const looksLikeTime = (value) =>
  typeof value === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(value);

const applyFilters = (base, filterConditions) => {
  if (!base.whereOwner || !filterConditions) return base;

  const conditions =
    typeof filterConditions === 'string' ? JSON.parse(filterConditions) : filterConditions;
  if (!conditions || typeof conditions !== 'object') return base;

  let sql = base.sql;
  const params = [...base.params];
  let pIdx = base.nextParamIndex;
  const extraWhere = [];

  for (const [rawKey, rawValue] of Object.entries(conditions)) {
    if (rawValue === undefined || rawValue === null) continue;

    // Resolver columna real y operador a partir de sufijos especiales
    let column = rawKey;
    let operator = '=';
    let value = rawValue;
    let cast = '';

    for (const [suffix, op] of Object.entries(TIME_SUFFIXES)) {
      if (rawKey.endsWith(suffix)) {
        column = rawKey.slice(0, -suffix.length);
        operator = op;
        if (looksLikeTime(value)) cast = '::time';
        break;
      }
    }

    assertSafeIdentifier(column, `filter_conditions.${rawKey}`);

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const placeholders = value.map(() => `$${pIdx++}`).join(', ');
      extraWhere.push(`"${column}" IN (${placeholders})`);
      params.push(...value);
    } else if (typeof value === 'object') {
      const op = (value.op || '=').toString();
      if (!SUPPORTED_OPS.has(op)) {
        throw new Error(`Operador no soportado en filter_conditions.${rawKey}: ${op}`);
      }
      extraWhere.push(`"${column}" ${op} $${pIdx++}`);
      params.push(value.value);
    } else {
      extraWhere.push(`"${column}" ${operator} $${pIdx++}${cast}`);
      params.push(value);
    }
  }

  if (extraWhere.length > 0) {
    const target = `"customer_id" = $1`;
    sql = sql.replace(target, `${target} AND ${extraWhere.join(' AND ')}`);
  }

  return { sql, params, whereOwner: base.whereOwner, nextParamIndex: pIdx };
};

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
      unit,
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
 */
const getCriteriaById = async (id) => {
  const result = await pool.query(`SELECT * FROM badge_criteria WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

/**
 * Obtener un criterio por código
 */
const getCriteriaByCode = async (code) => {
  const result = await pool.query(`SELECT * FROM badge_criteria WHERE code = $1`, [code]);
  return result.rows[0] || null;
};

/**
 * Calcular el valor de un criterio para un cliente.
 * Cada criterio decide su lógica vía calculation_type/calculation_table/
 * calculation_field/filter_conditions almacenados en BD.
 *
 * @param {number} customerId - ID del cliente
 * @param {Object} criteria   - Registro de badge_criteria
 * @returns {Promise<number>} Valor calculado (0 si error o sin datos)
 */
const calculateCriteriaValue = async (customerId, criteria) => {
  try {
    const base = buildBaseQuery(criteria, customerId);
    const { sql, params } = applyFilters(base, criteria.filter_conditions);
    const result = await pool.query(sql, params);
    return parseFloat(result.rows[0]?.value ?? 0) || 0;
  } catch (error) {
    console.error(
      `Error calculando criterio ${criteria.code} para cliente ${customerId}:`,
      error.message
    );
    return 0;
  }
};

/**
 * Calcular todos los criterios para un cliente
 */
const calculateAllCriteriaForCustomer = async (customerId) => {
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
