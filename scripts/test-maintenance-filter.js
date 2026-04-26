/**
 * E2E test: filtrar canchas por mantenimiento contra fecha de reserva.
 *
 * Reproduce y valida la corrección del bug:
 *   "Cancha en mantenimiento hasta el 19/04 no aparece como disponible
 *    cuando se intenta reservar para el 20/04 (post-mantenimiento)."
 *
 * Pasos:
 *   1. Asegura un mantenimiento ACTIVO sobre la cancha 1 (rango pasado/hoy/futuro).
 *   2. Llama a `GET /api/fields` y valida que la respuesta incluya
 *      `maintenanceSchedules` con startDate/endDate.
 *   3. Simula la función `filterAvailableFields` del frontend para varias
 *      fechas (antes, durante, después del rango) y verifica que solo se
 *      excluya cuando la fecha pedida cae DENTRO del rango.
 *   4. Restaura BD borrando los datos de prueba.
 */

require('dotenv').config();
const { Pool } = require('pg');

const BACKEND = `http://127.0.0.1:${process.env.PORT || 4009}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};
const banner = (label) => console.log(`\n${c.bold(c.yellow('▶ ' + label))}`);
const assert = (cond, msg) => {
  if (cond) console.log(`  ${c.green('✓')} ${msg}`);
  else { console.log(`  ${c.red('✗')} ${msg}`); throw new Error(`Assertion failed: ${msg}`); }
};

// Réplica de la función isFieldReservableOnDate del frontend
const NON_RESERVABLE = new Set(['closed', 'pending', 'inactive', 'unavailable', 'rejected']);
const isUnderMaintenance = (field, date) => {
  if (!field || !date) return false;
  const ms = field.maintenanceSchedules;
  if (!Array.isArray(ms) || ms.length === 0) return false;
  return ms.some((m) => {
    const s = m.startDate || m.start_date;
    const e = m.endDate || m.end_date;
    return s && e && s <= date && date <= e;
  });
};
const isReservable = (field, date) => {
  if (!field) return false;
  if (NON_RESERVABLE.has(field.status)) return false;
  if (isUnderMaintenance(field, date)) return false;
  return true;
};

(async () => {
  let exitCode = 0;
  let createdMaintenanceId = null;
  let originalFieldStatus = null;

  try {
    banner('Setup: garantizar mantenimiento activo en cancha 1');

    const fieldRes = await pool.query('SELECT status FROM fields WHERE id = 1');
    if (fieldRes.rows.length === 0) throw new Error('Cancha id=1 no existe en BD');
    originalFieldStatus = fieldRes.rows[0].status;

    // Asegurar al menos un mantenimiento que cubra HOY (start_date <= today <= end_date).
    const ensureRes = await pool.query(`
      INSERT INTO field_maintenance_schedules (field_id, start_date, end_date, reason, user_id_registration)
      VALUES (1, CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '2 days',
              'TEST automatizado filtro fechas', 1)
      RETURNING id, start_date::text, end_date::text
    `);
    const created = ensureRes.rows[0];
    createdMaintenanceId = created.id;
    console.log(`  Mantenimiento creado: id=${created.id} (${created.start_date} → ${created.end_date})`);

    await pool.query("UPDATE fields SET status = 'maintenance' WHERE id = 1");
    console.log(`  Cancha 1: status forzado a 'maintenance' (estado de HOY)`);

    banner('Paso 1: GET /api/fields debe exponer maintenanceSchedules');
    const fieldsRes = await fetch(`${BACKEND}/api/fields`);
    if (!fieldsRes.ok) throw new Error(`HTTP ${fieldsRes.status}`);
    const payload = await fieldsRes.json();
    const field1 = (payload.data || []).find((f) => f.id === 1);
    assert(!!field1, 'Cancha 1 está en respuesta');
    assert(Array.isArray(field1.maintenanceSchedules), 'Tiene array maintenanceSchedules');
    assert(field1.maintenanceSchedules.length >= 1, 'Trae al menos 1 mantenimiento');
    const m = field1.maintenanceSchedules.find((x) => x.id === createdMaintenanceId);
    assert(!!m, 'El mantenimiento de prueba está presente');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(m.startDate), 'startDate en formato YYYY-MM-DD');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(m.endDate), 'endDate en formato YYYY-MM-DD');
    console.log(`  Mantenimiento expuesto: ${m.startDate} → ${m.endDate}`);

    banner('Paso 2: cancha 1 NO reservable durante el rango');
    const start = m.startDate;
    const end = m.endDate;
    assert(isReservable(field1, start) === false, `${start} (límite inicio) → no reservable`);
    assert(isReservable(field1, end) === false, `${end} (límite fin) → no reservable`);
    const middle = new Date(new Date(start).getTime() + 86400000)
      .toISOString().slice(0, 10);
    assert(isReservable(field1, middle) === false, `${middle} (medio) → no reservable`);

    banner('Paso 3: cancha 1 SÍ reservable fuera del rango (caso del bug)');
    const dayBefore = new Date(new Date(start).getTime() - 86400000).toISOString().slice(0, 10);
    const dayAfter = new Date(new Date(end).getTime() + 86400000).toISOString().slice(0, 10);
    const weekAfter = new Date(new Date(end).getTime() + 7 * 86400000).toISOString().slice(0, 10);
    assert(isReservable(field1, dayBefore) === true, `${dayBefore} (día previo) → reservable ✓`);
    assert(isReservable(field1, dayAfter) === true, `${dayAfter} (día siguiente al fin) → reservable ✓ — bug original corregido`);
    assert(isReservable(field1, weekAfter) === true, `${weekAfter} (semana después) → reservable`);

    banner('Paso 4: status administrativo (closed/pending/etc.) sigue bloqueando');
    const closedField = { ...field1, status: 'closed' };
    assert(isReservable(closedField, dayAfter) === false, 'status=closed → no reservable aunque la fecha esté fuera del mantenimiento');
    const pendingField = { ...field1, status: 'pending' };
    assert(isReservable(pendingField, dayAfter) === false, 'status=pending → no reservable');

    console.log(`\n${c.green(c.bold('✅ TODOS LOS PASOS PASARON. Bug del filtro de mantenimiento por fecha corregido.'))}\n`);
  } catch (err) {
    exitCode = 1;
    console.error(`\n${c.red(c.bold('❌ FALLO:'))} ${err.message}\n`);
    if (err.stack) console.error(err.stack);
  } finally {
    banner('Limpieza: eliminar mantenimiento de prueba y restaurar status');
    try {
      if (createdMaintenanceId) {
        await pool.query('DELETE FROM field_maintenance_schedules WHERE id = $1', [createdMaintenanceId]);
        console.log(`  Mantenimiento ${createdMaintenanceId} eliminado`);
      }
      if (originalFieldStatus) {
        await pool.query('UPDATE fields SET status = $1 WHERE id = 1', [originalFieldStatus]);
        console.log(`  Cancha 1: status restaurado a '${originalFieldStatus}'`);
      }
    } catch (cleanupErr) {
      console.error(`  ⚠️  Error en cleanup: ${cleanupErr.message}`);
    }
    await pool.end();
    process.exit(exitCode);
  }
})();
