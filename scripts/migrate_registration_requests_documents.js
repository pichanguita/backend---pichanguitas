/**
 * Migración de datos: registration_requests.documents (jsonb) → esquema relacional.
 *
 * Lee cada fila con `documents` no nula y pobla:
 *   - columnas business_*, address_references, experience, reason_to_join,
 *     credentials_username, credentials_password_enc en registration_requests
 *   - registration_request_files (a partir de uploadedFiles[])
 *   - registration_request_sports (a partir de sportTypes[])
 *
 * Idempotente:
 *   - Las columnas se actualizan sólo si están vacías.
 *   - Los archivos se insertan con ON CONFLICT (wasabi_key) DO NOTHING.
 *   - Los deportes se insertan con ON CONFLICT (request_id, sport_type_id) DO NOTHING.
 *
 * Uso:
 *   node scripts/migrate_registration_requests_documents.js [--dry-run]
 */

require('dotenv').config();
const pool = require('../config/db');
const { extractKeyFromUrl } = require('../services/wasabiService');

const DRY_RUN = process.argv.includes('--dry-run');

const log = (...args) => console.log('[migrate]', ...args);
const warn = (...args) => console.warn('[migrate][WARN]', ...args);

const parseDocuments = raw => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
};

const normalizeKind = fieldname => {
  if (!fieldname) return 'document';
  const value = String(fieldname).toLowerCase();
  if (value.includes('photo') || value.includes('image') || value.includes('foto')) {
    return 'photo';
  }
  return 'document';
};

const migrateRow = async (client, row) => {
  const documents = parseDocuments(row.documents);
  if (!documents) return { skipped: true, reason: 'empty documents' };

  const credentials = documents.credentials || {};
  const businessCoords = documents.businessCoordinates || {};
  const updates = {
    business_ruc: documents.businessRuc || null,
    business_phone: documents.businessPhone || null,
    business_reference: documents.businessReference || null,
    business_latitude: businessCoords.latitude ?? null,
    business_longitude: businessCoords.longitude ?? null,
    address_references: documents.addressReferences || null,
    experience: documents.experience || null,
    reason_to_join: documents.reasonToJoin || null,
    credentials_username: credentials.username || null,
    credentials_password_enc: credentials.password || null,
  };

  if (!DRY_RUN) {
    await client.query(
      `UPDATE registration_requests SET
         business_ruc             = COALESCE(business_ruc, $2),
         business_phone           = COALESCE(business_phone, $3),
         business_reference       = COALESCE(business_reference, $4),
         business_latitude        = COALESCE(business_latitude, $5),
         business_longitude       = COALESCE(business_longitude, $6),
         address_references       = COALESCE(address_references, $7),
         experience               = COALESCE(experience, $8),
         reason_to_join           = COALESCE(reason_to_join, $9),
         credentials_username     = COALESCE(credentials_username, $10),
         credentials_password_enc = COALESCE(credentials_password_enc, $11)
       WHERE id = $1`,
      [
        row.id,
        updates.business_ruc,
        updates.business_phone,
        updates.business_reference,
        updates.business_latitude,
        updates.business_longitude,
        updates.address_references,
        updates.experience,
        updates.reason_to_join,
        updates.credentials_username,
        updates.credentials_password_enc,
      ]
    );
  }

  // Archivos
  const uploadedFiles = Array.isArray(documents.uploadedFiles)
    ? documents.uploadedFiles
    : [];
  let filesInserted = 0;
  for (const file of uploadedFiles) {
    const wasabiKey = file.wasabiKey || extractKeyFromUrl(file.path);
    if (!wasabiKey) {
      warn(`request_id=${row.id} file sin wasabi_key resoluble, omitido:`, file.originalname);
      continue;
    }
    const kind = normalizeKind(file.fieldname);
    if (!DRY_RUN) {
      const result = await client.query(
        `INSERT INTO registration_request_files
           (registration_request_id, wasabi_key, original_name, mime_type,
            size_bytes, kind, user_id_registration, date_time_registration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_TIMESTAMP))
         ON CONFLICT (wasabi_key) DO NOTHING
         RETURNING id`,
        [
          row.id,
          wasabiKey,
          file.originalname || file.filename || 'archivo',
          file.mimetype || 'application/octet-stream',
          file.size || null,
          kind,
          row.user_id_registration || null,
          row.date_time_registration || null,
        ]
      );
      if (result.rowCount > 0) filesInserted += 1;
    } else {
      filesInserted += 1;
    }
  }

  // Deportes
  const sportNames = Array.isArray(documents.sportTypes) ? documents.sportTypes : [];
  let sportsInserted = 0;
  for (const sportName of sportNames) {
    if (!sportName) continue;
    const sportResult = await client.query(
      `SELECT id FROM sport_types WHERE name = $1 LIMIT 1`,
      [sportName]
    );
    if (sportResult.rows.length === 0) {
      warn(`request_id=${row.id} deporte no encontrado en sport_types: ${sportName}`);
      continue;
    }
    const sportTypeId = sportResult.rows[0].id;
    if (!DRY_RUN) {
      const result = await client.query(
        `INSERT INTO registration_request_sports
           (registration_request_id, sport_type_id, user_id_registration)
         VALUES ($1, $2, $3)
         ON CONFLICT (registration_request_id, sport_type_id) DO NOTHING
         RETURNING id`,
        [row.id, sportTypeId, row.user_id_registration || null]
      );
      if (result.rowCount > 0) sportsInserted += 1;
    } else {
      sportsInserted += 1;
    }
  }

  return { migrated: true, filesInserted, sportsInserted };
};

const run = async () => {
  const client = await pool.connect();
  let totalRows = 0;
  let migratedRows = 0;
  let totalFiles = 0;
  let totalSports = 0;

  try {
    if (!DRY_RUN) await client.query('BEGIN');

    const rows = await client.query(
      `SELECT id, documents, user_id_registration, date_time_registration
       FROM registration_requests
       WHERE documents IS NOT NULL
       ORDER BY id ASC`
    );

    totalRows = rows.rowCount;
    log(`Encontradas ${totalRows} filas con documents jsonb`);
    if (DRY_RUN) log('(modo dry-run; no se escribe nada)');

    for (const row of rows.rows) {
      const result = await migrateRow(client, row);
      if (result.migrated) {
        migratedRows += 1;
        totalFiles += result.filesInserted;
        totalSports += result.sportsInserted;
        log(
          `request_id=${row.id} OK — archivos=${result.filesInserted}, deportes=${result.sportsInserted}`
        );
      } else {
        log(`request_id=${row.id} omitido: ${result.reason}`);
      }
    }

    if (!DRY_RUN) await client.query('COMMIT');

    log('━'.repeat(50));
    log(`Filas procesadas: ${totalRows}`);
    log(`Filas migradas:   ${migratedRows}`);
    log(`Archivos insertados: ${totalFiles}`);
    log(`Deportes insertados: ${totalSports}`);
    log('Migración finalizada correctamente');
  } catch (err) {
    if (!DRY_RUN) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackErr) {
        /* noop */
      }
    }
    console.error('[migrate][ERROR]', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
