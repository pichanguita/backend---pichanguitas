const pool = require('../config/db');

/**
 * Convierte un slot ID (ej: '6am', '12pm', '1pm') a formato HH:00
 * @param {string} slotId - ID del slot
 * @returns {string|null} Hora en formato HH:00
 */
const slotIdToTime = slotId => {
  const match = slotId.match(/^(\d+)(am|pm)$/i);
  if (!match) return null;
  let hour = parseInt(match[1]);
  const period = match[2].toLowerCase();
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, '0')}:00`;
};

/**
 * Verifica si una hora cae dentro de alguno de los rangos de tiempo JSONB
 * Si no hay rangos definidos, aplica a todas las horas
 * @param {string} timeStr - Hora en formato HH:00
 * @param {Array|null} timeRanges - Array de {start, end}
 * @returns {boolean}
 */
const isTimeInRanges = (timeStr, timeRanges) => {
  if (!timeRanges || !Array.isArray(timeRanges) || timeRanges.length === 0) return true;
  return timeRanges.some(r => timeStr >= r.start && timeStr < r.end);
};

/**
 * Obtener todos los precios especiales con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de precios especiales
 */
const getAllFieldSpecialPricing = async (filters = {}) => {
  let query = `
    SELECT
      fsp.id,
      fsp.field_id,
      fsp.name,
      fsp.description,
      fsp.price,
      fsp.is_active,
      fsp.status,
      fsp.time_ranges,
      fsp.days,
      fsp.user_id_registration,
      fsp.date_time_registration,
      fsp.user_id_modification,
      fsp.date_time_modification,
      f.name AS field_name
    FROM field_special_pricing fsp
    LEFT JOIN fields f ON fsp.field_id = f.id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  if (filters.field_id) {
    query += ` AND fsp.field_id = $${paramCount}`;
    params.push(filters.field_id);
    paramCount++;
  }

  if (filters.is_active !== undefined) {
    query += ` AND fsp.is_active = $${paramCount}`;
    params.push(filters.is_active);
    paramCount++;
  }

  if (filters.status) {
    query += ` AND fsp.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  if (filters.search) {
    query += ` AND fsp.name ILIKE $${paramCount}`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` ORDER BY fsp.field_id, fsp.is_active DESC, fsp.name ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtener un precio especial por ID
 * @param {number} id - ID del precio especial
 * @returns {Promise<Object|null>} Precio especial o null
 */
const getFieldSpecialPricingById = async id => {
  const query = `
    SELECT fsp.*, f.name AS field_name
    FROM field_special_pricing fsp
    LEFT JOIN fields f ON fsp.field_id = f.id
    WHERE fsp.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener precios especiales de una cancha especifica
 * @param {number} field_id - ID de la cancha
 * @returns {Promise<Array>} Lista de precios especiales
 */
const getSpecialPricingByFieldId = async field_id => {
  const query = `
    SELECT
      fsp.id,
      fsp.field_id,
      fsp.name,
      fsp.description,
      fsp.price,
      fsp.is_active,
      fsp.status,
      fsp.time_ranges,
      fsp.days,
      fsp.user_id_registration,
      fsp.date_time_registration,
      fsp.user_id_modification,
      fsp.date_time_modification
    FROM field_special_pricing fsp
    WHERE fsp.field_id = $1
    ORDER BY fsp.is_active DESC, fsp.name ASC
  `;

  const result = await pool.query(query, [field_id]);
  return result.rows;
};

/**
 * Crear un nuevo precio especial
 * @param {Object} pricingData - Datos del precio especial
 * @returns {Promise<Object>} Precio especial creado
 */
const createFieldSpecialPricing = async pricingData => {
  const {
    field_id,
    name,
    description,
    price,
    time_ranges = null,
    days = null,
    is_active = true,
    status = 'active',
    user_id_registration,
  } = pricingData;

  const query = `
    INSERT INTO field_special_pricing (
      field_id, name, description, price,
      time_ranges, days,
      is_active, status,
      user_id_registration, date_time_registration
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    field_id,
    name,
    description,
    price,
    time_ranges ? JSON.stringify(time_ranges) : null,
    days ? JSON.stringify(days.map(d => d.toLowerCase())) : null,
    is_active,
    status,
    user_id_registration,
  ]);

  return result.rows[0];
};

/**
 * Actualizar un precio especial
 * @param {number} id - ID del precio especial
 * @param {Object} pricingData - Datos a actualizar
 * @returns {Promise<Object|null>} Precio especial actualizado o null
 */
