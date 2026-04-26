const pool = require('../config/db');

/**
 * Hidrata un badge con sus campos calculados (camelCase) y carga sus tiers.
 * Mantiene una única fuente de verdad sobre el shape de respuesta.
 */
const hydrateBadge = (row) => ({
  ...row,
  isActive: row.is_active,
  criteriaId: row.criteria_id,
  criteriaCode: row.criteria_code ?? null,
  criteriaName: row.criteria_name ?? null,
  criteriaUnit: row.criteria_unit ?? null,
});

const loadTiersForBadge = async (badgeId) => {
  const result = await pool.query(
    `SELECT id, tier, icon, label, required_value AS "requiredValue", color
     FROM badge_tiers
     WHERE badge_id = $1
     ORDER BY required_value ASC`,
    [badgeId]
  );
  return result.rows;
};

const BADGE_BASE_SELECT = `
  SELECT
    b.id,
    b.name,
    b.icon,
    b.description,
    b.is_active,
    b.status,
    b.user_id_registration,
    b.date_time_registration,
    b.user_id_modification,
    b.date_time_modification,
    b.criteria_id,
    bc.code AS criteria_code,
    bc.name AS criteria_name,
    bc.unit AS criteria_unit
  FROM badges b
  INNER JOIN badge_criteria bc ON bc.id = b.criteria_id
`;

/**
 * Obtener todas las insignias con filtros (incluye tiers + criterio).
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
const getAllBadges = async (filters = {}) => {
  let query = `${BADGE_BASE_SELECT} WHERE 1=1`;
  const params = [];
  let paramCount = 1;

  if (filters.is_active !== undefined) {
    query += ` AND b.is_active = $${paramCount++}`;
    params.push(filters.is_active);
  }

  if (filters.status) {
    query += ` AND b.status = $${paramCount++}`;
    params.push(filters.status);
  } else {
    query += ` AND b.status <> 'inactive'`;
  }

  if (filters.criteria_id) {
    query += ` AND b.criteria_id = $${paramCount++}`;
    params.push(filters.criteria_id);
  }

  if (filters.criteria_code) {
    query += ` AND bc.code = $${paramCount++}`;
    params.push(filters.criteria_code);
  }

  if (filters.search) {
    query += ` AND b.name ILIKE $${paramCount++}`;
    params.push(`%${filters.search}%`);
  }

  query += ` ORDER BY b.name ASC`;

  const result = await pool.query(query, params);
  const badges = result.rows.map(hydrateBadge);

  for (const badge of badges) {
    badge.tiers = await loadTiersForBadge(badge.id);
  }

  return badges;
};

/**
 * Obtener una insignia por ID (incluye criterio + tiers)
 */
const getBadgeById = async (id) => {
  const result = await pool.query(`${BADGE_BASE_SELECT} WHERE b.id = $1`, [id]);
  if (result.rows.length === 0) return null;
  const badge = hydrateBadge(result.rows[0]);
  badge.tiers = await loadTiersForBadge(badge.id);
  return badge;
};

/**
 * Validar que el criterio referenciado existe y está activo.
 * @param {number} criteriaId
 * @param {import('pg').PoolClient} [client]
 */
const assertCriteriaExists = async (criteriaId, client) => {
  const runner = client || pool;
  const result = await runner.query(
    `SELECT id FROM badge_criteria WHERE id = $1 AND COALESCE(is_active, true) = true`,
    [criteriaId]
  );
  if (result.rows.length === 0) {
    const err = new Error('El criterio (criteria_id) no existe o está inactivo');
    err.code = 'INVALID_CRITERIA_ID';
    throw err;
  }
};

/**
 * Crear una nueva insignia con sus tiers
 * @param {Object} badgeData
 * @returns {Promise<Object>} Insignia creada (camelCase) + tiers
 */
