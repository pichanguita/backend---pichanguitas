const {
  getAllRegistrationRequests,
  getRegistrationRequestById,
  getRegistrationRequestFileById,
  createRegistrationRequest,
  updateRegistrationRequest,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  deleteRegistrationRequest,
  emailHasPendingRequest,
  getRegistrationRequestStats,
} = require('../models/registrationRequestsModel');
const { emailExists, usernameExists } = require('../models/usersModel');
const {
  uploadFile,
  deleteFile,
  deleteFolder,
  getFileStream,
} = require('../services/wasabiService');
const { WASABI_FOLDERS } = require('../config/storage');
const {
  logActivity,
  resolveIp,
  ACTIVITY_TYPES,
  ACTIVITY_STATUS,
} = require('../services/activityLogsService');

// ========================================
// HELPERS
// ========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeKind = fieldname => {
  if (!fieldname) return 'document';
  const value = String(fieldname).toLowerCase();
  if (value.includes('photo') || value.includes('image') || value.includes('foto')) {
    return 'photo';
  }
  return 'document';
};

const parseJsonField = raw => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return {};
  }
};

const parseNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Aplana el payload (body o JSON stringificado) al formato plano del modelo.
 * Acepta tanto envío legacy (`documents: { credentials, ... }`) como envío nuevo
 * con campos en la raíz (businessRuc, credentialsUsername, ...).
 */
const flattenRequestPayload = (body, extra = {}) => {
  const docs = parseJsonField(body.documents);
  const credentials = docs.credentials || {};
  const businessCoords = docs.businessCoordinates || {};

  return {
    name: (body.name || '').trim(),
    email: (body.email || '').trim().toLowerCase(),
    phone: (body.phone || '').trim(),
    dni: body.dni ? body.dni.trim() : null,
    field_name: (body.field_name || '').trim(),
    address: (body.address || '').trim(),
    department: (body.department || '').trim(),
    province: (body.province || '').trim(),
    district: (body.district || '').trim(),
    business_ruc: body.businessRuc || body.business_ruc || docs.businessRuc || null,
    business_phone: body.businessPhone || body.business_phone || docs.businessPhone || null,
    business_reference:
      body.businessReference || body.business_reference || docs.businessReference || null,
    business_latitude:
      parseNumber(body.businessLatitude ?? body.business_latitude ?? businessCoords.latitude),
    business_longitude:
      parseNumber(body.businessLongitude ?? body.business_longitude ?? businessCoords.longitude),
    address_references:
      body.addressReferences || body.address_references || docs.addressReferences || null,
    experience: body.experience || docs.experience || null,
    reason_to_join: body.reasonToJoin || body.reason_to_join || docs.reasonToJoin || null,
    credentials_username:
      body.credentialsUsername || body.credentials_username || credentials.username || null,
    credentials_password_enc:
      body.credentialsPassword || body.credentials_password_enc || credentials.password || null,
    user_id_registration: extra.user_id_registration ?? null,
    _sportNames: Array.isArray(body.sportTypes)
      ? body.sportTypes
      : Array.isArray(docs.sportTypes)
        ? docs.sportTypes
        : [],
  };
};

const validateBaseFields = payload => {
  if (!payload.name) return 'El nombre es requerido';
  if (!payload.email) return 'El email es requerido';
  if (!EMAIL_REGEX.test(payload.email)) return 'Formato de email invalido';
  if (!payload.phone) return 'El telefono es requerido';
  if (!payload.field_name) return 'El nombre de la cancha es requerido';
  if (!payload.address) return 'La direccion es requerida';
  if (!payload.department || !payload.province || !payload.district) {
    return 'La ubicacion completa (departamento, provincia, distrito) es requerida';
  }
  return null;
};

// ========================================
// GET
// ========================================

const getRegistrationRequests = async (req, res) => {
  try {
    const requests = await getAllRegistrationRequests({
      status: req.query.status,
      department: req.query.department,
      province: req.query.province,
      district: req.query.district,
      search: req.query.search,
    });

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

const getRegistrationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await getRegistrationRequestById(id);

    if (!request) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({ success: false, error: 'Error al obtener solicitud' });
  }
};

