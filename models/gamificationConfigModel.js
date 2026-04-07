const pool = require('../config/db');

/**
 * Obtener toda la configuración de gamificación
 * @returns {Promise<Object>} Objeto con todas las configuraciones
 */
const getAllConfig = async () => {
  const query = `SELECT config_key, config_value FROM gamification_config`;
  const result = await pool.query(query);

  // Convertir array a objeto
  const config = {};
  result.rows.forEach((row) => {
    // Convertir strings 'true'/'false' a booleanos
    if (row.config_value === 'true') {
      config[row.config_key] = true;
    } else if (row.config_value === 'false') {
      config[row.config_key] = false;
    } else {
      config[row.config_key] = row.config_value;
    }
  });

  return config;
};

/**
 * Obtener una configuración específica
 * @param {string} key - Clave de la configuración
 * @returns {Promise<string|null>} Valor de la configuración
 */
const getConfigByKey = async (key) => {
  const query = `SELECT config_value FROM gamification_config WHERE config_key = $1`;
  const result = await pool.query(query, [key]);
  return result.rows.length > 0 ? result.rows[0].config_value : null;
};

/**
 * Actualizar una configuración
 * @param {string} key - Clave de la configuración
 * @param {string} value - Nuevo valor
 * @param {number} userId - ID del usuario que modifica
 * @returns {Promise<boolean>} True si se actualizó correctamente
 */
const updateConfig = async (key, value, userId = null) => {
  const query = `
    UPDATE gamification_config
    SET config_value = $1,
        user_id_modification = $2,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE config_key = $3
    RETURNING *
  `;
  const result = await pool.query(query, [String(value), userId, key]);
  return result.rows.length > 0;
};

/**
 * Actualizar múltiples configuraciones
 * @param {Object} configs - Objeto con las configuraciones a actualizar
 * @param {number} userId - ID del usuario que modifica
 * @returns {Promise<Object>} Configuraciones actualizadas
 */
const updateMultipleConfig = async (configs, userId = null) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const [key, value] of Object.entries(configs)) {
      await client.query(
        `UPDATE gamification_config
         SET config_value = $1,
             user_id_modification = $2,
             date_time_modification = CURRENT_TIMESTAMP
         WHERE config_key = $3`,
        [String(value), userId, key]
      );
    }

    await client.query('COMMIT');

    // Retornar configuración actualizada
    return await getAllConfig();
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllConfig,
  getConfigByKey,
  updateConfig,
  updateMultipleConfig,
};
