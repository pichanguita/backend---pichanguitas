const pool = require('../config/db');

/**
 * Obtener todas las reglas de promoción con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de reglas de promoción
 */
const getAllPromotionRules = async (filters = {}) => {
  let query = `
    SELECT
      pr.id,
      pr.name,
      pr.description,
      pr.hours_required,
      pr.free_hours,
      pr.applies_to,
      pr.is_active,
      pr.created_by,
      pr.status,
      pr.user_id_registration,
      pr.date_time_registration,
      pr.user_id_modification,
      pr.date_time_modification,
      u.name AS created_by_name,
      COALESCE(
        (SELECT json_agg(prf.field_id)
         FROM promotion_rule_fields prf
         WHERE prf.rule_id = pr.id),
        '[]'
      ) AS specific_fields,
      COALESCE(
        (SELECT json_agg(st.name)
         FROM promotion_rule_sports prs
         JOIN sport_types st ON st.id = prs.sport_id
         WHERE prs.rule_id = pr.id),
        '[]'
      ) AS specific_sports
    FROM promotion_rules pr
    LEFT JOIN users u ON pr.created_by = u.id
    WHERE pr.status != 'inactive'
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por estado activo
  if (filters.is_active !== undefined) {
    query += ` AND pr.is_active = $${paramCount}`;
    params.push(filters.is_active);
    paramCount++;
  }

  // Filtro por status
  if (filters.status) {
    query += ` AND pr.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por applies_to
  if (filters.applies_to) {
    query += ` AND pr.applies_to = $${paramCount}`;
    params.push(filters.applies_to);
    paramCount++;
  }

  // Búsqueda por nombre
  if (filters.search) {
    query += ` AND pr.name ILIKE $${paramCount}`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` ORDER BY pr.is_active DESC, pr.hours_required ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener una regla de promoción por ID
 * @param {number} id - ID de la regla
 * @returns {Promise<Object|null>} Regla o null
 */
const getPromotionRuleById = async id => {
  const query = `
    SELECT
      pr.*,
      u.name AS created_by_name,
      COALESCE(
        (SELECT json_agg(prf.field_id)
         FROM promotion_rule_fields prf
         WHERE prf.rule_id = pr.id),
        '[]'
      ) AS specific_fields,
      COALESCE(
        (SELECT json_agg(st.name)
         FROM promotion_rule_sports prs
         JOIN sport_types st ON st.id = prs.sport_id
         WHERE prs.rule_id = pr.id),
        '[]'
      ) AS specific_sports
    FROM promotion_rules pr
    LEFT JOIN users u ON pr.created_by = u.id
    WHERE pr.id = $1 AND pr.status != 'inactive'
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener reglas de promoción activas
 * @returns {Promise<Array>} Lista de reglas activas
 */
const getActivePromotionRules = async () => {
  const query = `
    SELECT
      id,
      name,
      description,
      hours_required,
      free_hours,
      applies_to,
      is_active,
      status
    FROM promotion_rules
    WHERE is_active = true AND status = 'active'
    ORDER BY hours_required ASC
  `;

  const result = await pool.query(query);
  return result.rows;
};

/**
 * Crear una nueva regla de promoción
 * @param {Object} ruleData - Datos de la regla
 * @returns {Promise<Object>} Regla creada
 */
const createPromotionRule = async ruleData => {
  const {
    name,
    description,
    hours_required,
    free_hours,
    applies_to,
    is_active = true,
    created_by,
    status = 'active',
    user_id_registration,
    specific_fields = [],
    specific_sports = [],
  } = ruleData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insertar la regla principal
    const ruleQuery = `
      INSERT INTO promotion_rules (
        name,
        description,
        hours_required,
        free_hours,
        applies_to,
        is_active,
        created_by,
        status,
        user_id_registration,
        date_time_registration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const ruleResult = await client.query(ruleQuery, [
      name,
      description,
      hours_required,
      free_hours,
      applies_to,
      is_active,
      created_by,
      status,
      user_id_registration,
    ]);

    const newRule = ruleResult.rows[0];

    // Insertar canchas específicas si applies_to = 'specific_fields'
    if (applies_to === 'specific_fields' && specific_fields.length > 0) {
      for (const fieldId of specific_fields) {
        await client.query(
          `INSERT INTO promotion_rule_fields (rule_id, field_id, user_id_registration, date_time_registration)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [newRule.id, fieldId, user_id_registration]
        );
      }
    }

    // Insertar deportes específicos si applies_to = 'specific_sports'
    if (applies_to === 'specific_sports' && specific_sports.length > 0) {
      for (const sportName of specific_sports) {
        // Buscar el sport_id por nombre
        const sportResult = await client.query('SELECT id FROM sport_types WHERE name = $1', [
          sportName,
        ]);
        if (sportResult.rows.length > 0) {
          await client.query(
            `INSERT INTO promotion_rule_sports (rule_id, sport_id, user_id_registration, date_time_registration)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [newRule.id, sportResult.rows[0].id, user_id_registration]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Retornar la regla con los campos adicionales
    newRule.specific_fields = specific_fields;
    newRule.specific_sports = specific_sports;
    return newRule;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Actualizar una regla de promoción
 * @param {number} id - ID de la regla
 * @param {Object} ruleData - Datos a actualizar
 * @returns {Promise<Object|null>} Regla actualizada o null
 */
const updatePromotionRule = async (id, ruleData) => {
  const {
    name,
    description,
    hours_required,
    free_hours,
    applies_to,
    is_active,
    status,
    user_id_modification,
    specific_fields,
    specific_sports,
  } = ruleData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const query = `
      UPDATE promotion_rules
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          hours_required = COALESCE($3, hours_required),
          free_hours = COALESCE($4, free_hours),
          applies_to = COALESCE($5, applies_to),
          is_active = COALESCE($6, is_active),
          status = COALESCE($7, status),
          user_id_modification = $8,
          date_time_modification = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;

    const result = await client.query(query, [
      name,
      description,
      hours_required,
      free_hours,
      applies_to,
      is_active,
      status,
      user_id_modification,
      id,
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const updatedRule = result.rows[0];

    // Actualizar canchas específicas si se proporciona el array
    if (specific_fields !== undefined) {
      // Eliminar canchas existentes
      await client.query('DELETE FROM promotion_rule_fields WHERE rule_id = $1', [id]);

      // Insertar nuevas canchas si applies_to = 'specific_fields'
      if (applies_to === 'specific_fields' && specific_fields.length > 0) {
        for (const fieldId of specific_fields) {
          await client.query(
            `INSERT INTO promotion_rule_fields (rule_id, field_id, user_id_registration, date_time_registration)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [id, fieldId, user_id_modification]
          );
        }
      }
    }

    // Actualizar deportes específicos si se proporciona el array
    if (specific_sports !== undefined) {
      // Eliminar deportes existentes
      await client.query('DELETE FROM promotion_rule_sports WHERE rule_id = $1', [id]);

      // Insertar nuevos deportes si applies_to = 'specific_sports'
      if (applies_to === 'specific_sports' && specific_sports.length > 0) {
        for (const sportName of specific_sports) {
          // Buscar el sport_id por nombre
          const sportResult = await client.query('SELECT id FROM sport_types WHERE name = $1', [
            sportName,
          ]);
          if (sportResult.rows.length > 0) {
            await client.query(
              `INSERT INTO promotion_rule_sports (rule_id, sport_id, user_id_registration, date_time_registration)
               VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
              [id, sportResult.rows[0].id, user_id_modification]
            );
          }
        }
      }
    }

    await client.query('COMMIT');

    // Agregar campos al resultado
    updatedRule.specific_fields = specific_fields || [];
    updatedRule.specific_sports = specific_sports || [];
    return updatedRule;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Eliminar una regla de promoción (soft delete)
 * @param {number} id - ID de la regla
 * @param {number} user_id_modification - ID del usuario
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deletePromotionRule = async (id, user_id_modification) => {
  const query = `
    UPDATE promotion_rules
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
 * Verificar si un nombre de regla ya existe
 * @param {string} name - Nombre de la regla
 * @param {number|null} excludeId - ID a excluir de la búsqueda
 * @returns {Promise<boolean>} True si existe
 */
const promotionRuleNameExists = async (name, excludeId = null) => {
  let query = `SELECT id FROM promotion_rules WHERE LOWER(name) = LOWER($1)`;
  const params = [name];

  if (excludeId) {
    query += ` AND id != $2`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Obtener las canchas que ya tienen reglas de promoción activas
 * @param {number|null} excludeRuleId - ID de regla a excluir (para edición)
 * @returns {Promise<Array>} Lista de canchas con sus reglas activas asociadas
 */
const getFieldsWithActiveRules = async (excludeRuleId = null) => {
  let query = `
    SELECT
      prf.field_id,
      f.name as field_name,
      pr.id as rule_id,
      pr.name as rule_name
    FROM promotion_rule_fields prf
    JOIN promotion_rules pr ON prf.rule_id = pr.id
    JOIN fields f ON prf.field_id = f.id
    WHERE pr.is_active = true AND pr.status = 'active'
  `;

  const params = [];

  if (excludeRuleId) {
    query += ` AND pr.id != $1`;
    params.push(excludeRuleId);
  }

  query += ` ORDER BY f.name`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Verificar si alguna cancha ya tiene una regla activa asignada
 * @param {Array<number>} fieldIds - IDs de canchas a verificar
 * @param {number|null} excludeRuleId - ID de regla a excluir (para edición)
 * @returns {Promise<Array>} Lista de canchas que ya tienen regla activa
 */
const checkFieldsWithExistingRules = async (fieldIds, excludeRuleId = null) => {
  if (!fieldIds || fieldIds.length === 0) return [];

  let query = `
    SELECT
      prf.field_id,
      f.name as field_name,
      pr.id as rule_id,
      pr.name as rule_name
    FROM promotion_rule_fields prf
    JOIN promotion_rules pr ON prf.rule_id = pr.id
    JOIN fields f ON prf.field_id = f.id
    WHERE pr.is_active = true
      AND pr.status = 'active'
      AND prf.field_id = ANY($1)
  `;

  const params = [fieldIds];

  if (excludeRuleId) {
    query += ` AND pr.id != $2`;
    params.push(excludeRuleId);
  }

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Verificar si existe una regla activa que aplica a TODAS las canchas
 * @param {number|null} excludeRuleId - ID de regla a excluir (para edición)
 * @returns {Promise<Object|null>} Regla encontrada o null
 */
const checkGlobalRuleExists = async (excludeRuleId = null) => {
  let query = `
    SELECT id, name
    FROM promotion_rules
    WHERE is_active = true
      AND status = 'active'
      AND applies_to = 'all'
  `;

  const params = [];

  if (excludeRuleId) {
    query += ` AND id != $1`;
    params.push(excludeRuleId);
  }

  query += ` LIMIT 1`;

  const result = await pool.query(query, params);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Verificar si hay CUALQUIER regla activa configurada (global o específica)
 * Usado cuando se intenta crear una regla que aplica a todas las canchas
 * @param {number|null} excludeRuleId - ID de regla a excluir (para edición)
 * @returns {Promise<Object>} Objeto con información de conflictos
 */
const checkAnyActiveRuleExists = async (excludeRuleId = null) => {
  // Verificar si hay regla global
  const globalRule = await checkGlobalRuleExists(excludeRuleId);

  if (globalRule) {
    return {
      hasConflict: true,
      type: 'global',
      rule: globalRule,
      message: `Ya existe una regla "${globalRule.name}" que aplica a todas las canchas. No puede haber más de una regla activa cuando existe una regla global.`
    };
  }

  // Verificar si hay canchas con reglas específicas
  let query = `
    SELECT DISTINCT
      pr.id as rule_id,
      pr.name as rule_name,
      COUNT(prf.field_id) as field_count
    FROM promotion_rules pr
    JOIN promotion_rule_fields prf ON pr.id = prf.rule_id
    WHERE pr.is_active = true
      AND pr.status = 'active'
  `;

  const params = [];

  if (excludeRuleId) {
    query += ` AND pr.id != $1`;
    params.push(excludeRuleId);
  }

  query += ` GROUP BY pr.id, pr.name`;

  const result = await pool.query(query, params);

  if (result.rows.length > 0) {
    const ruleNames = result.rows.map(r => `"${r.rule_name}"`).join(', ');
    const totalFields = result.rows.reduce((sum, r) => sum + parseInt(r.field_count), 0);
    return {
      hasConflict: true,
      type: 'specific',
      rules: result.rows,
      message: `No se puede crear una regla para todas las canchas porque ya existen ${result.rows.length} regla(s) activa(s) con canchas específicas asignadas: ${ruleNames}. Primero desactive esas reglas.`
    };
  }

  return { hasConflict: false };
};

/**
 * Obtener regla aplicable para horas específicas
 * @param {number} hours - Horas a verificar
 * @param {string} applies_to - Tipo de aplicación (all, vip, regular)
 * @returns {Promise<Object|null>} Regla aplicable o null
 */
const getApplicablePromotionRule = async (hours, applies_to = 'all') => {
  const query = `
    SELECT * FROM promotion_rules
    WHERE is_active = true
      AND status = 'active'
      AND hours_required <= $1
      AND (applies_to = $2 OR applies_to = 'all')
    ORDER BY hours_required DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [hours, applies_to]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener estadísticas de reglas de promoción
 * @returns {Promise<Object>} Estadísticas
 */
const getPromotionRuleStats = async () => {
  const query = `
    SELECT
      COUNT(*) AS total_rules,
      COUNT(*) FILTER (WHERE is_active = true) AS active_rules,
      COUNT(*) FILTER (WHERE status = 'inactive') AS inactive_rules,
      AVG(hours_required) AS avg_hours_required,
      AVG(free_hours) AS avg_free_hours
    FROM promotion_rules
  `;

  const result = await pool.query(query);
  return result.rows[0];
};

/**
 * Obtener promociones para un cliente específico con su progreso
 * CALCULA LAS HORAS DINÁMICAMENTE desde las reservas completadas
 * - Promociones específicas: Solo cuenta horas de las canchas asignadas
 * - Promociones globales (all): Cuenta horas de todas las canchas
 * @param {number} userId - ID del usuario (cliente)
 * @returns {Promise<Object>} Promociones activas y progreso del cliente
 */
const getCustomerPromotions = async userId => {
  // Obtener datos del cliente basado en su user_id
  const customerQuery = `
    SELECT
      c.id,
      c.name,
      c.total_hours,
      c.earned_free_hours,
      c.used_free_hours,
      c.available_free_hours
    FROM customers c
    WHERE c.user_id = $1 AND c.status = 'active'
  `;

  const customerResult = await pool.query(customerQuery, [userId]);
  const customer = customerResult.rows[0] || null;

  if (!customer) {
    return { customer: null, promotions: [], history: [] };
  }

  // Obtener todas las reglas de promoción activas
  const rulesQuery = `
    SELECT
      id,
      name,
      description,
      hours_required,
      free_hours,
      applies_to,
      is_active
    FROM promotion_rules
    WHERE is_active = true AND status = 'active'
    ORDER BY hours_required ASC
  `;

  const rulesResult = await pool.query(rulesQuery);
  const rules = rulesResult.rows;

  // Obtener las canchas específicas para cada promoción con ubicación
  const fieldsQuery = `
    SELECT
      prf.rule_id,
      f.id as field_id,
      f.name as field_name,
      f.departamento,
      f.provincia,
      f.distrito,
      f.address
    FROM promotion_rule_fields prf
    JOIN fields f ON prf.field_id = f.id
    WHERE prf.rule_id = ANY($1)
    ORDER BY f.name
  `;

  const ruleIds = rules.map(r => r.id);
  const fieldsResult = ruleIds.length > 0 ? await pool.query(fieldsQuery, [ruleIds]) : { rows: [] };

  // Agrupar canchas por rule_id
  const fieldsByRule = {};
  fieldsResult.rows.forEach(row => {
    if (!fieldsByRule[row.rule_id]) {
      fieldsByRule[row.rule_id] = [];
    }
    fieldsByRule[row.rule_id].push({
      id: row.field_id,
      name: row.field_name,
      department: row.departamento,
      province: row.provincia,
      district: row.distrito,
      address: row.address,
      location: [row.distrito, row.provincia, row.departamento].filter(Boolean).join(', '),
    });
  });

  // Obtener TODAS las horas jugadas por el cliente (para promociones globales)
  const totalHoursQuery = `
    SELECT COALESCE(SUM(hours), 0) as total_hours
    FROM reservations
    WHERE customer_id = $1 AND status = 'completed'
  `;
  const totalHoursResult = await pool.query(totalHoursQuery, [customer.id]);
  const totalPlayedHours = parseFloat(totalHoursResult.rows[0]?.total_hours) || 0;

  // Obtener horas jugadas POR CANCHA para el cliente (para promociones específicas)
  const hoursByFieldQuery = `
    SELECT field_id, COALESCE(SUM(hours), 0) as hours
    FROM reservations
    WHERE customer_id = $1 AND status = 'completed'
    GROUP BY field_id
  `;
  const hoursByFieldResult = await pool.query(hoursByFieldQuery, [customer.id]);
  const hoursByField = {};
  hoursByFieldResult.rows.forEach(row => {
    hoursByField[row.field_id] = parseFloat(row.hours) || 0;
  });

  // Obtener canjes realizados por el cliente (para calcular horas consumidas por promoción)
  const redemptionsQuery = `
    SELECT
      cpr.promotion_rule_id,
      COUNT(*) as redemption_count,
      pr.hours_required
    FROM customer_promotion_redemptions cpr
    JOIN promotion_rules pr ON cpr.promotion_rule_id = pr.id
    WHERE cpr.customer_id = $1
    GROUP BY cpr.promotion_rule_id, pr.hours_required
  `;
  const redemptionsResult = await pool.query(redemptionsQuery, [customer.id]);
  const redemptionsByRule = {};
  redemptionsResult.rows.forEach(row => {
    redemptionsByRule[row.promotion_rule_id] = {
      count: parseInt(row.redemption_count) || 0,
      hoursConsumed: (parseInt(row.redemption_count) || 0) * (parseFloat(row.hours_required) || 0),
    };
  });

  // Calcular progreso para cada promoción
  const rulesWithProgress = rules.map(rule => {
    const hoursRequired = parseFloat(rule.hours_required);
    const associatedFields = fieldsByRule[rule.id] || [];
    const redemptionInfo = redemptionsByRule[rule.id] || { count: 0, hoursConsumed: 0 };

    // Calcular horas jugadas según el tipo de promoción
    let hoursPlayed = 0;

    if (rule.applies_to === 'all') {
      // Promoción global: cuenta TODAS las horas de todas las canchas
      hoursPlayed = totalPlayedHours;
    } else if (rule.applies_to === 'specific_fields' && associatedFields.length > 0) {
      // Promoción específica: solo cuenta horas de las canchas asignadas
      associatedFields.forEach(field => {
        hoursPlayed += hoursByField[field.id] || 0;
      });
    }

    // Horas disponibles = Jugadas - Consumidas en canjes anteriores
    const availableHours = Math.max(0, hoursPlayed - redemptionInfo.hoursConsumed);

    const progressPercent = Math.min(100, (availableHours / hoursRequired) * 100);
    const hoursUntilNext = Math.max(0, hoursRequired - availableHours);
    const canRedeem = availableHours >= hoursRequired;

    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      hoursRequired: hoursRequired,
      freeHours: parseFloat(rule.free_hours),
      appliesTo: rule.applies_to,
      fields: associatedFields,
      currentHours: Math.round(availableHours * 10) / 10,
      progressPercent: Math.round(progressPercent),
      hoursUntilNext: Math.round(hoursUntilNext * 10) / 10,
      canRedeem,
      timesRedeemed: redemptionInfo.count,
    };
  });

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      totalHours: parseFloat(customer.total_hours) || 0,
      earnedFreeHours: parseFloat(customer.earned_free_hours) || 0,
      usedFreeHours: parseFloat(customer.used_free_hours) || 0,
      availableFreeHours: parseFloat(customer.available_free_hours) || 0,
    },
    promotions: rulesWithProgress,
  };
};

/**
 * Canjear una promoción para un cliente
 * CALCULA LAS HORAS DINÁMICAMENTE desde las reservas completadas
 * - Promociones específicas: Solo valida horas de las canchas asignadas
 * - Promociones globales (all): Valida horas de todas las canchas
 * @param {number} customerId - ID del cliente
 * @param {number} promotionRuleId - ID de la regla de promoción
 * @param {number} userId - ID del usuario que registra
 * @returns {Promise<Object>} Resultado del canje
 */
const redeemPromotion = async (customerId, promotionRuleId, userId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar que la promoción existe y está activa (incluyendo applies_to)
    const promoResult = await client.query(
      'SELECT id, name, hours_required, free_hours, applies_to FROM promotion_rules WHERE id = $1 AND is_active = true AND status = $2',
      [promotionRuleId, 'active']
    );

    if (promoResult.rows.length === 0) {
      throw new Error('Promoción no encontrada o inactiva');
    }

    const promo = promoResult.rows[0];
    const hoursRequired = parseFloat(promo.hours_required);
    const freeHours = parseFloat(promo.free_hours);

    // Verificar que el cliente existe
    const customerResult = await client.query(
      'SELECT id FROM customers WHERE id = $1 AND status = $2',
      [customerId, 'active']
    );

    if (customerResult.rows.length === 0) {
      throw new Error('Cliente no encontrado');
    }

    // Calcular horas disponibles según el tipo de promoción
    let hoursPlayed = 0;

    if (promo.applies_to === 'all') {
      // Promoción global: cuenta TODAS las horas de todas las canchas
      const totalHoursResult = await client.query(
        `SELECT COALESCE(SUM(hours), 0) as total_hours
         FROM reservations
         WHERE customer_id = $1 AND status = 'completed'`,
        [customerId]
      );
      hoursPlayed = parseFloat(totalHoursResult.rows[0]?.total_hours) || 0;
    } else if (promo.applies_to === 'specific_fields') {
      // Promoción específica: solo cuenta horas de las canchas asignadas
      const fieldHoursResult = await client.query(
        `SELECT COALESCE(SUM(r.hours), 0) as total_hours
         FROM reservations r
         WHERE r.customer_id = $1
           AND r.status = 'completed'
           AND r.field_id IN (SELECT field_id FROM promotion_rule_fields WHERE rule_id = $2)`,
        [customerId, promotionRuleId]
      );
      hoursPlayed = parseFloat(fieldHoursResult.rows[0]?.total_hours) || 0;
    }

    // Calcular horas ya consumidas en canjes anteriores de ESTA promoción
    const redemptionsResult = await client.query(
      `SELECT COUNT(*) as redemption_count
       FROM customer_promotion_redemptions
       WHERE customer_id = $1 AND promotion_rule_id = $2`,
      [customerId, promotionRuleId]
    );
    const redemptionCount = parseInt(redemptionsResult.rows[0]?.redemption_count) || 0;
    const hoursConsumed = redemptionCount * hoursRequired;

    // Horas disponibles = Jugadas - Consumidas
    const availableHours = Math.max(0, hoursPlayed - hoursConsumed);

    if (availableHours < hoursRequired) {
      throw new Error(
        `Necesitas ${hoursRequired} horas para canjear esta promoción. Tienes ${availableHours.toFixed(1)} horas disponibles.`
      );
    }

    // Registrar el canje en historial
    await client.query(
      `INSERT INTO customer_promotion_redemptions (customer_id, promotion_rule_id, hours_earned, user_id_registration)
       VALUES ($1, $2, $3, $4)`,
      [customerId, promotionRuleId, freeHours, userId]
    );

    // Actualizar cliente: solo sumar horas gratis (ya NO modificamos accumulated_hours)
    await client.query(
      `UPDATE customers
       SET earned_free_hours = COALESCE(earned_free_hours, 0) + $1,
           available_free_hours = COALESCE(available_free_hours, 0) + $1
       WHERE id = $2`,
      [freeHours, customerId]
    );

    await client.query('COMMIT');

    return {
      success: true,
      promotionName: promo.name,
      hoursEarned: freeHours,
      hoursRemaining: availableHours - hoursRequired,
      message: `¡Has ganado ${freeHours} hora(s) gratis!`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Obtener historial de promociones canjeadas por un cliente
 * @param {number} customerId - ID del cliente
 * @returns {Promise<Array>} Historial de canjes
 */
const getRedemptionHistory = async customerId => {
  const query = `
    SELECT
      cpr.id,
      cpr.promotion_rule_id,
      cpr.hours_earned,
      cpr.redeemed_at,
      pr.name as promotion_name,
      pr.description as promotion_description,
      pr.hours_required
    FROM customer_promotion_redemptions cpr
    JOIN promotion_rules pr ON pr.id = cpr.promotion_rule_id
    WHERE cpr.customer_id = $1
    ORDER BY cpr.redeemed_at DESC
  `;

  const result = await pool.query(query, [customerId]);
  return result.rows;
};

module.exports = {
  getAllPromotionRules,
  getPromotionRuleById,
  getActivePromotionRules,
  createPromotionRule,
  updatePromotionRule,
  deletePromotionRule,
  promotionRuleNameExists,
  getApplicablePromotionRule,
  getPromotionRuleStats,
  getCustomerPromotions,
  redeemPromotion,
  getRedemptionHistory,
  getFieldsWithActiveRules,
  checkFieldsWithExistingRules,
  checkGlobalRuleExists,
  checkAnyActiveRuleExists,
};
