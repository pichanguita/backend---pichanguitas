const path = require('path');
const multer = require('multer');

/**
 * Middleware de upload con memoryStorage
 *
 * Todos los uploads usan memoryStorage para que el buffer del archivo
 * se almacene en memoria (req.file.buffer / req.files[].buffer).
 * Luego, los controllers se encargan de subir el buffer a Wasabi S3.
 */
const memoryStorage = multer.memoryStorage();

// ========================================
// FILTROS DE ARCHIVOS
// ========================================

// Filtro para imágenes solamente
const imageFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG, GIF, WEBP)'), false);
  }
};

// Filtro para documentos y fotos de solicitudes de registro
const registrationFileFilter = (req, file, cb) => {
  const allowedDocTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allAllowedTypes = [...allowedDocTypes, ...allowedImageTypes];

  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error('Tipo de archivo no permitido. Solo PDF, Word, imágenes (JPG, PNG, GIF, WEBP)'),
      false
    );
  }
};

// ========================================
// CONFIGURACIONES DE MULTER (memoryStorage)
// ========================================

// Imágenes del sitio (hero, logo, etc.)
const uploadSiteImage = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Archivos de solicitudes de registro (documentos + fotos)
const uploadRegistrationFiles = multer({
  storage: memoryStorage,
  fileFilter: registrationFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 20,
  },
});

// Fotos de canchas
const uploadFieldPhotos = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Vouchers de mensualidades
const uploadMonthlyVoucher = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Vouchers de reservas
const uploadReservationVoucher = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Imágenes QR de métodos de pago
const uploadPaymentQR = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = {
  uploadSiteImage,
  uploadRegistrationFiles,
  uploadFieldPhotos,
  uploadMonthlyVoucher,
  uploadReservationVoucher,
  uploadPaymentQR,
};