// ========================================
// CREATE CON ARCHIVOS
// ========================================

const createNewRegistrationRequestWithFiles = async (req, res) => {
  const uploadedKeys = [];
  let requestFolder = null;
  try {
    const payload = flattenRequestPayload(req.body, {
      user_id_registration: req.user?.id ?? null,
    });

    const validationError = validateBaseFields(payload);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    if (await emailHasPendingRequest(payload.email)) {
      return res
        .status(409)
        .json({ success: false, error: 'Ya existe una solicitud con este email' });
    }
    if (await emailExists(payload.email)) {
      return res
        .status(409)
        .json({ success: false, error: 'Este email ya está registrado en el sistema' });
    }
    if (payload.credentials_username && (await usernameExists(payload.credentials_username))) {
      return res
        .status(409)
        .json({ success: false, error: 'Este nombre de usuario ya está en uso' });
    }

    // Subida a Wasabi
    requestFolder = `${WASABI_FOLDERS.REGISTRATION_REQUESTS}/request_${Date.now()}`;
    const uploadedFiles = [];
    for (const file of req.files || []) {
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const result = await uploadFile({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        folder: requestFolder,
        customFilename: `${sanitizedName}_${Date.now()}`,
      });
      uploadedKeys.push(result.key);
      uploadedFiles.push({
        wasabi_key: result.key,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        kind: normalizeKind(file.fieldname),
      });
    }

    const newRequest = await createRegistrationRequest(
      payload,
      uploadedFiles,
      payload._sportNames
    );

    res.status(201).json({
      success: true,
      message: 'Solicitud de registro creada exitosamente',
      data: newRequest,
      filesUploaded: uploadedFiles.length,
    });
  } catch (error) {
    console.error('Error al crear solicitud de registro:', error);
    // Rollback de archivos subidos si la transacción de BD falló
    if (requestFolder) {
      try {
        await deleteFolder(requestFolder);
      } catch (cleanupError) {
        console.error('Error al limpiar archivos huérfanos en Wasabi:', cleanupError.message);
      }
    } else {
      for (const key of uploadedKeys) {
        try {
          await deleteFile(key);
        } catch (_e) {
          /* noop */
        }
      }
    }
    res.status(500).json({ success: false, error: 'Error al crear solicitud de registro' });
  }
};

// ========================================
// CREATE SIN ARCHIVOS
// ========================================

const createNewRegistrationRequest = async (req, res) => {
  try {
    const payload = flattenRequestPayload(req.body, {
      user_id_registration: req.user?.id ?? null,
    });

    const validationError = validateBaseFields(payload);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    if (await emailHasPendingRequest(payload.email)) {
      return res
        .status(409)
        .json({ success: false, error: 'Ya existe una solicitud con este email' });
    }
    if (await emailExists(payload.email)) {
      return res
        .status(409)
        .json({ success: false, error: 'Este email ya está registrado en el sistema' });
    }
    if (payload.credentials_username && (await usernameExists(payload.credentials_username))) {
      return res
        .status(409)
        .json({ success: false, error: 'Este nombre de usuario ya está en uso' });
    }

    const newRequest = await createRegistrationRequest(payload, [], payload._sportNames);

    res.status(201).json({
      success: true,
      message: 'Solicitud de registro creada exitosamente',
      data: newRequest,
    });
  } catch (error) {
    console.error('Error al crear solicitud de registro:', error);
    res.status(500).json({ success: false, error: 'Error al crear solicitud de registro' });
  }
};

// ========================================
// UPDATE
// ========================================

const updateExistingRegistrationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getRegistrationRequestById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }
    if (existing.status !== 'pending') {
      return res
        .status(400)
        .json({ success: false, error: 'Solo se pueden editar solicitudes pendientes' });
    }

    const payload = flattenRequestPayload(req.body, {
      user_id_registration: existing.user_id_registration,
    });
    payload.user_id_modification = req.user?.id;

    if (payload.email && !EMAIL_REGEX.test(payload.email)) {
      return res.status(400).json({ success: false, error: 'Formato de email invalido' });
    }
    if (payload.email && (await emailHasPendingRequest(payload.email, id))) {
      return res
        .status(409)
        .json({ success: false, error: 'Ya existe una solicitud pendiente con este email' });
    }

    const updated = await updateRegistrationRequest(id, payload);
    res.json({ success: true, message: 'Solicitud actualizada exitosamente', data: updated });
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar solicitud' });
  }
};

