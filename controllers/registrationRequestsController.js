const {
  getAllRegistrationRequests,
  getRegistrationRequestById,
  createRegistrationRequest,
  updateRegistrationRequest,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  deleteRegistrationRequest,
  emailHasPendingRequest,
  getRegistrationRequestStats,
} = require('../models/registrationRequestsModel');
const { emailExists, usernameExists } = require('../models/usersModel');
const { uploadFile } = require('../services/wasabiService');

/**
 * Obtener todas las solicitudes de registro con filtros
 */
const getRegistrationRequests = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      department: req.query.department,
      province: req.query.province,
      district: req.query.district,
      search: req.query.search,
    };

    const requests = await getAllRegistrationRequests(filters);

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    console.error('Error al obtener solicitudes de registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener solicitudes de registro',
    });
  }
};

/**
 * Obtener una solicitud por ID
 */
const getRegistrationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await getRegistrationRequestById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada',
      });
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener solicitud',
    });
  }
};

/**
 * Crear una nueva solicitud de registro con archivos
 * Los archivos se suben a Wasabi S3
 */
const createNewRegistrationRequestWithFiles = async (req, res) => {
  try {
    const uploadedFiles = req.files || [];

    // Parsear el campo documents si viene como string JSON
    let parsedDocuments = {};
    if (req.body.documents) {
      try {
        parsedDocuments =
          typeof req.body.documents === 'string'
            ? JSON.parse(req.body.documents)
            : req.body.documents;
      } catch (_e) {
        parsedDocuments = {};
      }
    }

    // Generar un ID unico para la solicitud
    const requestId = `request_${Date.now()}`;

    // Subir cada archivo a Wasabi
    const uploadedFilesData = [];
    for (const file of uploadedFiles) {
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const result = await uploadFile({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        folder: `registration-requests/${requestId}`,
        customFilename: `${sanitizedName}_${Date.now()}`,
      });

      uploadedFilesData.push({
        fieldname: file.fieldname,
        originalname: file.originalname,
        filename: result.filename,
        path: result.url,
        wasabiKey: result.key,
        size: file.size,
        mimetype: file.mimetype,
      });
    }

    // Combinar documentos con archivos subidos
    const documentsWithFiles = {
      ...parsedDocuments,
      uploadedFiles: uploadedFilesData,
      uploadedFilesCount: uploadedFilesData.length,
    };

    const { name, email, phone, dni, field_name, address, department, province, district } =
      req.body;

    // Validaciones basicas
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido',
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El email es requerido',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de email invalido',
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El telefono es requerido',
      });
    }

    if (!field_name || !field_name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la cancha es requerido',
      });
    }

    if (!address || !address.trim()) {
      return res.status(400).json({
        success: false,
        error: 'La direccion es requerida',
      });
    }

    if (!department || !province || !district) {
      return res.status(400).json({
        success: false,
        error: 'La ubicacion completa (departamento, provincia, distrito) es requerida',
      });
    }

    // Normalizar email antes de cualquier validación
    const normalizedEmail = email.trim().toLowerCase();

    // Verificar si el email ya tiene una solicitud pendiente o aprobada
    const hasPendingRequest = await emailHasPendingRequest(normalizedEmail);
    if (hasPendingRequest) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una solicitud con este email',
      });
    }

    // Verificar si el email ya existe como usuario registrado
    const emailAlreadyRegistered = await emailExists(normalizedEmail);
    if (emailAlreadyRegistered) {
      return res.status(409).json({
        success: false,
        error: 'Este email ya está registrado en el sistema',
      });
    }

    // Verificar si el username ya existe como usuario registrado
    const credentials = parsedDocuments?.credentials;
    if (credentials?.username) {
      const usernameAlreadyRegistered = await usernameExists(credentials.username);
      if (usernameAlreadyRegistered) {
        return res.status(409).json({
          success: false,
          error: 'Este nombre de usuario ya está en uso',
        });
      }
    }

    const requestData = {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      dni: dni?.trim(),
      field_name: field_name.trim(),
      address: address.trim(),
      department: department.trim(),
      province: province.trim(),
      district: district.trim(),
      documents: documentsWithFiles,
      user_id_registration: req.user?.id || null,
    };

    const newRequest = await createRegistrationRequest(requestData);

    res.status(201).json({
      success: true,
      message: 'Solicitud de registro creada exitosamente',
      data: newRequest,
      filesUploaded: uploadedFilesData.length,
    });
  } catch (error) {
    console.error('Error al crear solicitud de registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear solicitud de registro',
    });
  }
};

/**
 * Crear una nueva solicitud de registro (sin archivos - JSON puro)
 */
