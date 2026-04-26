const multer = require('multer');

const {
  UPLOAD_LIMITS,
  ALLOWED_MIME_TYPES,
  ALLOWED_REGISTRATION_TYPES,
} = require('../config/storage');

/**
 * Todos los uploads usan memoryStorage para que el buffer del archivo
 * quede en memoria (req.file.buffer / req.files[].buffer) y luego
 * los controllers lo suban a Wasabi S3. No hay almacenamiento local.
 */
const memoryStorage = multer.memoryStorage();

// ========================================
// FILTROS DE ARCHIVOS
// ========================================

const buildMimeFilter = (allowedTypes, errorMessage) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(errorMessage), false);
  }
};

const imageFilter = buildMimeFilter(
  ALLOWED_MIME_TYPES.IMAGE,
  'Solo se permiten archivos de imagen (JPEG, PNG, GIF, WEBP)'
);

const registrationFileFilter = buildMimeFilter(
  ALLOWED_REGISTRATION_TYPES,
  'Tipo de archivo no permitido. Solo PDF, Word, imágenes (JPG, PNG, GIF, WEBP)'
);

// ========================================
// INSTANCIAS DE MULTER
// ========================================

const uploadSiteImage = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: UPLOAD_LIMITS.IMAGE },
});

const uploadRegistrationFiles = multer({
  storage: memoryStorage,
  fileFilter: registrationFileFilter,
  limits: {
    fileSize: UPLOAD_LIMITS.DOCUMENT,
    files: UPLOAD_LIMITS.REGISTRATION_MAX_FILES,
  },
});

const uploadFieldPhotos = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: UPLOAD_LIMITS.IMAGE },
});

const uploadMonthlyVoucher = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: UPLOAD_LIMITS.VOUCHER },
});

const uploadReservationVoucher = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: UPLOAD_LIMITS.VOUCHER },
});

const uploadPaymentQR = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: UPLOAD_LIMITS.IMAGE },
});

module.exports = {
  uploadSiteImage,
  uploadRegistrationFiles,
  uploadFieldPhotos,
  uploadMonthlyVoucher,
  uploadReservationVoucher,
  uploadPaymentQR,
};