// ========================================
// APPROVE
// ========================================

const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await getRegistrationRequestById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }
    if (existing.status !== 'pending') {
      return res
        .status(400)
        .json({ success: false, error: 'Solo se pueden aprobar solicitudes pendientes' });
    }

    const result = await approveRegistrationRequest(id, req.user.id);

    // Registrar actividad: cuenta activa del nuevo admin creada (su primer evento)
    await logActivity({
      userId: result.userId,
      action: 'account.approved',
      entityType: ACTIVITY_TYPES.SETTINGS,
      entityId: result.userId,
      description: `Cuenta aprobada por ${req.user?.name || 'el administrador'}. Cancha creada: ID ${result.fieldId}`,
      status: ACTIVITY_STATUS.SUCCESS,
      ipAddress: resolveIp(req),
      actorUserId: req.user?.id ?? null,
    });

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
      return res
        .status(409)
        .json({ success: false, error: 'El email o username ya está registrado en el sistema' });
    }
    if (error.message.includes('Credenciales no encontradas')) {
      return res
        .status(400)
        .json({ success: false, error: 'La solicitud no contiene credenciales validas' });
    }
    if (error.message.includes('Solicitud no encontrada')) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }
    if (error.message.includes('Solo se pueden aprobar')) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(500).json({ success: false, error: 'Error al aprobar solicitud: ' + error.message });
  }
};

// ========================================
// REJECT (conserva archivos como auditoría)
// ========================================

const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({ success: false, error: 'La razon del rechazo es requerida' });
    }

    const existing = await getRegistrationRequestById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }
    if (existing.status !== 'pending') {
      return res
        .status(400)
        .json({ success: false, error: 'Solo se pueden rechazar solicitudes pendientes' });
    }

    const updated = await rejectRegistrationRequest(id, req.user.id, rejection_reason.trim());
    res.json({ success: true, message: 'Solicitud rechazada exitosamente', data: updated });
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    res.status(500).json({ success: false, error: 'Error al rechazar solicitud' });
  }
};

// ========================================
// DELETE (borra archivos en Wasabi)
// ========================================

const deleteRegistrationRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getRegistrationRequestById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    const { deleted, keys } = await deleteRegistrationRequest(id);
    if (!deleted) {
      return res
        .status(500)
        .json({ success: false, error: 'No se pudo eliminar la solicitud' });
    }

    for (const key of keys) {
      try {
        await deleteFile(key);
      } catch (err) {
        console.error('[Wasabi] No se pudo eliminar archivo', key, err.message);
      }
    }

    res.json({ success: true, message: 'Solicitud eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar solicitud' });
  }
};

// ========================================
// DESCARGA AUTENTICADA
// ========================================

const downloadRequestFile = async (req, res) => {
  try {
    const { id, fileId } = req.params;

    const file = await getRegistrationRequestFileById(id, fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }

    const { stream, contentType, contentLength } = await getFileStream(file.wasabi_key);
    res.setHeader('Content-Type', contentType || file.mime_type || 'application/octet-stream');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(file.original_name)}"`
    );
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    stream.pipe(res);
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado en Wasabi' });
    }
    console.error('Error al descargar archivo de solicitud:', error);
    res.status(500).json({ success: false, error: 'Error al descargar archivo' });
  }
};

// ========================================
// STATS
// ========================================

const getStats = async (_req, res) => {
  try {
    const stats = await getRegistrationRequestStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error al obtener estadisticas de solicitudes:', error);
    res
      .status(500)
      .json({ success: false, error: 'Error al obtener estadisticas de solicitudes' });
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
  downloadRequestFile,
  getStats,
};
