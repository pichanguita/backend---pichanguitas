const {
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
} = require('../models/promotionRulesModel');
const pool = require('../config/db');

/**
 * Obtener todas las reglas de promoción con filtros
 */
const getPromotionRules = async (req, res) => {
  try {
    const filters = {
      is_active:
        req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      status: req.query.status,
      applies_to: req.query.applies_to,
      search: req.query.search,
    };

    const rules = await getAllPromotionRules(filters);

    res.json({
      success: true,
      data: rules,
      count: rules.length,
    });
  } catch (error) {
    console.error('Error al obtener reglas de promoción:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reglas de promoción',
    });
  }
};

/**
 * Obtener una regla de promoción por ID
 */
const getPromotionRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await getPromotionRuleById(id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Regla de promoción no encontrada',
      });
    }

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Error al obtener regla de promoción:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener regla de promoción',
    });
  }
};

/**
 * Obtener reglas de promoción activas
 */
const getActiveRules = async (req, res) => {
  try {
    const rules = await getActivePromotionRules();

    res.json({
      success: true,
      data: rules,
      count: rules.length,
    });
  } catch (error) {
    console.error('Error al obtener reglas activas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reglas activas',
    });
  }
};

/**
 * Obtener regla aplicable para horas específicas
 */
const getApplicableRule = async (req, res) => {
  try {
    const { hours, applies_to } = req.query;

    if (!hours) {
      return res.status(400).json({
        success: false,
        error: 'El número de horas es requerido',
      });
    }

    const parsedHours = parseFloat(hours);
    if (parsedHours <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El número de horas debe ser mayor a 0',
      });
    }

    const rule = await getApplicablePromotionRule(parsedHours, applies_to || 'all');

    if (!rule) {
      return res.json({
        success: true,
        applicable: false,
        message: 'No hay regla de promoción aplicable para estas horas',
      });
    }

    res.json({
      success: true,
      applicable: true,
      data: rule,
    });
  } catch (error) {
    console.error('Error al obtener regla aplicable:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener regla aplicable',
    });
  }
};

/**
 * Crear una nueva regla de promoción
 */
const createNewPromotionRule = async (req, res) => {
  try {
    const {
      name,
      description,
      hours_required,
      free_hours,
      applies_to,
      is_active,
      status,
      specific_fields,
      specific_sports,
    } = req.body;

    // Validaciones básicas
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la regla es requerido',
      });
    }

    if (!hours_required || hours_required <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Las horas requeridas deben ser mayores a 0',
      });
    }

    if (!free_hours || free_hours <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Las horas gratis deben ser mayores a 0',
      });
    }

    if (!applies_to || !applies_to.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El tipo de aplicación es requerido (all, specific_fields, specific_sports)',
      });
    }

    // Validar applies_to
    const validAppliesTo = ['all', 'specific_fields', 'specific_sports'];
    if (!validAppliesTo.includes(applies_to.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `El tipo de aplicación debe ser uno de: ${validAppliesTo.join(', ')}`,
      });
    }

    // Validar que se seleccionen canchas cuando aplica a canchas específicas
    if (
      applies_to.toLowerCase() === 'specific_fields' &&
      (!specific_fields || specific_fields.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Debe seleccionar al menos una cancha cuando aplica a canchas específicas',
      });
    }

    // Validar que se seleccionen deportes cuando aplica a deportes específicos
    if (
      applies_to.toLowerCase() === 'specific_sports' &&
      (!specific_sports || specific_sports.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Debe seleccionar al menos un deporte cuando aplica a deportes específicos',
      });
    }

    // Verificar si el nombre ya existe
    const exists = await promotionRuleNameExists(name.trim());
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una regla de promoción con este nombre',
      });
    }

    // ========== VALIDACIÓN DE CONFLICTOS DE REGLAS ==========

    // 1. Verificar si ya existe una regla global activa (bloquea cualquier nueva regla)
    const globalRule = await checkGlobalRuleExists();
    if (globalRule) {
      return res.status(409).json({
        success: false,
        error: `Ya existe una regla activa "${globalRule.name}" que aplica a TODAS las canchas. No se pueden crear más reglas mientras esta esté activa. Desactívela primero.`,
        conflictType: 'global_exists',
      });
    }

    // 2. Si se intenta crear una regla "all", verificar que no haya NINGUNA regla activa
    if (applies_to.toLowerCase() === 'all') {
      const anyRuleCheck = await checkAnyActiveRuleExists();
      if (anyRuleCheck.hasConflict) {
        return res.status(409).json({
          success: false,
          error: anyRuleCheck.message,
          conflictType: anyRuleCheck.type,
          conflictingRules: anyRuleCheck.rules || null,
        });
      }
    }

    // 3. Validar que las canchas seleccionadas no tengan ya una regla activa
    if (applies_to.toLowerCase() === 'specific_fields' && specific_fields && specific_fields.length > 0) {
      const fieldsWithRules = await checkFieldsWithExistingRules(specific_fields);
      if (fieldsWithRules.length > 0) {
        const fieldNames = fieldsWithRules.map(f => `"${f.field_name}" (ya tiene la regla "${f.rule_name}")`).join(', ');
        return res.status(409).json({
          success: false,
          error: `Las siguientes canchas ya tienen una regla activa asignada: ${fieldNames}. Una cancha solo puede tener una regla vigente.`,
          conflictType: 'specific_fields',
          conflictingFields: fieldsWithRules,
        });
      }
    }

    const ruleData = {
      name: name.trim(),
      description: description?.trim(),
      hours_required,
      free_hours,
      applies_to: applies_to.toLowerCase(),
      is_active,
      created_by: req.user?.id || 1,
      status,
      user_id_registration: req.user?.id || 1,
      specific_fields: specific_fields || [],
      specific_sports: specific_sports || [],
    };

    const newRule = await createPromotionRule(ruleData);

    res.status(201).json({
      success: true,
      message: 'Regla de promoción creada exitosamente',
      data: newRule,
    });
  } catch (error) {
    console.error('Error al crear regla de promoción:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear regla de promoción',
    });
  }
};