const updateFieldSpecialPricing = async (id, pricingData) => {
  const {
    name,
    description,
    price,
    time_ranges,
    days,
    is_active,
    status,
    user_id_modification,
  } = pricingData;

  const timeRangesJson =
    time_ranges !== undefined
      ? time_ranges
        ? JSON.stringify(time_ranges)
        : null
      : null;

  const daysJson =
    days !== undefined
      ? days
        ? JSON.stringify(days.map(d => d.toLowerCase()))
        : null
      : null;

  const query = `
    UPDATE field_special_pricing
    SET name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        time_ranges = COALESCE($4::jsonb, time_ranges),
        days = COALESCE($5::jsonb, days),
        is_active = COALESCE($6, is_active),
        status = COALESCE($7, status),
        user_id_modification = $8,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *
  `;

  const result = await pool.query(query, [
    name,
    description,
    price,
    timeRangesJson,
    daysJson,
    is_active,
    status,
    user_id_modification,
    id,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar un precio especial (soft delete)
 * @param {number} id - ID del precio especial
 * @param {number} user_id_modification - ID del usuario
 * @returns {Promise<boolean>} True si se elimino correctamente
 */
const deleteFieldSpecialPricing = async (id, user_id_modification) => {
  const query = `
    UPDATE field_special_pricing
    SET is_active = false,
        status = 'inactive',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0;
};

/**
 * Eliminar permanentemente un precio especial
 * @param {number} id - ID del precio especial
 * @returns {Promise<boolean>} True si se elimino correctamente
 */
const hardDeleteFieldSpecialPricing = async id => {
  const query = `
    DELETE FROM field_special_pricing
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows.length > 0;
};

/**
 * Verificar si existe un precio especial con el mismo nombre para una cancha
 * @param {number} field_id - ID de la cancha
 * @param {string} name - Nombre del precio especial
 * @param {number|null} excludeId - ID a excluir de la busqueda
 * @returns {Promise<boolean>} True si existe
 */
const specialPricingNameExists = async (field_id, name, excludeId = null) => {
  let query = `
    SELECT id FROM field_special_pricing
    WHERE field_id = $1 AND LOWER(name) = LOWER($2)
  `;
  const params = [field_id, name];

  if (excludeId) {
    query += ` AND id != $3`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

/**
 * Obtener precios especiales activos para una cancha en un dia y slot especificos
 * Usa columnas JSONB time_ranges y days para filtrar
 * @param {number} field_id - ID de la cancha
 * @param {string} day - Dia de la semana (monday, tuesday, etc.)
 * @param {string} slotId - ID del slot de tiempo (ej: '6am', '7pm')
 * @returns {Promise<Array>} Lista de precios especiales aplicables
 */
const getApplicableSpecialPricing = async (field_id, day, slotId) => {
  const query = `
    SELECT
      fsp.id,
      fsp.field_id,
      fsp.name,
      fsp.description,
      fsp.price,
      fsp.is_active,
      fsp.time_ranges,
      fsp.days
    FROM field_special_pricing fsp
    WHERE fsp.field_id = $1
      AND fsp.is_active = true
      AND fsp.status = 'active'
      AND (fsp.days IS NULL OR jsonb_array_length(fsp.days) = 0 OR fsp.days ? $2)
    ORDER BY fsp.price ASC
  `;

  const result = await pool.query(query, [field_id, day.toLowerCase()]);

  // Filtrar por rango de tiempo en JavaScript
  const timeStr = slotIdToTime(slotId);
  if (!timeStr) return [];

  return result.rows.filter(row => isTimeInRanges(timeStr, row.time_ranges));
};

/**
 * Obtener precios especiales activos para una cancha en un dia y multiples slots
 * Util para reservas de varias horas
 * @param {number} field_id - ID de la cancha
 * @param {string} day - Dia de la semana (monday, tuesday, etc.)
 * @param {Array<string>} slotIds - Array de IDs de slots de tiempo (ej: ['6am', '7am'])
 * @returns {Promise<Object>} Mapa de slotId -> precio especial aplicable
 */
const getApplicableSpecialPricingForSlots = async (field_id, day, slotIds) => {
  if (!slotIds || slotIds.length === 0) {
    return {};
  }

  // Obtener todos los precios especiales activos que aplican al dia
  const query = `
    SELECT
      fsp.id,
      fsp.name,
      fsp.description,
      fsp.price,
      fsp.time_ranges,
      fsp.days
    FROM field_special_pricing fsp
    WHERE fsp.field_id = $1
      AND fsp.is_active = true
      AND fsp.status = 'active'
      AND (fsp.days IS NULL OR jsonb_array_length(fsp.days) = 0 OR fsp.days ? $2)
    ORDER BY fsp.price DESC
  `;

  const result = await pool.query(query, [field_id, day.toLowerCase()]);
  const pricings = result.rows;

  // Para cada slot, encontrar el precio especial aplicable
  const pricingMap = {};
  for (const slotId of slotIds) {
    const timeStr = slotIdToTime(slotId);
    if (!timeStr) continue;

    // Buscar el primer pricing cuyo time_ranges incluya esta hora (o que no tenga rangos = aplica a todos)
    const applicable = pricings.find(p => isTimeInRanges(timeStr, p.time_ranges));

    if (applicable) {
      pricingMap[slotId] = {
        pricingId: applicable.id,
        name: applicable.name,
        description: applicable.description,
        discountValue: parseFloat(applicable.price) || 0,
        discountType: 'percentage',
      };
    }
  }

  return pricingMap;
};

module.exports = {
  getAllFieldSpecialPricing,
  getFieldSpecialPricingById,
  getSpecialPricingByFieldId,
  createFieldSpecialPricing,
  updateFieldSpecialPricing,
  deleteFieldSpecialPricing,
  hardDeleteFieldSpecialPricing,
  specialPricingNameExists,
  getApplicableSpecialPricing,
  getApplicableSpecialPricingForSlots,
};
