-- ============================================================================
-- Migración: Refactorización relacional de registration_requests
-- ----------------------------------------------------------------------------
-- Objetivo:
--   Reemplazar la columna `documents` (jsonb) por columnas relacionales
--   y tablas dedicadas para archivos adjuntos y deportes. Prohibido jsonb.
--
-- Orden:
--   1) Agregar nuevas columnas a registration_requests.
--   2) Crear tabla registration_request_files.
--   3) Crear tabla registration_request_sports.
--   4) La migración de datos (jsonb → nuevo esquema) se ejecuta por script
--      separado (scripts/migrate_registration_requests_documents.js).
--   5) El DROP de la columna `documents` se aplica en la migración
--      posterior `..._drop_registration_requests_documents_json`, sólo
--      después de verificar la migración de datos.
-- ============================================================================

-- 1) Columnas nuevas en registration_requests ------------------------------
ALTER TABLE "registration_requests"
  ADD COLUMN IF NOT EXISTS "business_ruc"             VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "business_phone"           VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "business_reference"       TEXT,
  ADD COLUMN IF NOT EXISTS "business_latitude"        DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS "business_longitude"       DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS "address_references"       TEXT,
  ADD COLUMN IF NOT EXISTS "experience"               TEXT,
  ADD COLUMN IF NOT EXISTS "reason_to_join"           TEXT,
  ADD COLUMN IF NOT EXISTS "credentials_username"     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "credentials_password_enc" TEXT;

-- 2) Tabla registration_request_files --------------------------------------
CREATE TABLE IF NOT EXISTS "registration_request_files" (
  "id"                      SERIAL PRIMARY KEY,
  "registration_request_id" INTEGER NOT NULL,
  "wasabi_key"              VARCHAR(500) NOT NULL,
  "original_name"           VARCHAR(255) NOT NULL,
  "mime_type"               VARCHAR(100) NOT NULL,
  "size_bytes"              BIGINT,
  "kind"                    VARCHAR(20) NOT NULL,
  "user_id_registration"    INTEGER,
  "date_time_registration"  TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "user_id_modification"    INTEGER,
  "date_time_modification"  TIMESTAMPTZ(6),
  CONSTRAINT "fk_registration_request_files_request"
    FOREIGN KEY ("registration_request_id")
    REFERENCES "registration_requests"("id")
    ON DELETE CASCADE,
  CONSTRAINT "chk_registration_request_files_kind"
    CHECK ("kind" IN ('document', 'photo'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_registration_request_files_wasabi_key"
  ON "registration_request_files"("wasabi_key");

CREATE INDEX IF NOT EXISTS "idx_registration_request_files_request"
  ON "registration_request_files"("registration_request_id");

CREATE INDEX IF NOT EXISTS "idx_registration_request_files_kind"
  ON "registration_request_files"("registration_request_id", "kind");

-- 3) Tabla registration_request_sports -------------------------------------
CREATE TABLE IF NOT EXISTS "registration_request_sports" (
  "id"                      SERIAL PRIMARY KEY,
  "registration_request_id" INTEGER NOT NULL,
  "sport_type_id"           INTEGER NOT NULL,
  "user_id_registration"    INTEGER,
  "date_time_registration"  TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_registration_request_sports_request"
    FOREIGN KEY ("registration_request_id")
    REFERENCES "registration_requests"("id")
    ON DELETE CASCADE,
  CONSTRAINT "fk_registration_request_sports_sport_type"
    FOREIGN KEY ("sport_type_id")
    REFERENCES "sport_types"("id")
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_registration_request_sports_pair"
  ON "registration_request_sports"("registration_request_id", "sport_type_id");

CREATE INDEX IF NOT EXISTS "idx_registration_request_sports_request"
  ON "registration_request_sports"("registration_request_id");

-- 4) Expandir columnas VARCHAR(500) que pueden guardar presigned URLs -----
--    Presigned URLs con query params pueden exceder 500 chars.
ALTER TABLE "monthly_payments"
  ALTER COLUMN "payment_voucher_url" TYPE TEXT;
