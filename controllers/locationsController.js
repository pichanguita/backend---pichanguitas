const {
  getAllDepartments,
  getDepartmentById,
  getAllProvinces,
  getProvinceById,
  getAllDistricts,
  getDistrictById,
  getCompleteLocation,
  getDepartmentsWithFields,
  getProvincesWithFields,
  getDistrictsWithFields,
} = require('../models/locationsModel');

// ============= DEPARTMENTS =============

/**
 * Obtener todos los departamentos
 */
const getDepartments = async (req, res) => {
  try {
    const departments = await getAllDepartments();

    res.json({
      success: true,
      data: departments,
      count: departments.length,
    });
  } catch (error) {
    console.error('Error al obtener departamentos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener departamentos',
    });
  }
};

/**
 * Obtener un departamento por ID
 */
const getDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await getDepartmentById(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Departamento no encontrado',
      });
    }

    res.json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error('Error al obtener departamento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener departamento',
    });
  }
};

// ============= PROVINCES =============

/**
 * Obtener todas las provincias (opcionalmente filtradas por departamento)
 * Acepta department_id (number) o department_name (string)
 */
const getProvinces = async (req, res) => {
  try {
    const { department_id, department_name } = req.query;

    // Si se envía department_name, convertirlo a ID
    let deptId = department_id ? parseInt(department_id) : null;

    if (!deptId && department_name) {
      // Buscar departamento por nombre (case-insensitive y trimmed)
      const { getAllDepartments } = require('../models/locationsModel');
      const departments = await getAllDepartments();
      const searchName = department_name.trim().toLowerCase();
      const dept = departments.find(d => d.name.toLowerCase() === searchName);

      if (!dept) {
        console.log(
          `⚠️ Departamento no encontrado: "${department_name}". Departamentos disponibles:`,
          departments.map(d => d.name)
        );
      }

      deptId = dept ? dept.id : null;
    }

    const provinces = await getAllProvinces(deptId);

    res.json({
      success: true,
      data: provinces,
      count: provinces.length,
    });
  } catch (error) {
    console.error('Error al obtener provincias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener provincias',
    });
  }
};

/**
 * Obtener una provincia por ID
 */
const getProvince = async (req, res) => {
  try {
    const { id } = req.params;
    const province = await getProvinceById(id);

    if (!province) {
      return res.status(404).json({
        success: false,
        error: 'Provincia no encontrada',
      });
    }

    res.json({
      success: true,
      data: province,
    });
  } catch (error) {
    console.error('Error al obtener provincia:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener provincia',
    });
  }
};

// ============= DISTRICTS =============

/**
 * Obtener todos los distritos (opcionalmente filtrados por provincia)
 * Acepta province_id (number) o province_name (string)
 */
const getDistricts = async (req, res) => {
  try {
    const { province_id, province_name } = req.query;

    // Si se envía province_name, convertirlo a ID
    let provId = province_id ? parseInt(province_id) : null;

    if (!provId && province_name) {
      // Buscar provincia por nombre (case-insensitive y trimmed)
      const { getAllProvinces } = require('../models/locationsModel');
      const provinces = await getAllProvinces(null);
      const searchName = province_name.trim().toLowerCase();
      const prov = provinces.find(p => p.name.toLowerCase() === searchName);

      if (!prov) {
        console.log(
          `⚠️ Provincia no encontrada: "${province_name}". Provincias disponibles:`,
          provinces.map(p => p.name).slice(0, 10)
        );
      }

      provId = prov ? prov.id : null;
    }

    const districts = await getAllDistricts(provId);

    res.json({
      success: true,
      data: districts,
      count: districts.length,
    });
  } catch (error) {
    console.error('Error al obtener distritos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener distritos',
    });
  }
};

/**
 * Obtener un distrito por ID
 */
const getDistrict = async (req, res) => {
  try {
    const { id } = req.params;
    const district = await getDistrictById(id);

    if (!district) {
      return res.status(404).json({
        success: false,
        error: 'Distrito no encontrado',
      });
    }

    res.json({
      success: true,
      data: district,
    });
  } catch (error) {
    console.error('Error al obtener distrito:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener distrito',
    });
  }
};

/**
 * Obtener ubicación completa (departamento, provincia, distrito)
 */
const getLocation = async (req, res) => {
  try {
    const { district_id } = req.params;
    const location = await getCompleteLocation(parseInt(district_id));

    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Ubicación no encontrada',
      });
    }

    res.json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error('Error al obtener ubicación completa:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener ubicación completa',
    });
  }
};

// ============= UBICACIONES CON CANCHAS =============

/**
 * Obtener departamentos que tienen canchas registradas
 */
const getDepartmentsWithFieldsController = async (req, res) => {
  try {
    const departments = await getDepartmentsWithFields();

    res.json({
      success: true,
      data: departments,
      count: departments.length,
    });
  } catch (error) {
    console.error('Error al obtener departamentos con canchas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener departamentos con canchas',
    });
  }
};

/**
 * Obtener provincias que tienen canchas registradas
 * Acepta department_id (number) o department_name (string)
 */
const getProvincesWithFieldsController = async (req, res) => {
  try {
    const { department_id, department_name } = req.query;

    const deptId = department_id ? parseInt(department_id) : null;
    const deptName = department_name ? department_name.trim() : null;

    // Si se proporciona department_name, usar directamente el nombre
    const provinces = await getProvincesWithFields(deptId, deptName);

    res.json({
      success: true,
      data: provinces,
      count: provinces.length,
    });
  } catch (error) {
    console.error('Error al obtener provincias con canchas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener provincias con canchas',
    });
  }
};

/**
 * Obtener distritos que tienen canchas registradas
 * Acepta province_id (number) o province_name (string)
 */
const getDistrictsWithFieldsController = async (req, res) => {
  try {
    const { province_id, province_name } = req.query;

    const provId = province_id ? parseInt(province_id) : null;
    const provName = province_name ? province_name.trim() : null;

    // Si se proporciona province_name, usar directamente el nombre
    const districts = await getDistrictsWithFields(provId, provName);

    res.json({
      success: true,
      data: districts,
      count: districts.length,
    });
  } catch (error) {
    console.error('Error al obtener distritos con canchas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener distritos con canchas',
    });
  }
};

module.exports = {
  // Departments
  getDepartments,
  getDepartment,
  // Provinces
  getProvinces,
  getProvince,
  // Districts
  getDistricts,
  getDistrict,
  // Utilities
  getLocation,
  // Ubicaciones con canchas
  getDepartmentsWithFieldsController,
  getProvincesWithFieldsController,
  getDistrictsWithFieldsController,
};
