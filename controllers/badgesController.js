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
const pool = require('../config/db');

/**
 * Resolver el customer_id del usuario autenticado.
 * Devuelve null si el usuario no tiene perfil de cliente activo.
 */
const resolveAuthenticatedCustomerId = async (req) => {
  const userId = req.user?.id;
  if (!userId) return null;
  const result = await pool.query(
    `SELECT id FROM customers WHERE user_id = $1 AND status = $2 LIMIT 1`,
    [userId, 'active']
  );
  return result.rows[0]?.id ?? null;
};

/**
 * Listar insignias con filtros (admin/cliente).
 */
const getBadges = async (req, res) => {
  try {
    const filters = {
      is_active:
        req.query.is_active === 'true'
          ? true
          : req.query.is_active === 'false'
            ? false
            : undefined,
      status: req.query.status,
      criteria_id: req.query.criteria_id ? parseInt(req.query.criteria_id, 10) : undefined,
      criteria_code: req.query.criteria_code,
      search: req.query.search,
    };

    const badges = await getAllBadges(filters);
    res.json({ success: true, data: badges, count: badges.length });
  } catch (error) {
    console.error('Error al obtener insignias:', error);
    res.status(500).json({ success: false, error: 'Error al obtener insignias' });
  }
};

const getBadge = async (req, res) => {
  try {
    const badge = await getBadgeById(req.params.id);
    if (!badge) return res.status(404).json({ success: false, error: 'Insignia no encontrada' });
    res.json({ success: true, data: badge });
  } catch (error) {
    console.error('Error al obtener insignia:', error);
    res.status(500).json({ success: false, error: 'Error al obtener insignia' });
  }
};

/**
 * Validar payload de creación/actualización: criteria_id es obligatorio en alta.
 */
const parseCriteriaId = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const createNewBadge = async (req, res) => {
  try {
    const { name, icon, description, criteria_id, is_active, status, tiers } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre de la insignia es requerido' });
    }

    const parsedCriteriaId = parseCriteriaId(criteria_id);
    if (!parsedCriteriaId) {
      return res
        .status(400)
        .json({ success: false, error: 'El criterio (criteria_id) es requerido' });
    }

    if (await badgeNameExists(name.trim())) {
      return res
        .status(409)
        .json({ success: false, error: 'Ya existe una insignia con este nombre' });
    }

    const newBadge = await createBadge({
      name: name.trim(),
      icon: icon?.trim(),
      description: description?.trim(),
      criteria_id: parsedCriteriaId,
      is_active,
      status,
      tiers: tiers || [],
      user_id_registration: req.user?.id || 1,
    });

    res.status(201).json({
      success: true,
      message: 'Insignia creada exitosamente',
      data: newBadge,
    });
  } catch (error) {
    if (error.code === 'INVALID_CRITERIA_ID' || error.code === 'MISSING_CRITERIA_ID') {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Error al crear insignia:', error);
    res.status(500).json({ success: false, error: 'Error al crear insignia' });
  }
};

const updateExistingBadge = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, description, criteria_id, is_active, status, tiers } = req.body;

    const existing = await getBadgeById(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Insignia no encontrada' });

    if (name && name.trim() && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      if (await badgeNameExists(name.trim(), id)) {
        return res
          .status(409)
          .json({ success: false, error: 'Ya existe otra insignia con este nombre' });
      }
    }

    const parsedCriteriaId =
      criteria_id === undefined ? undefined : parseCriteriaId(criteria_id);
    if (criteria_id !== undefined && parsedCriteriaId === null) {
      return res
        .status(400)
        .json({ success: false, error: 'El criterio (criteria_id) es inválido' });
    }

    const updated = await updateBadge(id, {
      name: name?.trim(),
      icon: icon?.trim(),
      description: description?.trim(),
      criteria_id: parsedCriteriaId,
      is_active,
      status,
      tiers,
      user_id_modification: req.user?.id || 1,
    });

    res.json({
      success: true,
      message: 'Insignia actualizada exitosamente',
      data: updated,
    });
  } catch (error) {
    if (error.code === 'INVALID_CRITERIA_ID') {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Error al actualizar insignia:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar insignia' });
  }
};

const deleteBadgeById = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getBadgeById(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Insignia no encontrada' });

    const deleted = await deleteBadge(id, req.user?.id || 1);
    if (!deleted) {
      return res.status(500).json({ success: false, error: 'No se pudo eliminar la insignia' });
    }
    res.json({ success: true, message: 'Insignia eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar insignia:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar insignia' });
  }
};

