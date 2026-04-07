/**
 * CRON JOB: Actualización Automática de Estados de Mantenimiento
 *
 * Este job se ejecuta diariamente para sincronizar el estado de las canchas
 * basándose en los mantenimientos programados.
 *
 * Lógica:
 * - Si HOY está entre start_date y end_date → status = 'maintenance'
 * - Si no hay mantenimiento activo → status = 'available'
 * - Respeta estados 'closed' y 'pending' (no los modifica)
 *
 * Ejecución: Diaria a las 00:01 (medianoche)
 */

const pool = require('../config/db');

/**
 * Actualiza el estado de todas las canchas basándose en mantenimientos activos
 * @returns {Promise<Object>} Resumen de la actualización
 */
const updateFieldMaintenanceStatus = async () => {
  const startTime = Date.now();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // IMPORTANTE: Usar zona horaria de Perú (UTC-5) para comparar fechas correctamente
    // toLocaleDateString con locale 'en-CA' devuelve formato YYYY-MM-DD
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    // PASO 1: Identificar canchas con mantenimiento ACTIVO
    const activeMaintenanceQuery = `
      SELECT DISTINCT f.id, f.name, f.status as current_status, fm.start_date, fm.end_date, fm.reason
      FROM fields f
      INNER JOIN field_maintenance_schedules fm ON f.id = fm.field_id
      WHERE fm.start_date <= $1
        AND fm.end_date >= $1
        AND f.status != 'closed'
        AND f.status != 'pending'
        AND f.is_active = true
      ORDER BY f.id
    `;

    const activeMaintenanceResult = await client.query(activeMaintenanceQuery, [today]);
    const fieldsWithActiveMaintenance = activeMaintenanceResult.rows;

    // PASO 2: Actualizar canchas a estado 'maintenance'
    let updatedToMaintenanceCount = 0;

    if (fieldsWithActiveMaintenance.length > 0) {
      const fieldIdsToUpdate = fieldsWithActiveMaintenance.map(f => f.id);

      const updateToMaintenanceQuery = `
        UPDATE fields
        SET status = 'maintenance',
            user_id_modification = 1,
            date_time_modification = CURRENT_TIMESTAMP
        WHERE id = ANY($1::int[])
          AND status != 'maintenance'
          AND status != 'closed'
          AND status != 'pending'
        RETURNING id, name, status
      `;

      const updateToMaintenanceResult = await client.query(updateToMaintenanceQuery, [
        fieldIdsToUpdate,
      ]);
      updatedToMaintenanceCount = updateToMaintenanceResult.rowCount;
    }

    // PASO 3: Identificar canchas SIN mantenimiento activo
    const noActiveMaintenanceQuery = `
      SELECT f.id, f.name, f.status as current_status
      FROM fields f
      WHERE f.status = 'maintenance'
        AND f.is_active = true
        AND NOT EXISTS (
          SELECT 1
          FROM field_maintenance_schedules fm
          WHERE fm.field_id = f.id
            AND fm.start_date <= $1
            AND fm.end_date >= $1
        )
      ORDER BY f.id
    `;

    const noActiveMaintenanceResult = await client.query(noActiveMaintenanceQuery, [today]);
    const fieldsToReactivate = noActiveMaintenanceResult.rows;

    // PASO 4: Reactivar canchas (maintenance → available)
    let updatedToAvailableCount = 0;

    if (fieldsToReactivate.length > 0) {
      const fieldIdsToReactivate = fieldsToReactivate.map(f => f.id);

      const updateToAvailableQuery = `
        UPDATE fields
        SET status = 'available',
            user_id_modification = 1,
            date_time_modification = CURRENT_TIMESTAMP
        WHERE id = ANY($1::int[])
          AND status = 'maintenance'
        RETURNING id, name, status
      `;

      const updateToAvailableResult = await client.query(updateToAvailableQuery, [
        fieldIdsToReactivate,
      ]);
      updatedToAvailableCount = updateToAvailableResult.rowCount;
    }

    // COMMIT
    await client.query('COMMIT');

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      timestamp: new Date().toISOString(),
      executionTime,
      summary: {
        activeMaintenances: fieldsWithActiveMaintenance.length,
        updatedToMaintenance: updatedToMaintenanceCount,
        updatedToAvailable: updatedToAvailableCount,
        totalChanges: updatedToMaintenanceCount + updatedToAvailableCount,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CRON] Error actualizando estados de mantenimiento:', error.message);

    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  } finally {
    client.release();
  }
};

/**
 * Ejecuta el job manualmente (útil para testing o ejecución inmediata)
 */
const runManualUpdate = async () => {
  return await updateFieldMaintenanceStatus();
};

module.exports = {
  updateFieldMaintenanceStatus,
  runManualUpdate,
};
