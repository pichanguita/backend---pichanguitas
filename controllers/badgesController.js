const {
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
} = require('../models/badgesModel');
const { getBadgeProgress, checkAndAssignBadges } = require('../services/badgeAssignmentService');

/**
 * Obtener todas las insignias con filtros
 */
const getBadges = async (req, res) => {
  try {
    const filters = {
      is_active:
        req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      status: req.query.status,
      criteria_type: req.query.criteria_type,
      search: req.query.search,
    };

    const badges = await getAllBadges(filters);

    res.json({
      success: true,
      data: badges,
      count: badges.length,
    });
  } catch (error) {
    console.error('Error al obtener insignias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener insignias',
    });
  }
};

/**
 * Obtener una insignia por ID
 */
const getBadge = async (req, res) => {
  try {
    const { id } = req.params;
    const badge = await getBadgeById(id);

    if (!badge) {
      return res.status(404).json({
        success: false,
        error: 'Insignia no encontrada',
      });
    }

    res.json({
      success: true,
      data: badge,
    });
  } catch (error) {
    console.error('Error al obtener insignia:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener insignia',
    });
  }
};

/**
 * Crear una nueva insignia con sus niveles
 */
const createNewBadge = async (req, res) => {
  try {
    const { name, icon, description, criteria_type, is_active, status, tiers } = req.body;

    // Validaciones básicas
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la insignia es requerido',
      });
    }

    if (!criteria_type || !criteria_type.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El tipo de criterio es requerido',
      });
    }

    // Verificar si el nombre ya existe
    const exists = await badgeNameExists(name.trim());
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una insignia con este nombre',
      });
    }

    const badgeData = {
      name: name.trim(),
      icon: icon?.trim(),
      description: description?.trim(),
      criteria_type: criteria_type.trim(),
      is_active,
      status,
      tiers: tiers || [],
      user_id_registration: req.user?.id || 1,
    };

    const newBadge = await createBadge(badgeData);

    res.status(201).json({
      success: true,
      message: 'Insignia creada exitosamente',
      data: newBadge,
    });
  } catch (error) {
    console.error('Error al crear insignia:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear insignia',
    });
  }
};

/**
 * Actualizar una insignia
 */
const updateExistingBadge = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, description, criteria_type, is_active, status, tiers } = req.body;

    // Verificar si la insignia existe
    const existingBadge = await getBadgeById(id);
    if (!existingBadge) {
      return res.status(404).json({
        success: false,
        error: 'Insignia no encontrada',
      });
    }

    // Si se actualiza el nombre, verificar que no exista
    if (name && name.trim() && name.trim().toLowerCase() !== existingBadge.name.toLowerCase()) {
      const exists = await badgeNameExists(name.trim(), id);
      if (exists) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe otra insignia con este nombre',
        });
      }
    }

    const badgeData = {
      name: name?.trim(),
      icon: icon?.trim(),
      description: description?.trim(),
      criteria_type: criteria_type?.trim(),
      is_active,
      status,
      tiers,
      user_id_modification: req.user?.id || 1,
    };

    const updatedBadge = await updateBadge(id, badgeData);

    res.json({
      success: true,
      message: 'Insignia actualizada exitosamente',
      data: updatedBadge,
    });
  } catch (error) {
    console.error('Error al actualizar insignia:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar insignia',
    });
  }
};

/**
 * Eliminar una insignia (soft delete)
 */
const deleteBadgeById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la insignia existe
    const existingBadge = await getBadgeById(id);
    if (!existingBadge) {
      return res.status(404).json({
        success: false,
        error: 'Insignia no encontrada',
      });
    }

    const user_id = req.user?.id || 1;
    const deleted = await deleteBadge(id, user_id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Insignia eliminada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar la insignia',
      });
    }
  } catch (error) {
    console.error('Error al eliminar insignia:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar insignia',
    });
  }
};

/**
 * Obtener insignias de un cliente
 */
const getCustomerBadgesById = async (req, res) => {
  try {
    const { customer_id } = req.params;
    const badges = await getCustomerBadges(customer_id);

    res.json({
      success: true,
      data: badges,
      count: badges.length,
    });
  } catch (error) {
    console.error('Error al obtener insignias del cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener insignias del cliente',
    });
  }
};

/**
 * Asignar insignia a un cliente
 */
