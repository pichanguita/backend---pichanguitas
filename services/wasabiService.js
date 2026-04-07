/**
 * Servicio de almacenamiento en Wasabi (S3-compatible)
 *
 * Funciones centralizadas para subir, eliminar y obtener URLs de archivos
 * almacenados en Wasabi Cloud Storage.
 *
 * Usa presigned URLs para garantizar acceso sin depender de
 * configuración de acceso público del bucket.
 */

const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const { s3Client, WASABI_BUCKET, WASABI_REGION } = require('../config/wasabi');

// Duración de las presigned URLs: 7 días (en segundos)
const PRESIGNED_URL_EXPIRY = 7 * 24 * 60 * 60;

/**
 * Genera la URL pública base de un objeto en Wasabi (puede no ser accesible si el bucket es privado)
 */
const getPublicUrl = (key) => {
  return `https://s3.${WASABI_REGION}.wasabisys.com/${WASABI_BUCKET}/${key}`;
};

/**
 * Genera una presigned URL para acceder a un objeto (funciona sin importar la config del bucket)
 * @param {string} key - Key del objeto en el bucket
 * @param {number} [expiresIn] - Duración en segundos (default: 7 días)
 * @returns {Promise<string>} URL firmada
 */
const getPresignedUrl = async (key, expiresIn = PRESIGNED_URL_EXPIRY) => {
  if (!key) return null;
  const command = new GetObjectCommand({
    Bucket: WASABI_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Convierte una URL de Wasabi almacenada en BD a una presigned URL accesible.
 * Si la URL no es de Wasabi, la devuelve tal cual.
 * @param {string} url - URL almacenada en BD
 * @returns {Promise<string>} URL accesible (presigned o original)
 */
const toAccessibleUrl = async (url) => {
  if (!url) return null;
  const key = extractKeyFromUrl(url);
  if (!key) return url;
  return getPresignedUrl(key);
};

/**
 * Determina la extensión del archivo a partir del mimetype
 */
const getExtFromMimetype = (mimetype) => {
  const mimeToExt = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
  };
  return mimeToExt[mimetype] || '.bin';
};

/**
 * Sube un archivo a Wasabi
 *
 * @param {Object} params
 * @param {Buffer} params.buffer - El buffer del archivo (de multer memoryStorage)
 * @param {string} params.originalname - Nombre original del archivo
 * @param {string} params.mimetype - Tipo MIME del archivo
 * @param {string} params.folder - Carpeta destino en el bucket (ej: 'fields-photos')
 * @param {string} [params.customFilename] - Nombre personalizado (sin extensión)
 * @returns {Promise<{key: string, url: string, presignedUrl: string, filename: string, size: number}>}
 */
const uploadFile = async ({ buffer, originalname, mimetype, folder, customFilename }) => {
  // Determinar extensión
  let ext = path.extname(originalname);
  if (!ext || ext === '') {
    ext = getExtFromMimetype(mimetype);
  }

  // Generar nombre de archivo
  const filename = customFilename
    ? `${customFilename}${ext}`
    : `${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;

  // Key completo en el bucket: folder/filename
  const key = `${folder}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: WASABI_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    ACL: 'public-read',
  });

  await s3Client.send(command);

  // Generar presigned URL para acceso inmediato
  const presignedUrl = await getPresignedUrl(key);

  return {
    key,
    url: getPublicUrl(key),
    presignedUrl,
    filename,
    size: buffer.length,
  };
};

/**
 * Obtiene el stream de un objeto de Wasabi (para proxy)
 * @param {string} key - Key del objeto
 * @returns {Promise<{stream: ReadableStream, contentType: string, contentLength: number}>}
 */
const getFileStream = async (key) => {
  const command = new GetObjectCommand({
    Bucket: WASABI_BUCKET,
    Key: key,
  });
  const response = await s3Client.send(command);
  return {
    stream: response.Body,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  };
};

/**
 * Elimina un archivo de Wasabi
 *
 * @param {string} key - La key del objeto (ej: 'fields-photos/field23_123456.jpg')
 */
const deleteFile = async (key) => {
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: WASABI_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
};

