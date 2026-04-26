const {
  getLogsByUserId,
  getCountsByUserId,
} = require('../services/activityLogsService');

/**
 * GET /api/activity-logs/user/:userId
 * Retorna los logs del usuario + conteos agregados por tipo.
 */
const getUserActivity = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ success: false, error: 'userId inválido' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 200;
    const entityType = req.query.type || null;

    const [logs, counts] = await Promise.all([
      getLogsByUserId(userId, { limit, entityType }),
      getCountsByUserId(userId),
    ]);

    // Adaptar al formato que el FE ya consume (camelCase + campos esperados).
    const items = logs.map(row => ({
      id: row.id,
      userId: row.user_id,
      action: row.description || row.action,
      details: row.description || '',
      type: row.entity_type,
      entityId: row.entity_id,
      status: row.status || 'info',
      ip: row.ip_address,
      timestamp: row.date_time_registration,
    }));

    res.json({ success: true, data: items, counts });
  } catch (error) {
    console.error('Error obteniendo registro de actividad:', error);
    res
      .status(500)
      .json({ success: false, error: 'Error al obtener registro de actividad' });
  }
};

module.exports = { getUserActivity };