const assignBadge = async (req, res) => {
  try {
    const { customer_id, badge_id, tier, auto_assigned } = req.body;

    // Validaciones básicas
    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID del cliente es requerido',
      });
    }

    if (!badge_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID de la insignia es requerido',
      });
    }

    if (!tier || !tier.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nivel (tier) es requerido',
      });
    }

    // Verificar si la insignia existe
    const badge = await getBadgeById(badge_id);
    if (!badge) {
      return res.status(404).json({
        success: false,
        error: 'Insignia no encontrada',
      });
    }

    // Verificar si el cliente ya tiene esta insignia
    const hasBadge = await customerHasBadge(customer_id, badge_id);
    if (hasBadge) {
      return res.status(409).json({
        success: false,
        error: 'El cliente ya tiene esta insignia',
      });
    }

    const assignmentData = {
      customer_id,
      badge_id,
      tier: tier.trim(),
      auto_assigned: auto_assigned || false,
      user_id_registration: req.user?.id || 1,
    };

    const assignment = await assignBadgeToCustomer(assignmentData);

    res.status(201).json({
      success: true,
      message: 'Insignia asignada al cliente exitosamente',
      data: assignment,
    });
  } catch (error) {
    console.error('Error al asignar insignia al cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al asignar insignia al cliente',
    });
  }
};

/**
 * Eliminar insignia de un cliente
 */
const removeCustomerBadgeById = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await removeCustomerBadge(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Insignia eliminada del cliente exitosamente',
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Asignación de insignia no encontrada',
      });
    }
  } catch (error) {
    console.error('Error al eliminar insignia del cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar insignia del cliente',
    });
  }
};

/**
 * Obtener estadísticas de insignias
 */
const getStats = async (req, res) => {
  try {
    const stats = await getBadgeStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de insignias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de insignias',
    });
  }
};

/**
 * Obtener progreso de insignias para un cliente
 */
const getCustomerBadgeProgress = async (req, res) => {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'ID de cliente requerido',
      });
    }

    const progress = await getBadgeProgress(parseInt(customer_id));

    res.json({
      success: true,
      data: progress,
      count: progress.length,
    });
  } catch (error) {
    console.error('Error al obtener progreso de insignias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener progreso de insignias',
    });
  }
};

/**
 * Verificar y asignar insignias manualmente (para testing o corrección)
 */
const checkAndAssignBadgesManually = async (req, res) => {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'ID de cliente requerido',
      });
    }

    const userId = req.user?.id || 1;
    const newBadges = await checkAndAssignBadges(parseInt(customer_id), userId);

    res.json({
      success: true,
      message:
        newBadges.length > 0
          ? `${newBadges.length} insignia(s) asignada(s)`
          : 'No hay nuevas insignias para asignar',
      data: newBadges,
    });
  } catch (error) {
    console.error('Error al verificar/asignar insignias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar/asignar insignias',
    });
  }
};

/**
 * Obtener mis insignias (cliente autenticado)
 * GET /api/badges/my-badges
 */
const getMyBadges = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    // Buscar el customer asociado a este usuario
    const pool = require('../config/db');
    const customerResult = await pool.query(
      'SELECT id FROM customers WHERE user_id = $1 AND status = $2 LIMIT 1',
      [userId, 'active']
    );

    if (customerResult.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'No se encontró perfil de cliente',
      });
    }

    const customerId = customerResult.rows[0].id;
    const badges = await getCustomerBadges(customerId);

    res.json({
      success: true,
      data: badges,
      count: badges.length,
    });
  } catch (error) {
    console.error('Error al obtener mis insignias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mis insignias',
    });
  }
};

/**
 * Obtener leaderboard de clientes con más insignias
 */
const getLeaderboardData = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await getLeaderboard(limit);

    res.json({
      success: true,
      data: leaderboard,
      count: leaderboard.length,
    });
  } catch (error) {
    console.error('Error al obtener leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener leaderboard',
    });
  }
};

module.exports = {
  getBadges,
  getBadge,
  createNewBadge,
  updateExistingBadge,
  deleteBadgeById,
  getCustomerBadgesById,
  getMyBadges,
  assignBadge,
  removeCustomerBadgeById,
  getStats,
  getCustomerBadgeProgress,
  checkAndAssignBadgesManually,
  getLeaderboardData,
};