const createNewRegistrationRequest = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      dni,
      field_name,
      address,
      department,
      province,
      district,
      documents,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido',
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El email es requerido',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de email invalido',
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El telefono es requerido',
      });
    }

    if (!field_name || !field_name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la cancha es requerido',
      });
    }

    if (!address || !address.trim()) {
      return res.status(400).json({
        success: false,
        error: 'La direccion es requerida',
      });
    }

    if (!department || !province || !district) {
      return res.status(400).json({
        success: false,
        error: 'La ubicacion completa (departamento, provincia, distrito) es requerida',
      });
    }

    // Normalizar email antes de cualquier validación
    const normalizedEmail = email.trim().toLowerCase();

    // Verificar si el email ya tiene una solicitud pendiente o aprobada
    const hasPendingRequest = await emailHasPendingRequest(normalizedEmail);
    if (hasPendingRequest) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una solicitud con este email',
      });
    }

    // Verificar si el email ya existe como usuario registrado
    const emailAlreadyRegistered = await emailExists(normalizedEmail);
    if (emailAlreadyRegistered) {
      return res.status(409).json({
        success: false,
        error: 'Este email ya está registrado en el sistema',
      });
    }

    // Verificar si el username ya existe como usuario registrado
    const parsedDocs = typeof documents === 'string' ? JSON.parse(documents) : documents;
    const credentials = parsedDocs?.credentials;
    if (credentials?.username) {
      const usernameAlreadyRegistered = await usernameExists(credentials.username);
      if (usernameAlreadyRegistered) {
        return res.status(409).json({
          success: false,
          error: 'Este nombre de usuario ya está en uso',
        });
      }
    }

    const requestData = {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      dni: dni?.trim(),
      field_name: field_name.trim(),
      address: address.trim(),
      department: department.trim(),
      province: province.trim(),
      district: district.trim(),
      documents,
      user_id_registration: req.user?.id || null,
    };

    const newRequest = await createRegistrationRequest(requestData);

    res.status(201).json({
      success: true,
      message: 'Solicitud de registro creada exitosamente',
      data: newRequest,
    });
  } catch (error) {
    console.error('Error al crear solicitud de registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear solicitud de registro',
    });
  }
};

/**
 * Actualizar una solicitud de registro
 */
const updateExistingRegistrationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      dni,
      field_name,
      address,
      department,
      province,
      district,
      documents,
    } = req.body;

    const existingRequest = await getRegistrationRequestById(id);
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada',
      });
    }

    if (existingRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden editar solicitudes pendientes',
      });
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Formato de email invalido',
        });
      }

      const hasPendingRequest = await emailHasPendingRequest(email, id);
      if (hasPendingRequest) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe una solicitud pendiente con este email',
        });
      }
    }

    const requestData = {
      name: name?.trim(),
      email: email?.trim().toLowerCase(),
      phone: phone?.trim(),
      dni: dni?.trim(),
      field_name: field_name?.trim(),
      address: address?.trim(),
      department: department?.trim(),
      province: province?.trim(),
      district: district?.trim(),
      documents,
      user_id_modification: req.user.id,
    };

    const updatedRequest = await updateRegistrationRequest(id, requestData);

    res.json({
      success: true,
      message: 'Solicitud actualizada exitosamente',
      data: updatedRequest,
    });
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar solicitud',
    });
  }
};

/**
 * Aprobar una solicitud de registro
 */
const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const existingRequest = await getRegistrationRequestById(id);
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada',
      });
    }

    if (existingRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden aprobar solicitudes pendientes',
      });
    }

    const reviewed_by = req.user.id;

    const result = await approveRegistrationRequest(id, reviewed_by);

    res.json({
      success: true,
      message: 'Solicitud aprobada. Usuario administrador y cancha creados exitosamente.',
      data: {
        request: result.request,
        userId: result.userId,
        fieldId: result.fieldId,
      },
    });
  } catch (error) {
    console.error('Error al aprobar solicitud:', error);

    if (error.message.includes('ya está registrado')) {
      return res.status(409).json({
        success: false,
        error: 'El email o username ya está registrado en el sistema',
      });
    }

    if (error.message.includes('Credenciales no encontradas')) {
      return res.status(400).json({
        success: false,
        error: 'La solicitud no contiene credenciales validas',
      });
    }

    if (error.message.includes('Solicitud no encontrada')) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada',
      });
    }

    if (error.message.includes('Solo se pueden aprobar')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al aprobar solicitud: ' + error.message,
    });
  }
};

/**
 * Rechazar una solicitud de registro
 */
const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'La razon del rechazo es requerida',
      });
    }

    const existingRequest = await getRegistrationRequestById(id);
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada',
      });
    }

    if (existingRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden rechazar solicitudes pendientes',
      });
    }

    const reviewed_by = req.user.id;
    const rejectedRequest = await rejectRegistrationRequest(
      id,
      reviewed_by,
      rejection_reason.trim()
    );

    res.json({
      success: true,
      message: 'Solicitud rechazada exitosamente',
      data: rejectedRequest,
    });
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    res.status(500).json({
      success: false,
      error: 'Error al rechazar solicitud',
    });
  }
};

/**
 * Eliminar una solicitud de registro
 */
const deleteRegistrationRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const existingRequest = await getRegistrationRequestById(id);
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Solicitud no encontrada',
      });
    }

    const deleted = await deleteRegistrationRequest(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Solicitud eliminada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No se pudo eliminar la solicitud',
      });
    }
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar solicitud',
    });
  }
};

/**
 * Obtener estadisticas de solicitudes
 */
const getStats = async (req, res) => {
  try {
    const stats = await getRegistrationRequestStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadisticas de solicitudes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas de solicitudes',
    });
  }
};

module.exports = {
  getRegistrationRequests,
  getRegistrationRequest,
  createNewRegistrationRequest,
  createNewRegistrationRequestWithFiles,
  updateExistingRegistrationRequest,
  approveRequest,
  rejectRequest,
  deleteRegistrationRequestById,
  getStats,
};
