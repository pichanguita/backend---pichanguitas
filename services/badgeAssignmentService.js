const pool = require('../config/db');
const { calculateCriteriaValue } = require('../models/badgeCriteriaModel');

/**
 * Verificar si el sistema de gamificación admite asignación automática
 * Lee gamification_config: requiere is_active='true' y auto_assign='true'
 * @returns {Promise<boolean>}
 */
const isAutoAssignEnabled = async () => {
  const result = await pool.query(
    `SELECT config_key, config_value FROM gamification_config
     WHERE config_key IN ('is_active', 'auto_assign')`
  );
  const flags = result.rows.reduce((acc, row) => {
    acc[row.config_key] = row.config_value === 'true';
    return acc;
  }, {});
  return flags.is_active !== false && flags.auto_assign !== false;
};

/**
 * Verificar y asignar insignias automáticamente a un cliente
 * @param {number} customerId - ID del cliente
 * @param {number} userId - ID del usuario que ejecuta (para auditoría)
 * @returns {Promise<Array>} Lista de insignias nuevas asignadas
 */
const checkAndAssignBadges = async (customerId, userId = 1) => {
  const newlyAssigned = [];

  try {
    // 0. Si el sistema está pausado o auto_assign desactivado, no hacer nada
    const enabled = await isAutoAssignEnabled();
    if (!enabled) {
      console.log(
        `⏸️  Sistema de gamificación pausado: no se asignarán insignias al cliente ${customerId}`
      );
      return newlyAssigned;
    }

    // 1. Obtener todas las insignias activas con sus criterios y tiers
    const badgesQuery = `
      SELECT
        b.id as badge_id,
        b.name as badge_name,
        b.icon as badge_icon,
        b.criteria_id,
        bc.code as criteria_code,
        bc.calculation_table,
        bc.calculation_field,
        bc.calculation_type,
        bc.filter_conditions,
        bt.id as tier_id,
        bt.tier,
        bt.label as tier_label,
        bt.icon as tier_icon,
        bt.required_value,
        bt.color as tier_color
      FROM badges b
      INNER JOIN badge_criteria bc ON b.criteria_id = bc.id
      INNER JOIN badge_tiers bt ON bt.badge_id = b.id
      WHERE b.is_active = true AND bc.is_active = true
      ORDER BY b.id, bt.required_value ASC
    `;

    const badgesResult = await pool.query(badgesQuery);

    if (badgesResult.rows.length === 0) {
      console.log('No hay insignias configuradas con criterios');
      return newlyAssigned;
    }

    // 2. Obtener insignias que ya tiene el cliente
    const existingBadgesQuery = `
      SELECT badge_id, tier FROM customer_badges WHERE customer_id = $1
    `;
    const existingResult = await pool.query(existingBadgesQuery, [customerId]);
    const existingBadges = new Set(existingResult.rows.map(row => `${row.badge_id}-${row.tier}`));

    // 3. Agrupar badges por criterio para calcular solo una vez por criterio
    const criteriaValues = {};
    const badgesByCriteria = {};

    for (const row of badgesResult.rows) {
      if (!criteriaValues[row.criteria_code]) {
        // Calcular valor solo una vez por criterio
        criteriaValues[row.criteria_code] = await calculateCriteriaValue(customerId, {
          calculation_table: row.calculation_table,
          calculation_field: row.calculation_field,
          calculation_type: row.calculation_type,
          filter_conditions: row.filter_conditions,
        });
      }

      if (!badgesByCriteria[row.badge_id]) {
        badgesByCriteria[row.badge_id] = {
          badge_id: row.badge_id,
          badge_name: row.badge_name,
          badge_icon: row.badge_icon,
          criteria_code: row.criteria_code,
          tiers: [],
        };
      }

      badgesByCriteria[row.badge_id].tiers.push({
        tier_id: row.tier_id,
        tier: row.tier,
        tier_label: row.tier_label,
        tier_icon: row.tier_icon,
        required_value: parseFloat(row.required_value),
        tier_color: row.tier_color,
      });
    }

    // 4. Verificar cada badge y tier
    for (const badge of Object.values(badgesByCriteria)) {
      const currentValue = criteriaValues[badge.criteria_code] || 0;

      for (const tier of badge.tiers) {
        const key = `${badge.badge_id}-${tier.tier}`;

        // Si ya tiene esta insignia en este tier, saltar
        if (existingBadges.has(key)) continue;

        // Si cumple el requisito, asignar
        if (currentValue >= tier.required_value) {
          const insertQuery = `
            INSERT INTO customer_badges (
              customer_id, badge_id, tier, unlocked_at, auto_assigned,
              user_id_registration, date_time_registration
            ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, true, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (customer_id, badge_id, tier) DO NOTHING
            RETURNING *
          `;

          const insertResult = await pool.query(insertQuery, [
            customerId,
            badge.badge_id,
            tier.tier,
            userId,
          ]);

          if (insertResult.rows.length > 0) {
            newlyAssigned.push({
              badgeId: badge.badge_id,
              badgeName: badge.badge_name,
              badgeIcon: badge.badge_icon,
              tier: tier.tier,
              tierLabel: tier.tier_label,
              tierIcon: tier.tier_icon,
              tierColor: tier.tier_color,
              unlockedAt: insertResult.rows[0].unlocked_at,
              autoAssigned: true,
            });

            console.log(
              `🏆 Insignia asignada: ${badge.badge_name} (${tier.tier_label}) a cliente ${customerId}`
            );
          }
        }
      }
    }

    return newlyAssigned;
  } catch (error) {
    console.error('Error verificando/asignando insignias:', error);
    return newlyAssigned;
  }
};