/**
 * Actualizar una regla de promoción
 */
const updateExistingPromotionRule = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      hours_required,
      free_hours,
      applies_to,
      is_active,
      status,
      specific_fields,
      specific_sports,
    } = req.body;

    // Verificar si la regla existe
    const existingRule = await getPromotionRuleById(id);
    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: 'Regla de promoción no encontrada',
      });
    }

    // Validaciones
    if (hours_required !== undefined && hours_required <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Las horas requeridas deben ser mayores a 0',
      });
    }

    if (free_hours !== undefined && free_hours <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Las horas gratis deben ser mayores a 0',
      });
    }

    // Validar applies_to si se proporciona
    if (applies_to) {
      const validAppliesTo = ['all', 'specific_fields', 'specific_sports'];
      if (!validAppliesTo.includes(applies_to.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `El tipo de aplicación debe ser uno de: ${validAppliesTo.join(', ')}`,
        });
      }
    }

    // Si se actualiza el nombre, verificar que no exista
    if (name && name.trim() && name.trim().toLowerCase() !== existingRule.name.toLowerCase()) {
      const exists = await promotionRuleNameExists(name.trim(), id);
      if (exists) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe otra regla de promoción con este nombre',
        });
      }
    }

    // ========== VALIDACIÓN DE CONFLICTOS DE REGLAS ==========
    const effectiveAppliesTo = applies_to?.toLowerCase() || existingRule.applies_to;
    const effectiveIsActive = is_active !== undefined ? is_active : existingRule.is_active;

    // Solo validar conflictos si la regla estará activa
    if (effectiveIsActive) {
      // 1. Verificar si ya existe una regla global activa (excluyendo la actual)
      const globalRule = await checkGlobalRuleExists(id);
      if (globalRule) {
        return res.status(409).json({
          success: false,
          error: `Ya existe una regla activa "${globalRule.name}" que aplica a TODAS las canchas. No se pueden activar más reglas mientras esta esté activa. Desactívela primero.`,
          conflictType: 'global_exists',
        });
      }

      // 2. Si se cambia a "all", verificar que no haya NINGUNA otra regla activa
      if (effectiveAppliesTo === 'all') {
        const anyRuleCheck = await checkAnyActiveRuleExists(id);
        if (anyRuleCheck.hasConflict) {
          return res.status(409).json({
            success: false,
            error: anyRuleCheck.message,
            conflictType: anyRuleCheck.type,
            conflictingRules: anyRuleCheck.rules || null,
          });
        }
      }

      // 3. Validar que las canchas seleccionadas no tengan ya una regla activa (excluyendo la regla actual)
      if (effectiveAppliesTo === 'specific_fields' && specific_fields && specific_fields.length > 0) {
        const fieldsWithRules = await checkFieldsWithExistingRules(specific_fields, id);
        if (fieldsWithRules.length > 0) {
          const fieldNames = fieldsWithRules.map(f => `"${f.field_name}" (ya tiene la regla "${f.rule_name}")`).join(', ');
          return res.status(409).json({
            success: false,
            error: `Las siguientes canchas ya tienen una regla activa asignada: ${fieldNames}. Una cancha solo puede tener una regla vigente.`,
            conflictType: 'specific_fields',
            conflictingFields: fieldsWithRules,
          });
        }
      }
    }

    const ruleData = {
      name: name?.trim(),
      description: description?.trim(),
      hours_required,
      free_hours,
      applies_to: applies_to?.toLowerCase(),
      is_active,
      status,
      user_id_modification: req.user?.id || 1,
      specific_fields,
      specific_sports,
    };

    const updatedRule = await updatePromotionRule(id, ruleData);

    res.json({
      success: true,
      message: 'Regla de promoción actualizada exitosamente',
      data: updatedRule,
    });
  } catch (error) {
    console.error('Error al actualizar regla de promoción:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar regla de promoción',
    });
  }
};

