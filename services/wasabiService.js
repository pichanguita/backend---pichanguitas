/**
 * Servicio de almacenamiento en Wasabi (S3-compatible)
 *
 * Funciones centralizadas para subir, eliminar, listar y obtener URLs
 * de archivos almacenados en Wasabi Cloud Storage.
 *
 * Los objetos se guardan privados. El acceso se sirve vía:
 *   - Proxy público   → /api/media/<key>   (para archivos no sensibles)
 *   - Endpoint autenticado en cada módulo (para archivos sensibles)
 *   - Presigned URLs   → firma temporal    (para casos especiales)
 */

const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const { s3Client, WASABI_BUCKET, WASABI_REGION } = require('../config/wasabi');
const { PRESIGNED_URL_EXPIRY, MEDIA_PROXY_PATH } = require('../config/storage');

// ========================================
// HELPERS INTERNOS
// ========================================

const MIME_TO_EXT = Object.freeze({
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
});

const getExtFromMimetype = mimetype => MIME_TO_EXT[mimetype] || '.bin';

// ========================================
// URL HELPERS
// ========================================

/**
 * URL S3 estándar (no firmada). Solo sirve cuando el objeto es público;
 * con ACL privada devuelve 403. Se usa como formato canónico interno.
 */
const getPublicUrl = key => {
  if (!key) return null;
  return `https://s3.${WASABI_REGION}.wasabisys.com/${WASABI_BUCKET}/${key}`;
};

/**
 * Extrae la key de cualquier URL almacenada: Wasabi directa, presigned
 * (con query params), proxy `/api/media/...` o rutas heredadas `/uploads/...`.
 */
const extractKeyFromUrl = url => {
  if (!url) return null;

  const cleanUrl = url.split('?')[0];

  if (cleanUrl.includes('wasabisys.com')) {
    const bucketPrefix = `${WASABI_BUCKET}/`;
    const idx = cleanUrl.indexOf(bucketPrefix);
    if (idx !== -1) {
      return cleanUrl.substring(idx + bucketPrefix.length);
    }
  }

  if (cleanUrl.startsWith(`${MEDIA_PROXY_PATH}/`)) {
    return cleanUrl.substring(MEDIA_PROXY_PATH.length + 1);
  }

  if (cleanUrl.startsWith('/uploads/')) {
    return cleanUrl.replace('/uploads/', '');
  }

  // Si ya es una key pelada (folder/filename)
  if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('/')) {
    return cleanUrl;
  }

  return null;
};

/**
 * Convierte cualquier URL/key a la ruta pública del proxy del backend.
 * Ej: https://s3.../fields-photos/a.jpg → /api/media/fields-photos/a.jpg
 */
const toProxyUrl = url => {
  if (!url) return null;
  const key = extractKeyFromUrl(url);
  if (!key) return url;
  return `${MEDIA_PROXY_PATH}/${key}`;
};

/**
 * Genera la ruta de proxy directamente desde una key (sin pasar por URL).
 */
const keyToProxyUrl = key => (key ? `${MEDIA_PROXY_PATH}/${key}` : null);

/**
 * Presigned URL temporal para acceso directo al objeto (expira).
 * Útil para compartir enlaces firmados fuera del flujo habitual de proxy.
 */
const getPresignedUrl = async (key, expiresIn = PRESIGNED_URL_EXPIRY) => {
  if (!key) return null;
  const command = new GetObjectCommand({
    Bucket: WASABI_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
};

// ========================================
// UPLOAD
// ========================================

/**
 * Sube un buffer a Wasabi en la carpeta indicada. Los archivos quedan
 * privados (sin ACL público); el acceso se sirve por proxy / endpoint
 * autenticado / presigned URL según el caso.
 *
 * @returns {{key: string, url: string, filename: string, size: number}}
 */
const uploadFile = async ({ buffer, originalname, mimetype, folder, customFilename }) => {
  if (!buffer) throw new Error('uploadFile: buffer requerido');
  if (!folder) throw new Error('uploadFile: folder requerido');

  let ext = path.extname(originalname || '');
  if (!ext) ext = getExtFromMimetype(mimetype);

  const filename = customFilename
    ? `${customFilename}${ext}`
    : `${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;

  const key = `${folder}/${filename}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );

  return {
    key,
    url: getPublicUrl(key),
    filename,
    size: buffer.length,
  };
};

// ========================================
// STREAM (proxy / descarga autenticada)
// ========================================

const getFileStream = async key => {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: key,
    })
  );
  return {
    stream: response.Body,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  };
};

// ========================================
// DELETE
// ========================================

/**
 * Elimina un objeto. Silencioso si la key es falsy.
 */
const deleteFile = async key => {
  if (!key) return;
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: key,
    })
  );
};

/**
 * Conveniencia: acepta tanto keys como URLs almacenadas.
 * No lanza si la URL no pudo resolverse (log + retorna false).
 */
const deleteFileByUrl = async url => {
  if (!url) return false;
  const key = extractKeyFromUrl(url);
  if (!key) {
    console.warn('[Wasabi] deleteFileByUrl: no se pudo extraer key de', url);
    return false;
  }
  try {
    await deleteFile(key);
    return true;
  } catch (err) {
    console.error('[Wasabi] Error al eliminar objeto:', key, err.message);
    return false;
  }
};

/**
 * Elimina todos los objetos bajo un prefijo (simulación de carpeta).
 * Útil al borrar una solicitud entera, por ejemplo.
 */
const deleteFolder = async prefix => {
  if (!prefix) return 0;
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;

  let continuationToken;
  let totalDeleted = 0;

  do {
    const listResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: WASABI_BUCKET,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
      })
    );

    const objects = listResponse.Contents || [];
    if (objects.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: WASABI_BUCKET,
          Delete: {
            Objects: objects.map(obj => ({ Key: obj.Key })),
            Quiet: true,
          },
        })
      );
      totalDeleted += objects.length;
    }

    continuationToken = listResponse.IsTruncated
      ? listResponse.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return totalDeleted;
};

// ========================================
// INIT BUCKET
// ========================================

const buildCorsRules = () => {
  const allowedOrigins = (process.env.WASABI_CORS_ORIGINS || '*')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return [
    {
      AllowedOrigins: allowedOrigins,
      AllowedMethods: ['GET', 'HEAD'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 86400,
    },
  ];
};

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

  try {
    await s3Client.send(
      new PutBucketCorsCommand({
        Bucket: WASABI_BUCKET,
        CORSConfiguration: { CORSRules: buildCorsRules() },
      })
    );
    console.log(`   [Wasabi] CORS configurado correctamente`);
  } catch (error) {
    console.warn(`   [Wasabi] CORS no aplicado: ${error.message}`);
  }

  console.log(`   [Wasabi] Objetos privados; acceso vía proxy/endpoint autenticado`);
};

module.exports = {
  uploadFile,
  deleteFile,
  deleteFileByUrl,
  deleteFolder,
  getPublicUrl,
  getPresignedUrl,
  toProxyUrl,
  keyToProxyUrl,
  getFileStream,
  extractKeyFromUrl,
  initBucket,
};
