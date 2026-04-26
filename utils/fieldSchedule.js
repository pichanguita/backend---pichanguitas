const { toTimeString } = require('./transformers');

const WEEK_DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Expresión SQL reutilizable para ordenar filas por día de la semana (lunes..domingo).
 * Puede interpolarse directamente dentro de un ORDER BY; no recibe parámetros de usuario.
 * Acepta opcionalmente un alias (ej. 'fs') para calificar la columna.
 * @param {string} [columnExpr='day_of_week'] - columna o expresión del día de la semana
 * @returns {string}
 */
const weekDayOrderSql = (columnExpr = 'day_of_week') => `CASE ${columnExpr}
  WHEN 'monday' THEN 1
  WHEN 'tuesday' THEN 2
  WHEN 'wednesday' THEN 3
  WHEN 'thursday' THEN 4
  WHEN 'friday' THEN 5
  WHEN 'saturday' THEN 6
  WHEN 'sunday' THEN 7
END`;

const WEEK_DAY_LABELS_ES = {
  monday: 'lunes',
  tuesday: 'martes',
  wednesday: 'miércoles',
  thursday: 'jueves',
  friday: 'viernes',
  saturday: 'sábado',
  sunday: 'domingo',
};

/**
 * Obtiene la clave en inglés del día de la semana (monday..sunday) para un date string YYYY-MM-DD.
 * Usa hora 12:00 UTC para evitar saltos por zona horaria.
 * @param {string} dateStr
 * @returns {string|null}
 */
const getDayOfWeekKey = dateStr => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return null;
  const [, y, m, d] = match;
  const utcDate = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12));
  return WEEK_DAY_KEYS[utcDate.getUTCDay()];
};

/**
 * Busca la fila de field_schedules aplicable a una fecha específica.
 * @param {Array} scheduleRows - filas snake_case (de getFieldSchedulesRows)
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {Object|null} fila snake_case o null si no hay configuración para ese día
 */
const findScheduleRowForDate = (scheduleRows, dateStr) => {
  if (!Array.isArray(scheduleRows) || scheduleRows.length === 0) return null;
  const dayKey = getDayOfWeekKey(dateStr);
  if (!dayKey) return null;
  return (
    scheduleRows.find(row => String(row.day_of_week || '').toLowerCase() === dayKey) || null
  );
};

/**
 * Valida una ventana horaria contra el horario operativo configurado.
 * Convención: si la cancha NO tiene schedule configurado para ese día → se permite (abierta).
 * Si la fila existe, se respeta is_open + open_time + close_time.
 *
 * @param {Array} scheduleRows - filas snake_case de field_schedules
 * @param {string} date - 'YYYY-MM-DD'
 * @param {string} startTime - 'HH:MM' o 'HH:MM:SS'
 * @param {string} endTime - 'HH:MM' o 'HH:MM:SS'
 * @returns {{ ok: true } | { ok: false, code: string, error: string, dayKey: string, openTime: string|null, closeTime: string|null }}
 */
const validateReservationAgainstSchedule = (scheduleRows, date, startTime, endTime) => {
  const dayKey = getDayOfWeekKey(date);
  const row = findScheduleRowForDate(scheduleRows, date);

  if (!row) return { ok: true };

  const openTime = toTimeString(row.open_time);
  const closeTime = toTimeString(row.close_time);
  const dayLabel = WEEK_DAY_LABELS_ES[dayKey] || dayKey;

  if (row.is_open === false) {
    return {
      ok: false,
      code: 'FIELD_CLOSED_ON_DAY',
      error: `Esta cancha no opera los ${dayLabel}. Selecciona otro día.`,
      dayKey,
      openTime,
      closeTime,
    };
  }

  const start = toTimeString(startTime);
  const end = toTimeString(endTime);

  if (openTime && start && start < openTime) {
    return {
      ok: false,
      code: 'OUTSIDE_OPERATING_HOURS',
      error: `La cancha abre a las ${openTime.slice(0, 5)} los ${dayLabel}.`,
      dayKey,
      openTime,
      closeTime,
    };
  }

  if (closeTime && end && end > closeTime) {
    return {
      ok: false,
      code: 'OUTSIDE_OPERATING_HOURS',
      error: `La cancha cierra a las ${closeTime.slice(0, 5)} los ${dayLabel}.`,
      dayKey,
      openTime,
      closeTime,
    };
  }

  return { ok: true };
};

module.exports = {
  WEEK_DAY_KEYS,
  WEEK_DAY_LABELS_ES,
  weekDayOrderSql,
  getDayOfWeekKey,
  findScheduleRowForDate,
  validateReservationAgainstSchedule,
};
