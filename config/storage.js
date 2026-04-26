/**
 * Configuración centralizada del almacenamiento de archivos (Wasabi S3)
 *
 * Todas las carpetas, límites de tamaño, tipos MIME permitidos y
 * parámetros de almacenamiento viven aquí. Prohibido hardcodear estos
 * valores en controllers o middleware.
 */

const MB = 1024 * 1024;

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// ========================================
// CARPETAS EN EL BUCKET
// ========================================
const WASABI_FOLDERS = Object.freeze({
  REGISTRATION_REQUESTS: process.env.WASABI_FOLDER_REGISTRATION || 'registration-requests',
  FIELDS_PHOTOS: process.env.WASABI_FOLDER_FIELDS_PHOTOS || 'fields-photos',
  PAYMENT_QR: process.env.WASABI_FOLDER_PAYMENT_QR || 'payment-qr',
  RESERVATION_VOUCHERS: process.env.WASABI_FOLDER_VOUCHERS || 'vouchers',
  MONTHLY_VOUCHERS: process.env.WASABI_FOLDER_MONTHLY_VOUCHERS || 'mensualidades',
  SITE_IMAGES: process.env.WASABI_FOLDER_SITE_IMAGES || 'site-images',
});

// ========================================
// LÍMITES DE TAMAÑO (en bytes)
// ========================================
const UPLOAD_LIMITS = Object.freeze({
  IMAGE: toInt(process.env.UPLOAD_MAX_IMAGE_SIZE_MB, 5) * MB,
  DOCUMENT: toInt(process.env.UPLOAD_MAX_DOCUMENT_SIZE_MB, 10) * MB,
  VOUCHER: toInt(process.env.UPLOAD_MAX_VOUCHER_SIZE_MB, 10) * MB,
  REGISTRATION_MAX_FILES: toInt(process.env.UPLOAD_MAX_REGISTRATION_FILES, 20),
});

// ========================================
// TIPOS MIME PERMITIDOS
// ========================================
const ALLOWED_MIME_TYPES = Object.freeze({
  IMAGE: Object.freeze([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ]),
  DOCUMENT: Object.freeze([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]),
});

const ALLOWED_REGISTRATION_TYPES = Object.freeze([
  ...ALLOWED_MIME_TYPES.DOCUMENT,
  ...ALLOWED_MIME_TYPES.IMAGE,
]);

// ========================================
// PRESIGNED URL EXPIRY (segundos)
// ========================================
const PRESIGNED_URL_EXPIRY = toInt(process.env.UPLOAD_PRESIGNED_URL_EXPIRY, 7 * 24 * 60 * 60);

// ========================================
// RUTAS HTTP PÚBLICAS
// ========================================
const MEDIA_PROXY_PATH = '/api/media';

// ========================================
// DEFAULTS DE CONFIGURACIÓN DEL SITIO
// ========================================
// La imagen por defecto del hero vive en Wasabi bajo site-images/.
// Si no existe, el frontend mostrará el fondo sólido de respaldo.
const SITE_CONFIG_DEFAULTS = Object.freeze({
  heroBackground: Object.freeze({
    key: `${WASABI_FOLDERS.SITE_IMAGES}/img_hero_default.jpg`,
    alt: 'Hero Background por defecto',
    type: 'default',
  }),
});

module.exports = {
  WASABI_FOLDERS,
  UPLOAD_LIMITS,
  ALLOWED_MIME_TYPES,
  ALLOWED_REGISTRATION_TYPES,
  PRESIGNED_URL_EXPIRY,
  MEDIA_PROXY_PATH,
  SITE_CONFIG_DEFAULTS,
};