/**
 * Eliminar una regla de promoción (soft delete)
 */
const deletePromotionRuleById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la regla existe
    const existingRule = await getPromotionRuleById(id);
    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: 'Regla de promoción no encontrada',
      });
    }

    const user_id = req.user?.id || 1;
    const deleted = await deletePromotionRule(id, user_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Regla de promoción eliminada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar la regla de promoción',
      });
    }
  } catch (error) {
    console.error('Error al eliminar regla de promoción:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar regla de promoción',
    });
  }
};

/**
 * Obtener estadísticas de reglas de promoción
 */
const getStats = async (req, res) => {
  try {
    const stats = await getPromotionRuleStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de reglas de promoción:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de reglas de promoción',
    });
  }
};

/**
 * Obtener promociones para el cliente autenticado
 * Endpoint: GET /api/promotion-rules/my-promotions
 */
const getMyPromotions = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    // Verificar si el usuario tiene un customer asociado
    const customerResult = await pool.query(
      'SELECT id FROM customers WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    // Si no hay customer asociado, retornar datos vacios (para admins u otros usuarios)
    if (customerResult.rows.length === 0) {
      // Obtener promociones activas sin progreso del cliente
      const activeRules = await getActivePromotionRules();

      // Obtener las canchas específicas para cada promoción
      const ruleIds = activeRules.map(r => r.id);
      const fieldsByRule = {};

      if (ruleIds.length > 0) {
        const fieldsResult = await pool.query(
          `
          SELECT
            prf.rule_id,
            f.id as field_id,
            f.name as field_name,
            f.departamento,
            f.provincia,
            f.distrito
          FROM promotion_rule_fields prf
          JOIN fields f ON prf.field_id = f.id
          WHERE prf.rule_id = ANY($1)
          ORDER BY f.name
        `,
          [ruleIds]
        );

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
            location: [row.distrito, row.provincia, row.departamento].filter(Boolean).join(', '),
          });
        });
      }

      return res.json({
        success: true,
        data: {
          customer: {
            totalHours: 0,
            availableFreeHours: 0,
            earnedFreeHours: 0,
            usedFreeHours: 0,
          },
          promotions: activeRules.map(rule => ({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            hoursRequired: rule.hours_required,
            freeHours: rule.free_hours,
            appliesTo: rule.applies_to,
            fields: fieldsByRule[rule.id] || [],
            progressPercent: 0,
            hoursUntilNext: rule.hours_required,
            canRedeem: false,
          })),
        },
      });
    }

    const promotionsData = await getCustomerPromotions(userId);

    res.json({
      success: true,
      data: promotionsData,
    });
  } catch (error) {
    console.error('Error al obtener promociones del cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener promociones',
    });
  }
};

/**
 * Canjear una promoción
 * Endpoint: POST /api/promotion-rules/redeem
 */
const redeemPromotionController = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { promotionRuleId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    if (!promotionRuleId) {
      return res.status(400).json({
        success: false,
        error: 'ID de promoción requerido',
      });
    }

    // Obtener customer_id del usuario
    const customerResult = await pool.query(
      'SELECT id FROM customers WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    const customerId = customerResult.rows[0].id;

    const result = await redeemPromotion(customerId, promotionRuleId, userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error al canjear promoción:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error al canjear promoción',
    });
  }
};

/**
 * Obtener historial de promociones canjeadas
 * Endpoint: GET /api/promotion-rules/my-history
 */
const getMyHistory = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    // Obtener customer_id del usuario
    const customerResult = await pool.query(
      'SELECT id FROM customers WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    // Si no hay customer asociado, retornar lista vacia (para admins u otros usuarios)
    if (customerResult.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
      });
    }

    const customerId = customerResult.rows[0].id;

    const history = await getRedemptionHistory(customerId);

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial de promociones',
    });
  }
};

/**
 * Obtener canchas que ya tienen reglas de promoción activas
 * Endpoint: GET /api/promotion-rules/fields-with-rules
 */
const getFieldsWithActiveRulesController = async (req, res) => {
  try {
    const { excludeRuleId } = req.query;

    const fieldsWithRules = await getFieldsWithActiveRules(excludeRuleId ? parseInt(excludeRuleId) : null);

    res.json({
      success: true,
      data: fieldsWithRules,
      count: fieldsWithRules.length,
    });
  } catch (error) {
    console.error('Error al obtener canchas con reglas activas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener canchas con reglas activas',
    });
  }
};

module.exports = {
  getPromotionRules,
  getPromotionRule,
  getActiveRules,
  getApplicableRule,
  createNewPromotionRule,
  updateExistingPromotionRule,
  deletePromotionRuleById,
  getStats,
  getMyPromotions,
  redeemPromotionController,
  getMyHistory,
  getFieldsWithActiveRulesController,
};
