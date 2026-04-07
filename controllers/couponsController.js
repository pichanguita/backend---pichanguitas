const {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  couponCodeExists,
  validateCoupon,
  getCouponStats,
} = require('../models/couponsModel');

/**
 * Obtener todos los cupones con filtros
 */
const getCoupons = async (req, res) => {
  try {
    const filters = {
      is_active:
        req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      type: req.query.type,
      status: req.query.status,
      valid_now: req.query.valid_now,
      search: req.query.search,
    };

    const coupons = await getAllCoupons(filters);

    res.json({
      success: true,
      data: coupons,
      count: coupons.length,
    });
  } catch (error) {
    console.error('Error al obtener cupones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cupones',
    });
  }
};

/**
 * Obtener un cupón por ID
 */
const getCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await getCouponById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Cupón no encontrado',
      });
    }

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    console.error('Error al obtener cupón:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cupón',
    });
  }
};

/**
 * Crear un nuevo cupón
 */
const createNewCoupon = async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      type,
      value,
      is_active,
      usage_limit,
      valid_from,
      valid_until,
      min_purchase,
      applicable_fields,
      status,
    } = req.body;

    // Validaciones básicas
    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El código del cupón es requerido',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre del cupón es requerido',
      });
    }

    if (!type || !['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'El tipo debe ser "percentage" o "fixed"',
      });
    }

    if (!value || value <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El valor debe ser mayor a 0',
      });
    }

    if (type === 'percentage' && value > 100) {
      return res.status(400).json({
        success: false,
        error: 'El porcentaje no puede ser mayor a 100',
      });
    }

    if (!valid_from || !valid_until) {
      return res.status(400).json({
        success: false,
        error: 'Las fechas de validez son requeridas',
      });
    }

    // Verificar si el código ya existe
    const codeExists = await couponCodeExists(code);
    if (codeExists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un cupón con ese código',
      });
    }

    const couponData = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description?.trim(),
      type,
      value,
      is_active,
      usage_limit,
      valid_from,
      valid_until,
      min_purchase,
      applicable_fields,
      created_by: req.user?.id || 1,
      status,
      user_id_registration: req.user?.id || 1,
    };

    const newCoupon = await createCoupon(couponData);

    res.status(201).json({
      success: true,
      message: 'Cupón creado exitosamente',
      data: newCoupon,
    });
  } catch (error) {
    console.error('Error al crear cupón:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear cupón',
    });
  }
};

/**
 * Actualizar un cupón
 */
const updateExistingCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      description,
      type,
      value,
      is_active,
      usage_limit,
      valid_from,
      valid_until,
      min_purchase,
      applicable_fields,
      status,
    } = req.body;

    // Verificar si el cupón existe
    const existingCoupon = await getCouponById(id);
    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        error: 'Cupón no encontrado',
      });
    }

    // Si se está actualizando el código, verificar que no exista
    if (code && code.trim()) {
      const codeExists = await couponCodeExists(code, id);
      if (codeExists) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe un cupón con ese código',
        });
      }
    }

    // Validaciones
    if (type && !['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'El tipo debe ser "percentage" o "fixed"',
      });
    }

    if (value && value <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El valor debe ser mayor a 0',
      });
    }

    if (type === 'percentage' && value && value > 100) {
      return res.status(400).json({
        success: false,
        error: 'El porcentaje no puede ser mayor a 100',
      });
    }

    const couponData = {
      code: code?.trim().toUpperCase(),
      name: name?.trim(),
      description: description?.trim(),
      type,
      value,
      is_active,
      usage_limit,
      valid_from,
      valid_until,
      min_purchase,
      applicable_fields,
      status,
      user_id_modification: req.user?.id || 1,
    };

    const updatedCoupon = await updateCoupon(id, couponData);

    res.json({
      success: true,
      message: 'Cupón actualizado exitosamente',
      data: updatedCoupon,
    });
  } catch (error) {
    console.error('Error al actualizar cupón:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar cupón',
    });
  }
};

/**
 * Eliminar un cupón (soft delete)
 */
const deleteCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el cupón existe
    const existingCoupon = await getCouponById(id);
    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        error: 'Cupón no encontrado',
      });
    }

    const user_id = req.user?.id || 1;
    const deleted = await deleteCoupon(id, user_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Cupón eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el cupón',
      });
    }
  } catch (error) {
    console.error('Error al eliminar cupón:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar cupón',
    });
  }
};

/**
 * Validar un cupón
 */
const validateCouponCode = async (req, res) => {
  try {
    const { code, field_id, total_amount } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El código del cupón es requerido',
      });
    }

    if (!field_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la cancha es requerido',
      });
    }

    if (!total_amount || total_amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto total debe ser mayor a 0',
      });
    }

    const result = await validateCoupon(code.trim().toUpperCase(), field_id, total_amount);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    // Calcular descuento
    let discount = 0;
    if (result.coupon.type === 'percentage') {
      discount = (total_amount * result.coupon.value) / 100;
    } else if (result.coupon.type === 'fixed') {
      discount = parseFloat(result.coupon.value);
    }

    // El descuento no puede ser mayor al monto total
    if (discount > total_amount) {
      discount = total_amount;
    }

    res.json({
      success: true,
      valid: true,
      message: result.message,
      coupon: {
        id: result.coupon.id,
        code: result.coupon.code,
        name: result.coupon.name,
        type: result.coupon.type,
        value: result.coupon.value,
        discount: parseFloat(discount.toFixed(2)),
        final_amount: parseFloat((total_amount - discount).toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Error al validar cupón:', error);
    res.status(500).json({
      success: false,
      error: 'Error al validar cupón',
    });
  }
};

/**
 * Obtener estadísticas de uso de cupones
 */
const getStats = async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await getCouponStats(id ? parseInt(id) : null);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de cupones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de cupones',
    });
  }
};

module.exports = {
  getCoupons,
  getCoupon,
  createNewCoupon,
  updateExistingCoupon,
  deleteCouponById,
  validateCouponCode,
  getStats,
};
