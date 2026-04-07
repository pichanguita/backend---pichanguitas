const pool = require('../config/db');

/**
 * Obtener todas las insignias con filtros (incluye tiers)
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de insignias con sus tiers
 */
const getAllBadges = async (filters = {}) => {
  let query = `
    SELECT
      b.id,
      b.name,
      b.icon,
      b.description,
      b.criteria_type,
      b.is_active,
      b.status,
      b.user_id_registration,
      b.date_time_registration,
      b.user_id_modification,
      b.date_time_modification
    FROM badges b
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por estado activo
  if (filters.is_active !== undefined) {
    query += ` AND b.is_active = $${paramCount}`;
    params.push(filters.is_active);
    paramCount++;
  }

  // Filtro por status
  if (filters.status) {
    query += ` AND b.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por tipo de criterio
  if (filters.criteria_type) {
    query += ` AND b.criteria_type = $${paramCount}`;
    params.push(filters.criteria_type);
    paramCount++;
  }

  // Búsqueda por nombre
  if (filters.search) {
    query += ` AND b.name ILIKE $${paramCount}`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` ORDER BY b.name ASC`;

  const result = await pool.query(query, params);
  const badges = result.rows;

  // Obtener tiers para cada badge
  for (const badge of badges) {
    const tiersResult = await pool.query(
      `SELECT id, tier, icon, label, required_value as "requiredValue", reward_hours as "rewardHours", color
       FROM badge_tiers
       WHERE badge_id = $1
       ORDER BY required_value ASC`,
      [badge.id]
    );
    badge.tiers = tiersResult.rows;
    // Transformar campos para frontend
    badge.criteriaType = badge.criteria_type;
    badge.isActive = badge.is_active;
  }

  return badges;
};

/**
 * Obtener una insignia por ID
 * @param {number} id - ID de la insignia
 * @returns {Promise<Object|null>} Insignia o null
 */
const getBadgeById = async id => {
  const query = `SELECT * FROM badges WHERE id = $1`;
  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Crear una nueva insignia con sus tiers
 * @param {Object} badgeData - Datos de la insignia
 * @returns {Promise<Object>} Insignia creada con tiers
 */
const createBadge = async badgeData => {
  const {
    name,
    icon,
    description,
    criteria_type,
    criteria_id,
    is_active = true,
    status = 'active',
    user_id_registration,
    tiers = [],
  } = badgeData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Obtener criteria_id si no viene pero sí viene criteria_type
    let finalCriteriaId = criteria_id;
    if (!finalCriteriaId && criteria_type) {
      const criteriaResult = await client.query('SELECT id FROM badge_criteria WHERE code = $1', [
        criteria_type,
      ]);
      if (criteriaResult.rows.length > 0) {
        finalCriteriaId = criteriaResult.rows[0].id;
      }
    }

    // 1. Crear la insignia
    const badgeQuery = `
      INSERT INTO badges (
        name,
        icon,
        description,
        criteria_type,
        criteria_id,
        is_active,
        status,
        user_id_registration,
        date_time_registration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const badgeResult = await client.query(badgeQuery, [
      name,
      icon,
      description,
      criteria_type,
      finalCriteriaId,
      is_active,
      status,
      user_id_registration,
    ]);

    const newBadge = badgeResult.rows[0];

    // 2. Crear los tiers si existen
    const createdTiers = [];
    if (tiers && tiers.length > 0) {
      for (const tier of tiers) {
        const tierQuery = `
          INSERT INTO badge_tiers (
            badge_id,
            tier,
            icon,
            label,
            required_value,
            reward_hours,
            color,
            user_id_registration,
            date_time_registration
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          RETURNING *
        `;

        const tierResult = await client.query(tierQuery, [
          newBadge.id,
          tier.tier,
          tier.icon,
          tier.label,
          tier.requiredValue || tier.required_value,
          tier.rewardHours || tier.reward_hours || 0,
          tier.color,
          user_id_registration,
        ]);

        createdTiers.push(tierResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    return { ...newBadge, tiers: createdTiers };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Actualizar una insignia con sus tiers
 * @param {number} id - ID de la insignia
 * @param {Object} badgeData - Datos a actualizar
 * @returns {Promise<Object|null>} Insignia actualizada o null
 */
const updateBadge = async (id, badgeData) => {
  const {
    name,
    icon,
    description,
    criteria_type,
    criteria_id,
    is_active,
    status,
    user_id_modification,
    tiers,
  } = badgeData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Obtener criteria_id si no viene pero sí viene criteria_type
    let finalCriteriaId = criteria_id;
    if (!finalCriteriaId && criteria_type) {
      const criteriaResult = await client.query('SELECT id FROM badge_criteria WHERE code = $1', [
        criteria_type,
      ]);
      if (criteriaResult.rows.length > 0) {
        finalCriteriaId = criteriaResult.rows[0].id;
      }
    }

    // 1. Actualizar la insignia
    const badgeQuery = `
      UPDATE badges
      SET name = COALESCE($1, name),
          icon = COALESCE($2, icon),
          description = COALESCE($3, description),
          criteria_type = COALESCE($4, criteria_type),
          criteria_id = COALESCE($5, criteria_id),
          is_active = COALESCE($6, is_active),
          status = COALESCE($7, status),
          user_id_modification = $8,
          date_time_modification = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;

    const badgeResult = await client.query(badgeQuery, [
      name,
      icon,
      description,
      criteria_type,
      finalCriteriaId,
      is_active,
      status,
      user_id_modification,
      id,
    ]);

    if (badgeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const updatedBadge = badgeResult.rows[0];

    // 2. Actualizar tiers si se proporcionan
    let updatedTiers = [];
    if (tiers && Array.isArray(tiers) && tiers.length > 0) {
      // Eliminar tiers existentes
      await client.query('DELETE FROM badge_tiers WHERE badge_id = $1', [id]);

      // Insertar nuevos tiers
      for (const tier of tiers) {
        const tierQuery = `
          INSERT INTO badge_tiers (
            badge_id,
            tier,
            icon,
            label,
            required_value,
            reward_hours,
            color,
            user_id_registration,
            date_time_registration
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          RETURNING *
        `;

        const tierResult = await client.query(tierQuery, [
          id,
          tier.tier,
          tier.icon,
          tier.label,
          tier.requiredValue || tier.required_value,
          tier.rewardHours || tier.reward_hours || 0,
          tier.color,
          user_id_modification,
        ]);

        updatedTiers.push(tierResult.rows[0]);
      }
    } else {
      // Si no se proporcionan tiers, obtener los existentes
      const existingTiersResult = await client.query(
        `SELECT id, tier, icon, label, required_value as "requiredValue", reward_hours as "rewardHours", color
         FROM badge_tiers WHERE badge_id = $1 ORDER BY required_value ASC`,
        [id]
      );
      updatedTiers = existingTiersResult.rows;
    }

    await client.query('COMMIT');

    return { ...updatedBadge, tiers: updatedTiers };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Eliminar una insignia (soft delete)
 * @param {number} id - ID de la insignia
 * @param {number} user_id_modification - ID del usuario
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteBadge = async (id, user_id_modification) => {
  const query = `
    UPDATE badges
    SET is_active = false,
        status = 'inactive',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0;
};

/**
 * Verificar si un nombre de insignia ya existe
 * @param {string} name - Nombre de la insignia
 * @param {number|null} excludeId - ID a excluir de la búsqueda
 * @returns {Promise<boolean>} True si existe
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
 * Obtener insignias de un cliente
 * @param {number} customer_id - ID del cliente
 * @returns {Promise<Array>} Lista de insignias del cliente
 */
const getCustomerBadges = async customer_id => {
  const query = `
    SELECT
      cb.id,
      cb.customer_id,
      cb.badge_id,
      cb.tier,
      cb.unlocked_at,
      cb.auto_assigned,
      b.name AS badge_name,
      b.icon AS badge_icon,
      b.description AS badge_description,
      b.criteria_type
    FROM customer_badges cb
    INNER JOIN badges b ON cb.badge_id = b.id
    WHERE cb.customer_id = $1
    ORDER BY cb.unlocked_at DESC
  `;

  const result = await pool.query(query, [customer_id]);
  return result.rows;
};

/**
 * Asignar insignia a un cliente
 * @param {Object} assignmentData - Datos de la asignación
 * @returns {Promise<Object>} Asignación creada
 */
const assignBadgeToCustomer = async assignmentData => {
  const {
    customer_id,
    badge_id,
    tier,
    auto_assigned = false,
    user_id_registration,
  } = assignmentData;

  const query = `
    INSERT INTO customer_badges (
      customer_id,
      badge_id,
      tier,
      unlocked_at,
      auto_assigned,
      user_id_registration,
      date_time_registration
    ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    customer_id,
    badge_id,
    tier,
    auto_assigned,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Verificar si un cliente ya tiene una insignia
 * @param {number} customer_id - ID del cliente
 * @param {number} badge_id - ID de la insignia
 * @returns {Promise<boolean>} True si ya la tiene
 */
const customerHasBadge = async (customer_id, badge_id) => {
  const query = `
    SELECT id FROM customer_badges
    WHERE customer_id = $1 AND badge_id = $2
  `;

  const result = await pool.query(query, [customer_id, badge_id]);
  return result.rows.length > 0;
};

/**
 * Eliminar insignia de un cliente
 * @param {number} id - ID de la asignación
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const removeCustomerBadge = async id => {
  const query = `
    DELETE FROM customer_badges
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Obtener estadísticas de insignias
 * @returns {Promise<Object>} Estadísticas
 */
const getBadgeStats = async () => {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM badges WHERE is_active = true) AS total_active_badges,
      (SELECT COUNT(*) FROM badges WHERE status = 'inactive') AS total_inactive_badges,
      (SELECT COUNT(*) FROM customer_badges) AS total_badges_awarded,
      (SELECT COUNT(DISTINCT customer_id) FROM customer_badges) AS customers_with_badges
  `;

  const result = await pool.query(query);
  return result.rows[0];
};

/**
 * Obtener leaderboard de clientes con más insignias
 * @param {number} limit - Límite de resultados (default 10)
 * @returns {Promise<Array>} Lista de clientes con sus insignias
 */
const getLeaderboard = async (limit = 10) => {
  const query = `
    SELECT
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
    LIMIT $1
  `;

  const result = await pool.query(query, [limit]);
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
