const {
  getAllCustomers,
  getCustomerById,
  getCustomerByPhone,
  createCustomer,
  updateCustomer,
  updateCustomerStats,
  deleteCustomer,
  phoneNumberExists,
  getCustomerPromotionHistory,
  getCustomersByFieldAdmin,
  getAllCustomersWithStats,
} = require('../models/customersModel');

/**
 * Obtener todos los clientes
 */
const getCustomers = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      is_vip: req.query.is_vip === 'true' ? true : req.query.is_vip === 'false' ? false : undefined,
      search: req.query.search,
    };

    const customers = await getAllCustomers(filters);

    res.json({
      success: true,
      data: customers,
      count: customers.length,
    });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener clientes',
    });
  }
};

/**
 * Obtener un cliente por ID
 */
const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await getCustomerById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cliente',
    });
  }
};

/**
 * Obtener un cliente por número de teléfono
 */
const getCustomerByPhoneNumber = async (req, res) => {
  try {
    const { phone } = req.params;
    const customer = await getCustomerByPhone(phone);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Error al obtener cliente por teléfono:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cliente por teléfono',
    });
  }
};

/**
 * Crear un nuevo cliente
 */
const createNewCustomer = async (req, res) => {
  try {
    const { user_id, phone_number, name, email, is_vip, notes, status } = req.body;

    // Validaciones
    if (!phone_number || !phone_number.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El número de teléfono es requerido',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido',
      });
    }

    // Verificar si el número de teléfono ya existe
    const phoneExists = await phoneNumberExists(phone_number);
    if (phoneExists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un cliente con ese número de teléfono',
      });
    }

    const customerData = {
      user_id,
      phone_number: phone_number.trim(),
      name: name.trim(),
      email: email?.trim(),
      created_by: req.user?.id || 1,
      is_vip,
      notes,
      status,
      user_id_registration: req.user?.id || 1,
    };

    const newCustomer = await createCustomer(customerData);

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: newCustomer,
    });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear cliente',
    });
  }
};

/**
 * Actualizar un cliente
 */
const updateExistingCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, is_vip, notes, status } = req.body;

    // Verificar si el cliente existe
    const existingCustomer = await getCustomerById(id);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    const customerData = {
      name: name?.trim(),
      email: email?.trim(),
      is_vip,
      notes,
      status,
      user_id_modification: req.user?.id || 1,
    };

    const updatedCustomer = await updateCustomer(id, customerData);

    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: updatedCustomer,
    });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar cliente',
    });
  }
};

/**
 * Actualizar estadísticas de un cliente
 */
const updateStats = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      total_reservations,
      total_hours,
      total_spent,
      earned_free_hours,
      used_free_hours,
      available_free_hours,
      last_reservation,
    } = req.body;

    // Verificar si el cliente existe
    const existingCustomer = await getCustomerById(id);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    const stats = {
      total_reservations,
      total_hours,
      total_spent,
      earned_free_hours,
      used_free_hours,
      available_free_hours,
      last_reservation,
      user_id_modification: req.user?.id || 1,
    };

    const updatedCustomer = await updateCustomerStats(id, stats);

    res.json({
      success: true,
      message: 'Estadísticas del cliente actualizadas exitosamente',
      data: updatedCustomer,
    });
  } catch (error) {
    console.error('Error al actualizar estadísticas del cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar estadísticas del cliente',
    });
  }
};

/**
 * Eliminar un cliente (soft delete)
 */
const deleteCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el cliente existe
    const existingCustomer = await getCustomerById(id);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    const user_id = req.user?.id || 1;
    const deleted = await deleteCustomer(id, user_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Cliente eliminado exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar el cliente',
      });
    }
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar cliente',
    });
  }
};

/**
 * Obtener historial de promociones de un cliente
 */
const getPromotionHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el cliente existe
    const existingCustomer = await getCustomerById(id);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    const history = await getCustomerPromotionHistory(id);

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error al obtener historial de promociones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial de promociones',
    });
  }
};

/**
 * Obtener clientes por admin (basado en reservas en sus canchas)
 * GET /api/customers/by-admin/:adminId
 * O GET /api/customers/my-clients (usa el admin del token)
 */
const getMyClients = async (req, res) => {
  try {
    const adminId = req.params.adminId || req.user?.id;
    const userRole = req.user?.id_rol;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el ID del administrador',
      });
    }

    let customers;

    // Si es super_admin (rol 1), puede ver todos los clientes
    if (userRole === 1) {
      // Si se pasa adminId específico, filtrar por ese admin
      if (req.params.adminId) {
        customers = await getCustomersByFieldAdmin(parseInt(req.params.adminId));
      } else {
        // Si no, mostrar todos los clientes con estadísticas
        customers = await getAllCustomersWithStats();
      }
    } else {
      // Admin normal solo ve clientes de sus canchas
      customers = await getCustomersByFieldAdmin(parseInt(adminId));
    }

    // Transformar a camelCase para el frontend
    const transformedCustomers = customers.map(customer => ({
      id: customer.id,
      userId: customer.user_id,
      phoneNumber: customer.phone_number,
      name: customer.name,
      email: customer.email,
      createdBy: customer.created_by,
      isVIP: customer.is_vip,
      notes: customer.notes,
      status: customer.status,
      createdAt: customer.date_time_registration,
      totalReservations: parseInt(customer.total_reservations) || 0,
      totalHours: parseFloat(customer.total_hours) || 0,
      totalSpent: parseFloat(customer.total_spent) || 0,
      lastReservation: customer.last_reservation,
      earnedFreeHours: parseFloat(customer.earned_free_hours) || 0,
      usedFreeHours: parseFloat(customer.used_free_hours) || 0,
      availableFreeHours: parseFloat(customer.available_free_hours) || 0,
    }));

    res.json({
      success: true,
      data: transformedCustomers,
      count: transformedCustomers.length,
    });
  } catch (error) {
    console.error('Error al obtener clientes del admin:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener clientes',
    });
  }
};

/**
 * Obtener horas gratis disponibles del cliente autenticado
 * GET /api/customers/my-free-hours
 */
const getMyFreeHours = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    const pool = require('../config/db');

    // Obtener datos del cliente basado en su user_id
    const result = await pool.query(
      `SELECT
        id,
        name,
        available_free_hours,
        earned_free_hours,
        used_free_hours
      FROM customers
      WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          availableFreeHours: 0,
          earnedFreeHours: 0,
          usedFreeHours: 0,
        },
      });
    }

    const customer = result.rows[0];

    res.json({
      success: true,
      data: {
        customerId: customer.id,
        customerName: customer.name,
        availableFreeHours: parseFloat(customer.available_free_hours) || 0,
        earnedFreeHours: parseFloat(customer.earned_free_hours) || 0,
        usedFreeHours: parseFloat(customer.used_free_hours) || 0,
      },
    });
  } catch (error) {
    console.error('Error al obtener horas gratis:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener horas gratis',
    });
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  getCustomerByPhoneNumber,
  createNewCustomer,
  updateExistingCustomer,
  updateStats,
  deleteCustomerById,
  getPromotionHistory,
  getMyClients,
  getMyFreeHours,
};