/**
 * Extrae la key de Wasabi a partir de una URL completa
 * Ej: https://s3.us-east-1.wasabisys.com/pichanguitas-uploads/fields-photos/file.jpg
 *     => fields-photos/file.jpg
 *
 * También soporta rutas relativas antiguas:
 * Ej: /uploads/fields-photos/file.jpg => fields-photos/file.jpg
 *
 * También soporta presigned URLs (contienen query params):
 * Ej: https://s3.../pichanguitas-uploads/fields-photos/file.jpg?X-Amz-...
 *     => fields-photos/file.jpg
 */
const extractKeyFromUrl = (url) => {
  if (!url) return null;

  // Remover query params (presigned URLs)
  const cleanUrl = url.split('?')[0];

  // Si es una URL de Wasabi completa
  if (cleanUrl.includes('wasabisys.com')) {
    const bucketPrefix = `${WASABI_BUCKET}/`;
    const idx = cleanUrl.indexOf(bucketPrefix);
    if (idx !== -1) {
      return cleanUrl.substring(idx + bucketPrefix.length);
    }
  }

  // Si es una ruta relativa antigua (/uploads/...)
  if (cleanUrl.startsWith('/uploads/')) {
    return cleanUrl.replace('/uploads/', '');
  }

  return null;
};

/**
 * Configura la política de acceso público de lectura en el bucket.
 */
const ensureBucketPublicPolicy = async () => {
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${WASABI_BUCKET}/*`,
      },
    ],
  };

  try {
    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: WASABI_BUCKET,
        Policy: JSON.stringify(policy),
      })
    );
    console.log(`   [Wasabi] Política de acceso público configurada`);
  } catch (error) {
    console.warn(`   [Wasabi] Política pública no aplicada (presigned URLs activas): ${error.message}`);
  }
};

/**
 * Verifica si el bucket existe y lo crea si no.
 * Configura política de acceso y CORS.
 */
const initBucket = async () => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: WASABI_BUCKET }));
    console.log(`   [Wasabi] Bucket '${WASABI_BUCKET}' conectado correctamente`);
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`   [Wasabi] Creando bucket '${WASABI_BUCKET}'...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: WASABI_BUCKET }));
      console.log(`   [Wasabi] Bucket '${WASABI_BUCKET}' creado exitosamente`);
    } else {
      console.error(`   [Wasabi] Error al verificar bucket:`, error.message);
      throw error;
    }
  }

  // Intentar configurar acceso público (puede fallar si Block Public Access está habilitado)
  await ensureBucketPublicPolicy();

  // Configurar CORS
  try {
    await s3Client.send(
      new PutBucketCorsCommand({
        Bucket: WASABI_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ['*'],
              AllowedMethods: ['GET', 'HEAD'],
              AllowedHeaders: ['*'],
              MaxAgeSeconds: 86400,
            },
          ],
        },
      })
    );
    console.log(`   [Wasabi] CORS configurado correctamente`);
  } catch (error) {
    console.warn(`   [Wasabi] CORS no aplicado: ${error.message}`);
  }

  console.log(`   [Wasabi] Presigned URLs activas (expiry: 7 días)`);
};

/**
 * Convierte una URL de Wasabi almacenada en BD a una URL de proxy del backend.
 * El proxy sirve la imagen directamente sin requerir acceso público al bucket.
 *
 * Wasabi URL: https://s3.us-east-1.wasabisys.com/pichanguitas-uploads/fields-photos/file.jpg
 * Proxy URL:  /api/media/fields-photos/file.jpg
 *
 * @param {string} url - URL de Wasabi almacenada en BD
 * @returns {string} URL de proxy relativa, o la URL original si no es de Wasabi
 */
const toProxyUrl = (url) => {
  if (!url) return null;
  const key = extractKeyFromUrl(url);
  if (!key) return url;
  return `/api/media/${key}`;
};

module.exports = {
  uploadFile,
  deleteFile,
  getPublicUrl,
  getPresignedUrl,
  toAccessibleUrl,
  toProxyUrl,
  getFileStream,
  extractKeyFromUrl,
  initBucket,
};
