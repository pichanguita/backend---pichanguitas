const express = require('express');

const { listAmenities } = require('../controllers/amenitiesCatalogController');

const router = express.Router();

// GET /api/amenities-catalog
// PÚBLICO: tanto el admin (form de crear/editar cancha) como el cliente
// (render de servicios al reservar) consumen este catálogo.
router.get('/', listAmenities);

module.exports = router;
