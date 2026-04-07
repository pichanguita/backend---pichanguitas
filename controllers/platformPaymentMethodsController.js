const {
  getAllMethods,
  getMethodById,
  createMethod,
  updateMethod,
  deleteMethod,
  toggleMethodStatus,
  reorderMethods,
} = require('../models/platformPaymentMethodsModel');

/**
 * Obtener todos los métodos de pago de la plataforma
 * GET /api/platform-payment-methods
 */
const getAll = async (req, res) => {
  try {
    const { active_only } = req.query;
    const onlyActive = active_only === 'true' || active_only === '1';

    const methods = await getAllMethods(onlyActive);

    res.json({
      success: true,
      data: methods,
    });
  } catch (error) {
    console.error('Error obteniendo métodos de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener métodos de pago',
    });
  }
};

/**
 * Obtener un método de pago por ID
 * GET /api/platform-payment-methods/:id
 */
const getOne = async (req, res) => {
  try {
    const { id } = req.params;

    const method = await getMethodById(id);

    if (!method) {
      return res.status(404).json({
        success: false,
        error: 'Método de pago no encontrado',
      });
    }

    res.json({
      success: true,
      data: method,
    });
  } catch (error) {
    console.error('Error obteniendo método de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener método de pago',
    });
  }
};

/**
 * Crear un nuevo método de pago
 * POST /api/platform-payment-methods
 */
const create = async (req, res) => {
  try {
    const userId = req.user?.id;
    const data = req.body;

    if (!data.method_type || !data.name) {
      return res.status(400).json({
        success: false,
        error: 'El tipo de método y nombre son requeridos',
      });
    }

    const method = await createMethod(data, userId);

    res.status(201).json({
      success: true,
      message: 'Método de pago creado exitosamente',
      data: method,
    });
  } catch (error) {
    console.error('Error creando método de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear método de pago',
    });
  }
};

/**
 * Actualizar un método de pago
 * PUT /api/platform-payment-methods/:id
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    const method = await updateMethod(id, data, userId);

    if (!method) {
      return res.status(404).json({
        success: false,
        error: 'Método de pago no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Método de pago actualizado exitosamente',
      data: method,
    });
  } catch (error) {
    console.error('Error actualizando método de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar método de pago',
    });
  }
};

/**
 * Eliminar un método de pago
 * DELETE /api/platform-payment-methods/:id
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const method = await deleteMethod(id);

    if (!method) {
      return res.status(404).json({
        success: false,
        error: 'Método de pago no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Método de pago eliminado exitosamente',
      data: method,
    });
  } catch (error) {
    console.error('Error eliminando método de pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar método de pago',
    });
  }
};

/**
 * Activar/Desactivar un método de pago
 * PATCH /api/platform-payment-methods/:id/toggle
 */
const toggle = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const userId = req.user?.id;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'El campo is_active es requerido y debe ser booleano',
      });
    }

    const method = await toggleMethodStatus(id, is_active, userId);

    if (!method) {
      return res.status(404).json({
        success: false,
        error: 'Método de pago no encontrado',
      });
    }

    res.json({
      success: true,
      message: `Método de pago ${is_active ? 'activado' : 'desactivado'} exitosamente`,
      data: method,
    });
  } catch (error) {
    console.error('Error actualizando estado del método:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar estado del método de pago',
    });
  }
};

/**
 * Reordenar métodos de pago
 * POST /api/platform-payment-methods/reorder
 */
const reorder = async (req, res) => {
  try {
    const { ordered_ids } = req.body;
    const userId = req.user?.id;

    if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de IDs ordenados',
      });
    }

    await reorderMethods(ordered_ids, userId);

    res.json({
      success: true,
      message: 'Métodos de pago reordenados exitosamente',
    });
  } catch (error) {
    console.error('Error reordenando métodos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al reordenar métodos de pago',
    });
  }
};

module.exports = {
  getAll,
  getOne,
  create,
  update,
  remove,
  toggle,
  reorder,
};
