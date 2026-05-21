const pool = require('../config/db');

/**
 * Obtener todas las amenities del catálogo (activas por defecto).
 * @param {boolean} onlyActive
 */
const getAllAmenities = async (onlyActive = true) => {
  const query = `
    SELECT id, key, label, icon_name, color_class, sort_order, is_active
    FROM amenities_catalog
    ${onlyActive ? 'WHERE is_active = TRUE' : ''}
    ORDER BY sort_order ASC, id ASC
  `;
  const result = await pool.query(query);
  return result.rows;
};

/**
 * Obtener amenidad por key (slug estable).
 */
const getAmenityByKey = async (key) => {
  const result = await pool.query(
    'SELECT id, key, label, icon_name, color_class, sort_order, is_active FROM amenities_catalog WHERE key = $1',
    [key]
  );
  return result.rows[0] || null;
};

/**
 * Resolver array de keys → array de IDs (en el mismo orden que llegan).
 * Las keys inexistentes se descartan silenciosamente.
 */
const resolveKeysToIds = async (keys = []) => {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  const result = await pool.query(
    'SELECT id, key FROM amenities_catalog WHERE key = ANY($1::varchar[])',
    [keys]
  );
  const byKey = new Map(result.rows.map((row) => [row.key, row.id]));
  return keys.map((k) => byKey.get(k)).filter((id) => typeof id === 'number');
};

module.exports = {
  getAllAmenities,
  getAmenityByKey,
  resolveKeysToIds,
};
