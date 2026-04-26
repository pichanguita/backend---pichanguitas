/**
 * E2E test: flujo completo de calificación post-pago.
 *
 * Este script valida el bug corregido:
 *   "El cliente no podía registrar una reseña tras cerrarse el pago."
 *
 * Pasos:
 *   1. Toma una reserva 'confirmed' con cliente que tenga user_id.
 *   2. Resetea su estado (revertir reseñas previas si las hay) para repetibilidad.
 *   3. Como super_admin: PUT /api/reservations/:id/complete (simula cierre de pago).
 *   4. Verifica en BD: status='completed', payment_status='fully_paid', reviewed=false.
 *   5. Simula `separateReservations` del frontend con la reserva tras el cambio.
 *   6. Como cliente: GET /api/reservations y filtra como hace `myReservations`.
 *   7. Como cliente: POST /api/reviews.
 *   8. Verifica en BD: reservations.reviewed=true, review_id, fila en reviews.
 *
 * Uso:
 *   node scripts/test-review-flow.js
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const BACKEND = `http://localhost:${process.env.PORT || 4009}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const PAST_STATUSES = ['cancelled', 'completed'];
const parseLocalDate = (date) => {
  if (date instanceof Date) return date;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(date);
};
const separateReservations = (myReservations) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = (res) => {
    const d = parseLocalDate(res.date);
    d.setHours(0, 0, 0, 0);
    return d < today || PAST_STATUSES.includes(res.status);
  };
  const active = [], past = [];
  myReservations.forEach((r) => (isPast(r) ? past.push(r) : active.push(r)));
  return { activeReservations: active, pastReservations: past };
};
const canReviewReservation = (reservation) => {
  if (!reservation) return false;
  if (reservation.reviewed) return false;
  if (reservation.status !== 'completed') return false;
  return parseLocalDate(reservation.date) < new Date();
};

const jwtFor = (user) =>
  jwt.sign(
    { id: user.id, id_rol: user.role_id, email: user.email, role: user.role, adminType: user.admin_type },
    process.env.JWT_SECRET,
    { expiresIn: '4h' }
  );

const apiCall = async (method, path, token, body) => {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
};

const assert = (cond, msg) => {
  if (cond) console.log(`  ${c.green('✓')} ${msg}`);
  else { console.log(`  ${c.red('✗')} ${msg}`); throw new Error(`Assertion failed: ${msg}`); }
};

const banner = (label) => console.log(`\n${c.bold(c.yellow('▶ ' + label))}`);

(async () => {
  let exitCode = 0;
  let createdReviewId = null;
  let reservationId = null;

  try {
    banner('Setup: localizar reserva apta y datos de actores');

    const reservationRow = await pool.query(`
      SELECT r.id, r.field_id, r.customer_id, r.date::text, r.start_time::text,
             r.status, r.payment_status, r.reviewed, r.review_id,
             c.user_id, u.email, u.role_id, u.admin_type, ro.name AS role
      FROM reservations r
      JOIN customers c ON c.id = r.customer_id
      JOIN users u ON u.id = c.user_id
      JOIN roles ro ON ro.id = u.role_id
      WHERE r.status IN ('confirmed', 'completed')
        AND r.date < CURRENT_DATE
      ORDER BY r.id ASC
      LIMIT 1
    `);
    if (reservationRow.rows.length === 0) {
      throw new Error('No hay reservas confirmed con cliente que tenga cuenta de usuario');
    }
    const r = reservationRow.rows[0];
    reservationId = r.id;
    console.log(`  Reserva: id=${r.id}, fecha=${r.date}, hora=${r.start_time}, customer_id=${r.customer_id}, user_id=${r.user_id} (${r.email})`);
    console.log(`  Estado inicial: status='${r.status}', payment_status='${r.payment_status}', reviewed=${r.reviewed}`);

    const adminRow = await pool.query(`
      SELECT u.id, u.email, u.role_id, u.admin_type, ro.name AS role
      FROM users u JOIN roles ro ON ro.id = u.role_id
      WHERE ro.name = 'super_admin' AND u.is_active = true LIMIT 1
    `);
    const admin = adminRow.rows[0];
    console.log(`  Super admin: id=${admin.id} (${admin.email})`);

    banner('Reset: dejar la reserva en estado de prueba reproducible');
    if (r.reviewed) {
      await pool.query('DELETE FROM reviews WHERE reservation_id = $1', [r.id]);
      await pool.query('UPDATE reservations SET reviewed = false, review_id = NULL WHERE id = $1', [r.id]);
      console.log(`  Reseña anterior limpiada`);
    }
    await pool.query(`
      UPDATE reservations
      SET status = 'confirmed', payment_status = 'pending',
          advance_payment = 0, remaining_payment = total_price,
          completed_at = NULL
      WHERE id = $1`, [r.id]);
    console.log(`  Reserva reseteada a status='confirmed', payment_status='pending'`);

    const adminToken = jwtFor(admin);
    const customer = { id: r.user_id, email: r.email, role_id: r.role_id, admin_type: r.admin_type, role: r.role };
    const customerToken = jwtFor(customer);

    banner('Paso 1: admin cierra el pago — PUT /api/reservations/:id/complete');
    const completeRes = await apiCall('PUT', `/api/reservations/${r.id}/complete`, adminToken);
    console.log(`  HTTP ${completeRes.status}`);
    assert(completeRes.ok, 'Endpoint /complete responde 2xx');
    assert(completeRes.data.success === true, 'Respuesta indica success=true');

    banner('Paso 2: verificar BD tras cierre de pago');
    const after = await pool.query(`
      SELECT status, payment_status, reviewed, review_id, completed_at, advance_payment, remaining_payment, total_price
      FROM reservations WHERE id = $1
    `, [r.id]);
    const a = after.rows[0];
    console.log(`  status='${a.status}', payment_status='${a.payment_status}', reviewed=${a.reviewed}, completed_at=${a.completed_at}`);
    console.log(`  total=${a.total_price}, advance=${a.advance_payment}, remaining=${a.remaining_payment}`);
    assert(a.status === 'completed', "BD: status='completed'");
    assert(a.payment_status === 'fully_paid', "BD: payment_status='fully_paid'");
    assert(a.reviewed === false, 'BD: reviewed=false (aún no calificada)');
    assert(a.completed_at !== null, 'BD: completed_at registrado');
    assert(parseFloat(a.advance_payment) === parseFloat(a.total_price), 'BD: advance_payment = total_price');
    assert(parseFloat(a.remaining_payment) === 0, 'BD: remaining_payment = 0');

    banner('Paso 3: cliente carga sus reservas — GET /api/reservations');
    const listRes = await apiCall('GET', '/api/reservations', customerToken);
    assert(listRes.ok, 'GET /api/reservations responde 2xx');
    const myReservations = (listRes.data.data || []).filter(
      (res) => res.customerId === r.customer_id || res.customer_id === r.customer_id
    );
    const target = myReservations.find((x) => x.id === r.id);
    assert(target !== undefined, `Reserva ${r.id} llega al listado del cliente`);
    console.log(`  Reserva en listado del cliente: status='${target.status}', reviewed=${target.reviewed}`);

    banner('Paso 4: aplicar separateReservations (idéntica a frontend)');
    const { activeReservations, pastReservations } = separateReservations([target]);
    console.log(`  activas=${activeReservations.length}, historial=${pastReservations.length}`);
    assert(pastReservations.length === 1 && activeReservations.length === 0,
      'La reserva completed cae en pestaña Historial (PAST_STATUSES.includes(completed))');

    banner('Paso 5: validar canReviewReservation');
    const canReview = canReviewReservation(target);
    console.log(`  canReview=${canReview}`);
    assert(canReview === true, 'canReviewReservation devuelve true → botón "Calificar" visible');

    banner('Paso 6: cliente envía la reseña — POST /api/reviews');
    const reviewBody = {
      reservation_id: r.id,
      field_id: r.field_id,
      customer_id: r.customer_id,
      customer_name: 'Test E2E',
      cleanliness: 5,
      service: 4,
      facilities: 5,
      comment: 'Validación automatizada del flujo de calificación.',
    };
    const reviewRes = await apiCall('POST', '/api/reviews', customerToken, reviewBody);
    console.log(`  HTTP ${reviewRes.status}`);
    if (!reviewRes.ok) console.log(`  Respuesta: ${JSON.stringify(reviewRes.data)}`);
    assert(reviewRes.ok, 'POST /api/reviews responde 2xx');
    assert(reviewRes.data.success === true, 'Respuesta indica success=true');
    createdReviewId = reviewRes.data.data?.id;
    assert(createdReviewId, 'Respuesta incluye id de reseña creada');

    banner('Paso 7: verificar BD tras envío de reseña');
    const finalRes = await pool.query(`
      SELECT r.reviewed, r.review_id,
             rev.id AS rev_id, rev.cleanliness, rev.service, rev.facilities,
             rev.overall_rating, rev.comment, rev.is_visible
      FROM reservations r
      LEFT JOIN reviews rev ON rev.reservation_id = r.id
      WHERE r.id = $1
    `, [r.id]);
    const f = finalRes.rows[0];
    console.log(`  reservations.reviewed=${f.reviewed}, review_id=${f.review_id}`);
    console.log(`  reviews row: id=${f.rev_id}, ratings=[clean=${f.cleanliness}, service=${f.service}, facilities=${f.facilities}], overall=${f.overall_rating}`);
    assert(f.reviewed === true, 'BD: reservations.reviewed=true');
    assert(f.review_id === createdReviewId, 'BD: reservations.review_id apunta a la reseña creada');
    assert(f.rev_id === createdReviewId, 'BD: existe fila en reviews con ese id');
    assert(parseFloat(f.overall_rating) === parseFloat(((5 + 4 + 5) / 3).toFixed(2)),
      'BD: overall_rating = avg(cleanliness, service, facilities)');

    banner('Paso 8: validar que canReview=false tras calificar');
    const targetAfter = { ...target, reviewed: true };
    const canReviewAfter = canReviewReservation(targetAfter);
    assert(canReviewAfter === false, 'canReviewReservation=false con reviewed=true (botón se oculta y muestra "Ya calificaste")');

    banner('Paso 9: doble envío rechazado por backend');
    const dup = await apiCall('POST', '/api/reviews', customerToken, reviewBody);
    assert(dup.status === 409, 'Segundo POST /api/reviews para misma reserva → 409 Conflict');

    console.log(`\n${c.green(c.bold('✅ TODOS LOS PASOS PASARON. Bug original confirmado como resuelto.'))}\n`);
  } catch (err) {
    exitCode = 1;
    console.error(`\n${c.red(c.bold('❌ FALLO:'))} ${err.message}\n`);
    if (err.stack) console.error(err.stack);
  } finally {
    banner('Limpieza: revertir BD al estado previo a la prueba');
    try {
      if (reservationId) {
        if (createdReviewId) {
          await pool.query('DELETE FROM reviews WHERE id = $1', [createdReviewId]);
          console.log(`  Reseña ${createdReviewId} eliminada`);
        }
        await pool.query(`
          UPDATE reservations
          SET status = 'confirmed', payment_status = 'pending',
              advance_payment = 0, remaining_payment = total_price,
              completed_at = NULL, reviewed = false, review_id = NULL
          WHERE id = $1`, [reservationId]);
        console.log(`  Reserva ${reservationId} restaurada a estado original`);
      }
    } catch (cleanupErr) {
      console.error(`  ⚠️  Error en cleanup: ${cleanupErr.message}`);
    }
    await pool.end();
    process.exit(exitCode);
  }
})();