const getCustomerBadgesById = async (req, res) => {
  try {
    const badges = await getCustomerBadges(req.params.customer_id);
    res.json({ success: true, data: badges, count: badges.length });
  } catch (error) {
    console.error('Error al obtener insignias del cliente:', error);
    res.status(500).json({ success: false, error: 'Error al obtener insignias del cliente' });
  }
};

const assignBadge = async (req, res) => {
  try {
    const { customer_id, badge_id, tier, auto_assigned } = req.body;
    if (!customer_id) return res.status(400).json({ success: false, error: 'El ID del cliente es requerido' });
    if (!badge_id) return res.status(400).json({ success: false, error: 'El ID de la insignia es requerido' });
    if (!tier || !tier.trim()) return res.status(400).json({ success: false, error: 'El nivel (tier) es requerido' });

    const badge = await getBadgeById(badge_id);
    if (!badge) return res.status(404).json({ success: false, error: 'Insignia no encontrada' });

    if (await customerHasBadge(customer_id, badge_id)) {
      return res.status(409).json({ success: false, error: 'El cliente ya tiene esta insignia' });
    }

    const assignment = await assignBadgeToCustomer({
      customer_id,
      badge_id,
      tier: tier.trim(),
      auto_assigned: auto_assigned || false,
      user_id_registration: req.user?.id || 1,
    });

    res
      .status(201)
      .json({ success: true, message: 'Insignia asignada al cliente exitosamente', data: assignment });
  } catch (error) {
    console.error('Error al asignar insignia al cliente:', error);
    res.status(500).json({ success: false, error: 'Error al asignar insignia al cliente' });
  }
};

const removeCustomerBadgeById = async (req, res) => {
  try {
    const deleted = await removeCustomerBadge(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Asignación de insignia no encontrada' });
    res.json({ success: true, message: 'Insignia eliminada del cliente exitosamente' });
  } catch (error) {
    console.error('Error al eliminar insignia del cliente:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar insignia del cliente' });
  }
};

const getStats = async (_req, res) => {
  try {
    res.json({ success: true, data: await getBadgeStats() });
  } catch (error) {
    console.error('Error al obtener estadísticas de insignias:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estadísticas de insignias' });
  }
};

/**
 * Progreso de insignias para un cliente. Antes de leer corre el check de
 * asignación automática para garantizar que cualquier umbral alcanzado
 * quede reflejado al instante (idempotente).
 */
const getCustomerBadgeProgress = async (req, res) => {
  try {
    const { customer_id } = req.params;
    if (!customer_id) {
      return res.status(400).json({ success: false, error: 'ID de cliente requerido' });
    }

    const customerId = parseInt(customer_id, 10);
    const userId = req.user?.id || 1;

    const newlyAssigned = await checkAndAssignBadges(customerId, userId);
    const progress = await getBadgeProgress(customerId);

    res.json({
      success: true,
      data: progress,
      count: progress.length,
      newly_assigned: newlyAssigned,
    });
  } catch (error) {
    console.error('Error al obtener progreso de insignias:', error);
    res.status(500).json({ success: false, error: 'Error al obtener progreso de insignias' });
  }
};

/**
 * Verificación manual (admin) de asignación de insignias.
 */
const checkAndAssignBadgesManually = async (req, res) => {
  try {
    const { customer_id } = req.params;
    if (!customer_id) {
      return res.status(400).json({ success: false, error: 'ID de cliente requerido' });
    }

    const newBadges = await checkAndAssignBadges(parseInt(customer_id, 10), req.user?.id || 1);

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
    res.status(500).json({ success: false, error: 'Error al verificar/asignar insignias' });
  }
};

/**
 * Mis insignias (cliente autenticado).
 * Antes de devolver, ejecuta el check de asignación automática para
 * que cualquier umbral alcanzado se persista de inmediato.
 * Devuelve las insignias recién desbloqueadas en `newly_assigned` para
 * que el frontend pueda disparar la notificación correspondiente.
 */
const getMyBadges = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    const customerId = await resolveAuthenticatedCustomerId(req);
    if (!customerId) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        newly_assigned: [],
        message: 'No se encontró perfil de cliente',
      });
    }

    const newlyAssigned = await checkAndAssignBadges(customerId, req.user.id);
    const badges = await getCustomerBadges(customerId);

    res.json({
      success: true,
      data: badges,
      count: badges.length,
      newly_assigned: newlyAssigned,
    });
  } catch (error) {
    console.error('Error al obtener mis insignias:', error);
    res.status(500).json({ success: false, error: 'Error al obtener mis insignias' });
  }
};

const getLeaderboardData = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const leaderboard = await getLeaderboard(limit);
    res.json({ success: true, data: leaderboard, count: leaderboard.length });
  } catch (error) {
    console.error('Error al obtener leaderboard:', error);
    res.status(500).json({ success: false, error: 'Error al obtener leaderboard' });
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
