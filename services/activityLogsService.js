/**
 * Registro centralizado de actividad.
 *
 * Cualquier módulo que dispare una acción relevante (login, reserva, cambio
 * de cancha, bloqueo de usuario, etc.) debe llamar a `logActivity(...)`.
 * Las escrituras son best-effort: si falla, se loguea el error pero NO
 * rompe el flujo principal del request.
 */

const pool = require('../config/db');

/**
 * Categorías (entity_type) reconocidas por el FE para filtrado/stats.
 * Deben mantenerse alineadas con UserTable.jsx.
 */
const ACTIVITY_TYPES = Object.freeze({
  LOGIN: 'login',
  RESERVATION: 'reservation',
  FIELD: 'field',
  SETTINGS: 'settings',
});

const ACTIVITY_STATUS = Object.freeze({
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
});

/**
 * Inserta un registro de actividad.
 *
 * @param {Object}  params
 * @param {number}  params.userId          - Dueño de la actividad (aparece en su feed).
 * @param {string}  params.action           - Identificador corto máquina-legible (ej: 'reservation.created').
 * @param {string}  params.entityType       - Categoría (usar ACTIVITY_TYPES).
 * @param {number?} [params.entityId]       - ID del registro relacionado (reservation.id, field.id, etc).
 * @param {string}  params.description      - Texto legible que ve el SA.
 * @param {string}  [params.status=info]    - info/success/warning/error.
 * @param {string?} [params.ipAddress]      - IP del actor.
 * @param {number?} [params.actorUserId]    - Quién ejecutó la acción (puede diferir de userId).
 */
const logActivity = async params => {
  const {
    userId,
    action,
    entityType,
    entityId = null,
    description,
    status = ACTIVITY_STATUS.INFO,
    ipAddress = null,
    actorUserId = null,
  } = params;

  if (!userId || !action || !entityType || !description) {
    console.warn('[activity-logs] insert omitido: parámetros incompletos', params);
    return null;
  }

  try {
    const result = await pool.query(
      `INSERT INTO activity_logs
         (user_id, action, entity_type, entity_id, description, status,
          ip_address, user_id_registration, date_time_registration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        userId,
        action,
        entityType,
        entityId,
        description,
        status,
        ipAddress,
        actorUserId ?? userId,
      ]
    );
    return result.rows[0]?.id || null;
  } catch (err) {
    // Best-effort: no bloquear el request si el log falla.
    console.error('[activity-logs] error al insertar:', err.message);
    return null;
  }
};

/**
 * Extrae la IP desde un objeto request (soporta proxies via x-forwarded-for).
 */
const resolveIp = req => {
  if (!req) return null;
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
};

/**
 * Helper para loguear con contexto del request automáticamente.
 */
const logActivityFromRequest = (req, params) =>
  logActivity({
    ipAddress: resolveIp(req),
    actorUserId: req?.user?.id ?? null,
    ...params,
  });

/**
 * Obtener logs por usuario (paginado).
 */
const getLogsByUserId = async (userId, { limit = 200, entityType = null } = {}) => {
  const params = [userId];
  let query = `
    SELECT id, user_id, action, entity_type, entity_id, description, status,
           ip_address, user_id_registration, date_time_registration
    FROM activity_logs
    WHERE user_id = $1
  `;

  if (entityType) {
    params.push(entityType);
    query += ` AND entity_type = $${params.length}`;
  }

  params.push(Number(limit) || 200);
  query += ` ORDER BY date_time_registration DESC LIMIT $${params.length}`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Conteo por entity_type para stats.
 */
const getCountsByUserId = async userId => {
  const result = await pool.query(
    `SELECT entity_type, COUNT(*)::int AS total
     FROM activity_logs
     WHERE user_id = $1
     GROUP BY entity_type`,
    [userId]
  );
  const counts = { login: 0, reservation: 0, field: 0, settings: 0, total: 0 };
  for (const row of result.rows) {
    counts[row.entity_type] = row.total;
    counts.total += row.total;
  }
  return counts;
};

module.exports = {
  logActivity,
  logActivityFromRequest,
  getLogsByUserId,
  getCountsByUserId,
  resolveIp,
  ACTIVITY_TYPES,
  ACTIVITY_STATUS,
};
