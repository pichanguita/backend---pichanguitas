const {
  getAllCriteria,
  getCriteriaById,
  calculateAllCriteriaForCustomer,
} = require('../models/badgeCriteriaModel');

/**
 * Obtener todos los criterios disponibles
 */
const getCriteria = async (req, res) => {
  try {
    const filters = {
      is_active: req.query.is_active === 'false' ? false : true,
    };

    const criteria = await getAllCriteria(filters);

    res.json({
      success: true,
      data: criteria,
      count: criteria.length,
    });
  } catch (error) {
    console.error('Error al obtener criterios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener criterios de insignias',
    });
  }
};

/**
 * Obtener un criterio por ID
 */
const getCriteriaByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const criteria = await getCriteriaById(id);

    if (!criteria) {
      return res.status(404).json({
        success: false,
        error: 'Criterio no encontrado',
      });
    }

    res.json({
      success: true,
      data: criteria,
    });
  } catch (error) {
    console.error('Error al obtener criterio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener criterio',
    });
  }
};

/**
 * Calcular valores de criterios para un cliente
 */
const calculateCustomerCriteria = async (req, res) => {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'ID de cliente requerido',
      });
    }

    const values = await calculateAllCriteriaForCustomer(parseInt(customer_id));

    res.json({
      success: true,
      data: {
        customer_id: parseInt(customer_id),
        criteria_values: values,
      },
    });
  } catch (error) {
    console.error('Error al calcular criterios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al calcular criterios del cliente',
    });
  }
};

module.exports = {
  getCriteria,
  getCriteriaByIdController,
  calculateCustomerCriteria,
};