/**
 * Obtener progreso de insignias para un cliente
 * @param {number} customerId - ID del cliente
 * @returns {Promise<Array>} Progreso de cada insignia
 */
const getBadgeProgress = async customerId => {
  const progress = [];

  try {
    // Obtener todas las insignias con criterios
    const badgesQuery = `
      SELECT
        b.id as badge_id,
        b.name as badge_name,
        b.icon as badge_icon,
        b.description,
        bc.code as criteria_code,
        bc.name as criteria_name,
        bc.calculation_table,
        bc.calculation_field,
        bc.calculation_type,
        bc.filter_conditions,
        bt.tier,
        bt.label as tier_label,
        bt.icon as tier_icon,
        bt.required_value,
        bt.color as tier_color
      FROM badges b
      INNER JOIN badge_criteria bc ON b.criteria_id = bc.id
      INNER JOIN badge_tiers bt ON bt.badge_id = b.id
      WHERE b.is_active = true
      ORDER BY b.id, bt.required_value ASC
    `;

    const badgesResult = await pool.query(badgesQuery);

    // Obtener insignias que ya tiene el cliente
    const existingQuery = `
      SELECT badge_id, tier FROM customer_badges WHERE customer_id = $1
    `;
    const existingResult = await pool.query(existingQuery, [customerId]);
    const existingBadges = new Set(existingResult.rows.map(row => `${row.badge_id}-${row.tier}`));

    // Calcular valores de criterios
    const criteriaValues = {};
    for (const row of badgesResult.rows) {
      if (!criteriaValues[row.criteria_code]) {
        criteriaValues[row.criteria_code] = await calculateCriteriaValue(customerId, {
          calculation_table: row.calculation_table,
          calculation_field: row.calculation_field,
          calculation_type: row.calculation_type,
          filter_conditions: row.filter_conditions,
        });
      }
    }

    // Agrupar por badge
    const badgesMap = {};
    for (const row of badgesResult.rows) {
      if (!badgesMap[row.badge_id]) {
        badgesMap[row.badge_id] = {
          badge_id: row.badge_id,
          badge_name: row.badge_name,
          badge_icon: row.badge_icon,
          description: row.description,
          criteria_name: row.criteria_name,
          current_value: criteriaValues[row.criteria_code] || 0,
          tiers: [],
        };
      }

      const isUnlocked = existingBadges.has(`${row.badge_id}-${row.tier}`);
      const requiredValue = parseFloat(row.required_value);
      const currentValue = criteriaValues[row.criteria_code] || 0;

      badgesMap[row.badge_id].tiers.push({
        tier: row.tier,
        tier_label: row.tier_label,
        tier_icon: row.tier_icon,
        tier_color: row.tier_color,
        required_value: requiredValue,
        is_unlocked: isUnlocked,
        percentage: Math.min((currentValue / requiredValue) * 100, 100),
        remaining: Math.max(requiredValue - currentValue, 0),
      });
    }

    return Object.values(badgesMap);
  } catch (error) {
    console.error('Error obteniendo progreso de insignias:', error);
    return progress;
  }
};

module.exports = {
  checkAndAssignBadges,
  getBadgeProgress,
};
