/**
 * Migración: sube archivos locales de backend_pichanguitas/uploads/
 * a Wasabi preservando la estructura de carpetas, y actualiza las
 * referencias `/uploads/...` que hayan quedado en BD.
 *
 * Uso:
 *   node scripts/migrate_local_uploads_to_wasabi.js            # sube + actualiza BD
 *   node scripts/migrate_local_uploads_to_wasabi.js --dry-run  # sólo reporta
 *   node scripts/migrate_local_uploads_to_wasabi.js --delete-local  # además borra archivos locales tras subir
 *
 * Idempotente: los objetos en Wasabi se sobreescriben con el mismo key.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = require('../config/db');
const { s3Client, WASABI_BUCKET } = require('../config/wasabi');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getPublicUrl } = require('../services/wasabiService');

const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_LOCAL = process.argv.includes('--delete-local');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

const guessMime = filename => {
  const ext = path.extname(filename).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
};

const log = (...args) => console.log('[upload-migrate]', ...args);
const warn = (...args) => console.warn('[upload-migrate][WARN]', ...args);

const walk = dir => {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
};

const uploadLocalFile = async (absPath, key) => {
  const buffer = fs.readFileSync(absPath);
  const contentType = guessMime(absPath);
  if (DRY_RUN) {
    log(`[dry] subiría ${absPath} → s3://${WASABI_BUCKET}/${key}`);
    return;
  }
  await s3Client.send(
    new PutObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
};

const updateLegacyUrls = async () => {
  const updates = [
    {
      table: 'field_images',
      column: 'image_url',
      description: 'Fotos de canchas',
    },
    {
      table: 'reservations',
      column: 'payment_voucher_url',
      description: 'Vouchers de reservas',
    },
    {
      table: 'monthly_payments',
      column: 'payment_voucher_url',
      description: 'Vouchers de mensualidades',
    },
    {
      table: 'field_payment_methods',
      column: 'qr_image_url',
      description: 'QR de métodos de pago',
    },
  ];

  for (const { table, column, description } of updates) {
    const selectSql = `SELECT id, ${column} FROM ${table} WHERE ${column} LIKE '/uploads/%'`;
    const rows = (await pool.query(selectSql)).rows;
    log(`${description} (${table}.${column}): ${rows.length} con ruta /uploads/`);
    for (const row of rows) {
      const key = row[column].replace(/^\/uploads\//, '');
      const newUrl = getPublicUrl(key);
      if (DRY_RUN) {
        log(`[dry] ${table}#${row.id}: ${row[column]} → ${newUrl}`);
      } else {
        await pool.query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [newUrl, row.id]);
        log(`${table}#${row.id}: URL actualizada`);
      }
    }
  }

  // site_config (jsonb con url dentro)
  const siteRows = (
    await pool.query(
      `SELECT id, key, value FROM site_config WHERE value->>'url' LIKE '/uploads/%'`
    )
  ).rows;
  log(`site_config con /uploads/ en value.url: ${siteRows.length}`);
  for (const row of siteRows) {
    const key = row.value.url.replace(/^\/uploads\//, '');
    const newUrl = getPublicUrl(key);
    const newValue = { ...row.value, url: newUrl };
    if (DRY_RUN) {
      log(`[dry] site_config#${row.id} (${row.key}): ${row.value.url} → ${newUrl}`);
    } else {
      await pool.query(`UPDATE site_config SET value = $1 WHERE id = $2`, [
        JSON.stringify(newValue),
        row.id,
      ]);
      log(`site_config#${row.id} (${row.key}): URL actualizada`);
    }
  }
};

const run = async () => {
  try {
    if (!fs.existsSync(UPLOADS_ROOT)) {
      log(`No existe ${UPLOADS_ROOT} — nada que migrar`);
      return;
    }

    const files = walk(UPLOADS_ROOT);
    log(`Encontrados ${files.length} archivos locales bajo uploads/`);
    if (DRY_RUN) log('(modo dry-run; no se escribe nada)');

    let uploaded = 0;
    for (const absPath of files) {
      const rel = path.relative(UPLOADS_ROOT, absPath).split(path.sep).join('/');
      // El "key" en Wasabi replica la estructura bajo uploads/
      try {
        await uploadLocalFile(absPath, rel);
        uploaded += 1;
        log(`OK  ${rel}`);
      } catch (err) {
        warn(`Falló ${rel}: ${err.message}`);
      }
    }

    log(`Subidos a Wasabi: ${uploaded}/${files.length}`);

    log('Actualizando referencias /uploads/... en BD');
    await updateLegacyUrls();

    if (DELETE_LOCAL && !DRY_RUN) {
      log('Eliminando archivos locales tras subida OK');
      for (const absPath of files) {
        try {
          fs.unlinkSync(absPath);
        } catch (err) {
          warn(`No se pudo borrar ${absPath}: ${err.message}`);
        }
      }
      // Intentar limpiar directorios vacíos
      const rmDirRecursive = dir => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) rmDirRecursive(path.join(dir, entry.name));
        }
        if (fs.readdirSync(dir).length === 0 && dir !== UPLOADS_ROOT) {
          fs.rmdirSync(dir);
        }
      };
      rmDirRecursive(UPLOADS_ROOT);
    }

    log('Migración de uploads local → Wasabi finalizada');
  } catch (err) {
    console.error('[upload-migrate][ERROR]', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
