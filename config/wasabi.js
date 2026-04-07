/**
 * Configuración del cliente S3 para Wasabi
 *
 * Wasabi es compatible con la API de AWS S3, por lo que usamos @aws-sdk/client-s3
 * con el endpoint personalizado de Wasabi.
 */

const { S3Client } = require('@aws-sdk/client-s3');

const WASABI_REGION = process.env.WASABI_REGION || 'us-east-1';
const WASABI_ENDPOINT = process.env.WASABI_ENDPOINT || `https://s3.${WASABI_REGION}.wasabisys.com`;

const s3Client = new S3Client({
  region: WASABI_REGION,
  endpoint: WASABI_ENDPOINT,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY,
    secretAccessKey: process.env.WASABI_SECRET_KEY,
  },
  forcePathStyle: true,
});

const WASABI_BUCKET = process.env.WASABI_BUCKET || 'pichanguitas-uploads';

module.exports = {
  s3Client,
  WASABI_BUCKET,
  WASABI_REGION,
  WASABI_ENDPOINT,
};