const createBadge = async (badgeData) => {
  const {
    name,
    icon,
    description,
    criteria_id,
    is_active = true,
    status = 'active',
    user_id_registration,
    tiers = [],
  } = badgeData;

  if (!criteria_id) {
    const err = new Error('criteria_id es requerido');
    err.code = 'MISSING_CRITERIA_ID';
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertCriteriaExists(criteria_id, client);

    const badgeResult = await client.query(
      `INSERT INTO badges (
         name, icon, description, criteria_id, is_active, status,
         user_id_registration, date_time_registration
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING id`,
      [name, icon, description, criteria_id, is_active, status, user_id_registration]
    );

    const newBadgeId = badgeResult.rows[0].id;

    if (Array.isArray(tiers) && tiers.length > 0) {
      for (const tier of tiers) {
        await client.query(
          `INSERT INTO badge_tiers (
             badge_id, tier, icon, label, required_value, color,
             user_id_registration, date_time_registration
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
          [
            newBadgeId,
            tier.tier,
            tier.icon,
            tier.label,
            tier.requiredValue ?? tier.required_value,
            tier.color,
            user_id_registration,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return await getBadgeById(newBadgeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Actualizar una insignia con sus tiers
 */
const updateBadge = async (id, badgeData) => {
  const {
    name,
    icon,
    description,
    criteria_id,
    is_active,
    status,
    user_id_modification,
    tiers,
  } = badgeData;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (criteria_id !== undefined && criteria_id !== null) {
      await assertCriteriaExists(criteria_id, client);
    }

    const updateResult = await client.query(
      `UPDATE badges
         SET name        = COALESCE($1, name),
             icon        = COALESCE($2, icon),
             description = COALESCE($3, description),
             criteria_id = COALESCE($4, criteria_id),
             is_active   = COALESCE($5, is_active),
             status      = COALESCE($6, status),
             user_id_modification    = $7,
             date_time_modification  = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id`,
      [name, icon, description, criteria_id, is_active, status, user_id_modification, id]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    if (Array.isArray(tiers) && tiers.length > 0) {
      await client.query(`DELETE FROM badge_tiers WHERE badge_id = $1`, [id]);
      for (const tier of tiers) {
        await client.query(
          `INSERT INTO badge_tiers (
             badge_id, tier, icon, label, required_value, color,
             user_id_registration, date_time_registration
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
          [
            id,
            tier.tier,
            tier.icon,
            tier.label,
            tier.requiredValue ?? tier.required_value,
            tier.color,
            user_id_modification,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return await getBadgeById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Soft-delete de una insignia
 */
const deleteBadge = async (id, user_id_modification) => {
  const result = await pool.query(
    `UPDATE badges
        SET is_active = false,
            status = 'inactive',
            user_id_modification = $1,
            date_time_modification = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id`,
    [user_id_modification, id]
  );
  return result.rows.length > 0;
};

/**
 * Verificar si un nombre de insignia ya existe
 */
const badgeNameExists = async (name, excludeId = null) => {
  let query = `SELECT id FROM badges WHERE LOWER(name) = LOWER($1)`;
  const params = [name];
  if (excludeId) {
    query += ` AND id != $2`;
    params.push(excludeId);
  }
  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Obtener insignias de un cliente (con metadata del badge y de su criterio)
 */
const getCustomerBadges = async (customer_id) => {
  const result = await pool.query(
    `SELECT
        cb.id,
        cb.customer_id,
        cb.badge_id,
        cb.tier,
        cb.unlocked_at,
        cb.auto_assigned,
        b.name AS badge_name,
        b.icon AS badge_icon,
        b.description AS badge_description,
        bc.code AS criteria_code,
        bt.label AS tier_label,
        bt.icon AS tier_icon,
        bt.color AS tier_color,
        bt.required_value AS tier_required_value
       FROM customer_badges cb
       INNER JOIN badges b ON cb.badge_id = b.id
       INNER JOIN badge_criteria bc ON bc.id = b.criteria_id
       LEFT JOIN badge_tiers bt ON bt.badge_id = cb.badge_id AND bt.tier = cb.tier
      WHERE cb.customer_id = $1
      ORDER BY cb.unlocked_at DESC`,
    [customer_id]
  );
  return result.rows;
};

/**
 * Asignar insignia a un cliente (manual)
 */
const assignBadgeToCustomer = async (assignmentData) => {
  const {
    customer_id,
    badge_id,
    tier,
    auto_assigned = false,
    user_id_registration,
  } = assignmentData;

  const result = await pool.query(
    `INSERT INTO customer_badges (
        customer_id, badge_id, tier, unlocked_at, auto_assigned,
        user_id_registration, date_time_registration
     ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, CURRENT_TIMESTAMP)
     RETURNING *`,
    [customer_id, badge_id, tier, auto_assigned, user_id_registration]
  );
  return result.rows[0];
};

const customerHasBadge = async (customer_id, badge_id) => {
  const result = await pool.query(
    `SELECT id FROM customer_badges WHERE customer_id = $1 AND badge_id = $2`,
    [customer_id, badge_id]
  );
  return result.rows.length > 0;
};

const removeCustomerBadge = async (id) => {
  const result = await pool.query(
    `DELETE FROM customer_badges WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rows.length > 0;
};

const getBadgeStats = async () => {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM badges WHERE is_active = true) AS total_active_badges,
      (SELECT COUNT(*) FROM badges WHERE status = 'inactive') AS total_inactive_badges,
      (SELECT COUNT(*) FROM customer_badges) AS total_badges_awarded,
      (SELECT COUNT(DISTINCT customer_id) FROM customer_badges) AS customers_with_badges
  `);
  return result.rows[0];
};

const getLeaderboard = async (limit = 10) => {
  const result = await pool.query(
    `SELECT
        c.id,
        c.name,
        c.phone_number AS phone,
        c.email,
        COUNT(cb.id) AS badge_count,
        json_agg(
          json_build_object(
            'badge_id', cb.badge_id,
            'badge_name', b.name,
            'badge_icon', b.icon,
            'tier', cb.tier,
            'unlocked_at', cb.unlocked_at
          ) ORDER BY cb.unlocked_at DESC
        ) AS badges
      FROM customers c
      INNER JOIN customer_badges cb ON c.id = cb.customer_id
      INNER JOIN badges b ON cb.badge_id = b.id
      GROUP BY c.id, c.name, c.phone_number, c.email
      ORDER BY badge_count DESC, MAX(cb.unlocked_at) DESC
      LIMIT $1`,
    [limit]
  );
  return result.rows;
};

module.exports = {
  getAllBadges,
  getBadgeById,
  createBadge,
  updateBadge,
  deleteBadge,
  badgeNameExists,
  getCustomerBadges,
  assignBadgeToCustomer,
  customerHasBadge,
  removeCustomerBadge,
  getBadgeStats,
  getLeaderboard,
};
