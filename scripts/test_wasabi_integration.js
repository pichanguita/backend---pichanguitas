/**
 * Smoke test de integración con Wasabi.
 *
 * Sube un buffer efímero a cada carpeta del bucket, verifica que se
 * pueda descargar, y lo elimina. NO toca la BD. Útil para validar
 * credenciales, CORS, y permisos antes de probar los módulos reales.
 *
 * Uso:
 *   node scripts/test_wasabi_integration.js
 */

require('dotenv').config();
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');

const { s3Client, WASABI_BUCKET } = require('../config/wasabi');
const { WASABI_FOLDERS } = require('../config/storage');
const {
  uploadFile,
  deleteFile,
  getFileStream,
  toProxyUrl,
  initBucket,
} = require('../services/wasabiService');

const log = (...a) => console.log('  ', ...a);
const ok = (...a) => console.log('✅', ...a);
const fail = (...a) => console.error('❌', ...a);

const streamToBuffer = async stream => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const testFolder = async folder => {
  console.log(`\n— Probando folder: ${folder}`);
  const payload = Buffer.from(`smoke-${Date.now()}`, 'utf-8');

  // 1) Upload
  const uploaded = await uploadFile({
    buffer: payload,
    originalname: 'smoke.txt',
    mimetype: 'text/plain',
    folder,
    customFilename: `smoke_${Date.now()}`,
  });
  log(`uploaded key=${uploaded.key} size=${uploaded.size}`);

  // 2) Read via stream
  const { stream, contentType, contentLength } = await getFileStream(uploaded.key);
  const downloaded = await streamToBuffer(stream);
  if (downloaded.length !== payload.length || downloaded.toString() !== payload.toString()) {
    throw new Error(`bytes mismatch (up=${payload.length} down=${downloaded.length})`);
  }
  log(`stream ok contentType=${contentType} contentLength=${contentLength}`);

  // 3) Proxy URL
  const proxy = toProxyUrl(uploaded.url);
  if (!proxy || !proxy.startsWith('/api/media/')) {
    throw new Error(`toProxyUrl inesperado: ${proxy}`);
  }
  log(`proxy url = ${proxy}`);

  // 4) Delete
  await deleteFile(uploaded.key);
  try {
    await getFileStream(uploaded.key);
    throw new Error('archivo NO fue eliminado');
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      log('delete verificado (NoSuchKey)');
    } else {
      throw err;
    }
  }

  ok(`folder OK: ${folder}`);
};

const run = async () => {
  console.log('════════════════════════════════════════════════════');
  console.log('  Smoke test de integración Wasabi');
  console.log(`  Bucket: ${WASABI_BUCKET}`);
  console.log('════════════════════════════════════════════════════');

  try {
    await initBucket();

    const folders = [
      WASABI_FOLDERS.FIELDS_PHOTOS,
      WASABI_FOLDERS.PAYMENT_QR,
      WASABI_FOLDERS.RESERVATION_VOUCHERS,
      WASABI_FOLDERS.SITE_IMAGES,
      `${WASABI_FOLDERS.MONTHLY_VOUCHERS}/_smoke/_smoke`,
      `${WASABI_FOLDERS.REGISTRATION_REQUESTS}/_smoke`,
    ];

    for (const folder of folders) {
      try {
        await testFolder(folder);
      } catch (err) {
        fail(`${folder}: ${err.message}`);
        process.exitCode = 1;
      }
    }

    console.log('\n════════════════════════════════════════════════════');
    console.log(process.exitCode ? '❌ Smoke test con errores' : '✅ Smoke test OK');
    console.log('════════════════════════════════════════════════════\n');
  } catch (err) {
    fail('Error en initBucket o setup:', err.message);
    process.exitCode = 1;
  }
};

run().catch(err => {
  fail('Error inesperado:', err);
  process.exitCode = 1;
});
