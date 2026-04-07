const pool = require('../config/db');

/**
 * GET /api/social-media
 * Obtener todas las redes sociales (público)
 */
const getAllSocialMedia = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, platform, url, icon, color, is_phone, enabled, order_index, status,
              date_time_registration, date_time_modification
       FROM social_media
       WHERE status = 'active'
       ORDER BY order_index ASC, id ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error al obtener redes sociales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener redes sociales',
      error: error.message,
    });
  }
};

/**
 * GET /api/social-media/enabled
 * Obtener solo las redes sociales habilitadas (para el footer público)
 */
const getEnabledSocialMedia = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, platform, url, icon, color, is_phone, enabled, order_index
       FROM social_media
       WHERE status = 'active' AND enabled = true AND url IS NOT NULL AND url != ''
       ORDER BY order_index ASC, id ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error al obtener redes sociales habilitadas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener redes sociales habilitadas',
      error: error.message,
    });
  }
};

/**
 * GET /api/social-media/:id
 * Obtener una red social por ID
 */
const getSocialMediaById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, platform, url, icon, color, is_phone, enabled, order_index, status,
              date_time_registration, date_time_modification
       FROM social_media
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Red social no encontrada',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al obtener red social:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener red social',
      error: error.message,
    });
  }
};

/**
 * POST /api/social-media
 * Crear una nueva red social
 */
const createSocialMedia = async (req, res) => {
  try {
    const { platform, url, icon, color, is_phone, enabled } = req.body;
    const userId = req.user?.id_usuario || null;

    // Validaciones básicas
    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la plataforma es requerido',
      });
    }

    // Obtener el máximo order_index actual
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM social_media'
    );
    const nextOrder = maxOrderResult.rows[0].next_order;

    const result = await pool.query(
      `INSERT INTO social_media
       (platform, url, icon, color, is_phone, enabled, order_index, status, user_id_registration, date_time_registration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, NOW())
       RETURNING id, platform, url, icon, color, is_phone, enabled, order_index, status, date_time_registration`,
      [
        platform,
        url || '',
        icon || 'LinkIcon',
        color || '#22c55e',
        is_phone || false,
        enabled !== undefined ? enabled : true,
        nextOrder,
        userId,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Red social creada correctamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al crear red social:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear red social',
      error: error.message,
    });
  }
};

/**
 * PUT /api/social-media/:id
 * Actualizar una red social
 */
const updateSocialMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { platform, url, icon, color, is_phone, enabled, order_index } = req.body;
    const userId = req.user?.id_usuario || null;

    // Verificar que existe
    const existingResult = await pool.query('SELECT id FROM social_media WHERE id = $1', [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Red social no encontrada',
      });
    }

    const result = await pool.query(
      `UPDATE social_media
       SET platform = COALESCE($1, platform),
           url = COALESCE($2, url),
           icon = COALESCE($3, icon),
           color = COALESCE($4, color),
           is_phone = COALESCE($5, is_phone),
           enabled = COALESCE($6, enabled),
           order_index = COALESCE($7, order_index),
           user_id_modification = $8,
           date_time_modification = NOW()
       WHERE id = $9
       RETURNING id, platform, url, icon, color, is_phone, enabled, order_index, status, date_time_modification`,
      [platform, url, icon, color, is_phone, enabled, order_index, userId, id]
    );

    res.json({
      success: true,
      message: 'Red social actualizada correctamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al actualizar red social:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar red social',
      error: error.message,
    });
  }
};

/**
 * PATCH /api/social-media/:id/toggle
 * Activar/desactivar una red social
 */
const toggleSocialMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id_usuario || null;

    const result = await pool.query(
      `UPDATE social_media
       SET enabled = NOT enabled,
           user_id_modification = $1,
           date_time_modification = NOW()
       WHERE id = $2
       RETURNING id, platform, enabled`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Red social no encontrada',
      });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      message: `${row.platform} ${row.enabled ? 'activada' : 'desactivada'} correctamente`,
      data: row,
    });
  } catch (error) {
    console.error('Error al cambiar estado de red social:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado de red social',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/social-media/:id
 * Eliminar una red social (soft delete)
 */
const deleteSocialMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id_usuario || null;

    const result = await pool.query(
      `UPDATE social_media
       SET status = 'deleted',
           user_id_modification = $1,
           date_time_modification = NOW()
       WHERE id = $2
       RETURNING id, platform`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Red social no encontrada',
      });
    }

    res.json({
      success: true,
      message: `${result.rows[0].platform} eliminada correctamente`,
    });
  } catch (error) {
    console.error('Error al eliminar red social:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar red social',
      error: error.message,
    });
  }
};

/**
 * PUT /api/social-media/bulk
 * Actualizar múltiples redes sociales (para sincronización completa)
 */
const bulkUpdateSocialMedia = async (req, res) => {
  try {
    const { socialMedia } = req.body;
    const userId = req.user?.id_usuario || null;

    if (!Array.isArray(socialMedia)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de redes sociales',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const results = [];

      for (let i = 0; i < socialMedia.length; i++) {
        const item = socialMedia[i];

        if (item.id && typeof item.id === 'number') {
          // Actualizar existente
          const updateResult = await client.query(
            `UPDATE social_media
             SET platform = $1, url = $2, icon = $3, color = $4, is_phone = $5,
                 enabled = $6, order_index = $7, user_id_modification = $8, date_time_modification = NOW()
             WHERE id = $9
             RETURNING *`,
            [
              item.platform || item.name,
              item.url || '',
              item.icon || 'LinkIcon',
              item.color || '#22c55e',
              item.is_phone || item.isPhone || false,
              item.enabled !== undefined ? item.enabled : true,
              i,
              userId,
              item.id,
            ]
          );
          if (updateResult.rows.length > 0) {
            results.push(updateResult.rows[0]);
          }
        } else {
          // Crear nuevo
          const insertResult = await client.query(
            `INSERT INTO social_media
             (platform, url, icon, color, is_phone, enabled, order_index, status, user_id_registration, date_time_registration)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, NOW())
             RETURNING *`,
            [
              item.platform || item.name,
              item.url || '',
              item.icon || 'LinkIcon',
              item.color || '#22c55e',
              item.is_phone || item.isPhone || false,
              item.enabled !== undefined ? item.enabled : true,
              i,
              userId,
            ]
          );
          results.push(insertResult.rows[0]);
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Redes sociales sincronizadas correctamente',
        data: results,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al sincronizar redes sociales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al sincronizar redes sociales',
      error: error.message,
    });
  }
};

module.exports = {
  getAllSocialMedia,
  getEnabledSocialMedia,
  getSocialMediaById,
  createSocialMedia,
  updateSocialMedia,
  toggleSocialMedia,
  deleteSocialMedia,
  bulkUpdateSocialMedia,
};
