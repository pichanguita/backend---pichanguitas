const {
  getAllFieldRules,
  getFieldRuleById,
  getRulesByFieldId,
  createFieldRule,
  updateFieldRule,
  deleteFieldRule,
  createMultipleRules,
  deleteAllRulesByFieldId,
} = require('../models/fieldRulesModel');

/**
 * Obtener todas las reglas con filtros
 */
const getFieldRules = async (req, res) => {
  try {
    const filters = {
      field_id: req.query.field_id,
      search: req.query.search,
    };

    const rules = await getAllFieldRules(filters);

    res.json({
      success: true,
      data: rules,
      count: rules.length,
    });
  } catch (error) {
    console.error('Error al obtener reglas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reglas',
    });
  }
};

/**
 * Obtener una regla por ID
 */
const getFieldRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await getFieldRuleById(id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Regla no encontrada',
      });
    }

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Error al obtener regla:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener regla',
    });
  }
};

/**
 * Obtener reglas de una cancha específica
 */
const getRulesByField = async (req, res) => {
  try {
    const { field_id } = req.params;
    const rules = await getRulesByFieldId(field_id);

    res.json({
      success: true,
      data: rules,
      count: rules.length,
    });
  } catch (error) {
    console.error('Error al obtener reglas de la cancha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reglas de la cancha',
    });
  }
};

/**
 * Crear una nueva regla
 */
const createNewFieldRule = async (req, res) => {
  try {
    const { field_id, rule } = req.body;

    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!rule || !rule.trim()) {
      return res.status(400).json({
        success: false,
        error: 'La regla es requerida',
      });
    }

    const ruleData = {
      field_id,
      rule: rule.trim(),
      user_id_registration: req.user?.id || 1,
    };

    const newRule = await createFieldRule(ruleData);

    res.status(201).json({
      success: true,
      message: 'Regla creada exitosamente',
      data: newRule,
    });
  } catch (error) {
    console.error('Error al crear regla:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear regla',
    });
  }
};

/**
 * Crear múltiples reglas para una cancha
 */
const createMultipleFieldRules = async (req, res) => {
  try {
    const { field_id, rules } = req.body;

    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar un array de reglas',
      });
    }

    const validRules = rules.filter(r => r && r.trim());
    if (validRules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar al menos una regla válida',
      });
    }

    const user_id = req.user?.id || 1;
    const createdRules = await createMultipleRules(
      field_id,
      validRules.map(r => r.trim()),
      user_id
    );

    res.status(201).json({
      success: true,
      message: 'Reglas creadas exitosamente',
      data: createdRules,
      count: createdRules.length,
    });
  } catch (error) {
    console.error('Error al crear reglas múltiples:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear reglas múltiples',
    });
  }
};

/**
 * Actualizar una regla
 */
const updateExistingFieldRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { rule } = req.body;

    const existingRule = await getFieldRuleById(id);
    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: 'Regla no encontrada',
      });
    }

    if (!rule || !rule.trim()) {
      return res.status(400).json({
        success: false,
        error: 'La regla es requerida',
      });
    }

    const ruleData = {
      rule: rule.trim(),
      user_id_modification: req.user?.id || 1,
    };

    const updatedRule = await updateFieldRule(id, ruleData);

    res.json({
      success: true,
      message: 'Regla actualizada exitosamente',
      data: updatedRule,
    });
  } catch (error) {
    console.error('Error al actualizar regla:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar regla',
    });
  }
};

/**
 * Eliminar una regla
 */
const deleteFieldRuleById = async (req, res) => {
  try {
    const { id } = req.params;

    const existingRule = await getFieldRuleById(id);
    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: 'Regla no encontrada',
      });
    }

    const deleted = await deleteFieldRule(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Regla eliminada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar la regla',
      });
    }
  } catch (error) {
    console.error('Error al eliminar regla:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar regla',
    });
  }
};

/**
 * Eliminar todas las reglas de una cancha
 */
const deleteAllRulesByField = async (req, res) => {
  try {
    const { field_id } = req.params;

    const deletedCount = await deleteAllRulesByFieldId(field_id);

    res.json({
      success: true,
      message: `Se eliminaron ${deletedCount} reglas`,
      count: deletedCount,
    });
  } catch (error) {
    console.error('Error al eliminar reglas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar reglas',
    });
  }
};

module.exports = {
  getFieldRules,
  getFieldRule,
  getRulesByField,
  createNewFieldRule,
  createMultipleFieldRules,
  updateExistingFieldRule,
  deleteFieldRuleById,
  deleteAllRulesByField,
};
