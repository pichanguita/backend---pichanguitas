const { getAllAmenities } = require('../models/amenitiesCatalogModel');

/**
 * GET /api/amenities-catalog
 * Devuelve el catálogo de amenidades disponibles (público).
 * El cliente lo usa para pintar checkboxes (admin) e íconos (cliente)
 * sin hardcoding.
 */
const listAmenities = async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const amenities = await getAllAmenities(!includeInactive);
    res.json({
      success: true,
      data: amenities,
      count: amenities.length,
    });
  } catch (error) {
    console.error('Error al obtener catálogo de amenidades:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener catálogo de amenidades',
    });
  }
};

module.exports = { listAmenities };
