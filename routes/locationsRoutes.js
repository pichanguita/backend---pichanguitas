const express = require('express');

const {
  getDepartments,
  getDepartment,
  getProvinces,
  getProvince,
  getDistricts,
  getDistrict,
  getLocation,
  getDepartmentsWithFieldsController,
  getProvincesWithFieldsController,
  getDistrictsWithFieldsController,
} = require('../controllers/locationsController');

const router = express.Router();

// ============= DEPARTMENTS =============
// GET /api/locations/departments - Obtener todos los departamentos (PÚBLICO)
router.get('/departments', getDepartments);

// GET /api/locations/departments/:id - Obtener un departamento por ID (PÚBLICO)
router.get('/departments/:id', getDepartment);

// ============= PROVINCES =============
// GET /api/locations/provinces - Obtener todas las provincias (PÚBLICO)
router.get('/provinces', getProvinces);

// GET /api/locations/provinces/:id - Obtener una provincia por ID (PÚBLICO)
router.get('/provinces/:id', getProvince);

// ============= DISTRICTS =============
// GET /api/locations/districts - Obtener todos los distritos (PÚBLICO)
router.get('/districts', getDistricts);

// GET /api/locations/districts/:id - Obtener un distrito por ID (PÚBLICO)
router.get('/districts/:id', getDistrict);

// ============= UTILITIES =============
// GET /api/locations/complete/:district_id - Obtener ubicación completa (PÚBLICO)
router.get('/complete/:district_id', getLocation);

// ============= UBICACIONES CON CANCHAS =============
// GET /api/locations/departments-with-fields - Departamentos con canchas (PÚBLICO)
router.get('/departments-with-fields', getDepartmentsWithFieldsController);

// GET /api/locations/provinces-with-fields - Provincias con canchas (PÚBLICO)
router.get('/provinces-with-fields', getProvincesWithFieldsController);

// GET /api/locations/districts-with-fields - Distritos con canchas (PÚBLICO)
router.get('/districts-with-fields', getDistrictsWithFieldsController);

module.exports = router;
