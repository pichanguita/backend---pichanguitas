const {
  getAllCouponUsage,
  getCouponUsageById,
  recordCouponUsage,
  isCouponUsedInReservation,
  getCouponUsageByCouponId,
  getCouponUsageByCustomerId,
  deleteCouponUsage,
  getCouponUsageStats,
} = require('../models/couponUsageModel');

/**
 * Obtener todos los registros de uso de cupones con filtros
 */
const getCouponUsages = async (req, res) => {
  try {
    const filters = {
      coupon_id: req.query.coupon_id,
      customer_id: req.query.customer_id,
      user_id: req.query.user_id,
      reservation_id: req.query.reservation_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
    };

    const usages = await getAllCouponUsage(filters);

    res.json({
      success: true,
      data: usages,
      count: usages.length,
    });
  } catch (error) {
    console.error('Error al obtener usos de cupones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usos de cupones',
    });
  }
};

/**
 * Obtener un registro de uso por ID
 */
const getCouponUsage = async (req, res) => {
  try {
    const { id } = req.params;
    const usage = await getCouponUsageById(id);

    if (!usage) {
      return res.status(404).json({
        success: false,
        error: 'Registro de uso no encontrado',
      });
    }

    res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    console.error('Error al obtener registro de uso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener registro de uso',
    });
  }
};

/**
 * Obtener usos de un cupón específico
 */
const getUsagesByCoupon = async (req, res) => {
  try {
    const { coupon_id } = req.params;
    const usages = await getCouponUsageByCouponId(coupon_id);

    res.json({
      success: true,
      data: usages,
      count: usages.length,
    });
  } catch (error) {
    console.error('Error al obtener usos del cupón:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usos del cupón',
    });
  }
};

/**
 * Obtener usos de cupones de un cliente
 */
const getUsagesByCustomer = async (req, res) => {
  try {
    const { customer_id } = req.params;
    const usages = await getCouponUsageByCustomerId(customer_id);

    res.json({
      success: true,
      data: usages,
      count: usages.length,
    });
  } catch (error) {
    console.error('Error al obtener usos del cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usos del cliente',
    });
  }
};

/**
 * Registrar el uso de un cupón
 */
const recordUsage = async (req, res) => {
  try {
    const { coupon_id, user_id, customer_id, reservation_id } = req.body;

    // Validaciones básicas
    if (!coupon_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID del cupón es requerido',
      });
    }

    if (!reservation_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la reserva es requerido',
      });
    }

    // Verificar si el cupón ya fue usado en esta reserva
    const alreadyUsed = await isCouponUsedInReservation(coupon_id, reservation_id);
    if (alreadyUsed) {
      return res.status(409).json({
        success: false,
        error: 'Este cupón ya fue usado en esta reserva',
      });
    }

    const usageData = {
      coupon_id,
      user_id: user_id || null,
      customer_id: customer_id || null,
      reservation_id,
      user_id_registration: req.user?.id || 1,
    };

    const newUsage = await recordCouponUsage(usageData);

    res.status(201).json({
      success: true,
      message: 'Uso de cupón registrado exitosamente',
      data: newUsage,
    });
  } catch (error) {
    console.error('Error al registrar uso de cupón:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar uso de cupón',
    });
  }
};

/**
 * Eliminar un registro de uso de cupón
 */
const deleteCouponUsageById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el registro existe
    const existingUsage = await getCouponUsageById(id);
    if (!existingUsage) {
      return res.status(404).json({
        success: false,
        error: 'Registro de uso no encontrado',
      });
    }

    const deleted = await deleteCouponUsage(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Registro de uso eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el registro de uso',
      });
    }
  } catch (error) {
    console.error('Error al eliminar registro de uso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar registro de uso',
    });
  }
};

/**
 * Obtener estadísticas de uso de cupones
 */
const getStats = async (req, res) => {
  try {
    const filters = {
      coupon_id: req.query.coupon_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
    };

    const stats = await getCouponUsageStats(filters);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de uso:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de uso',
    });
  }
};

module.exports = {
  getCouponUsages,
  getCouponUsage,
  getUsagesByCoupon,
  getUsagesByCustomer,
  recordUsage,
  deleteCouponUsageById,
  getStats,
};
