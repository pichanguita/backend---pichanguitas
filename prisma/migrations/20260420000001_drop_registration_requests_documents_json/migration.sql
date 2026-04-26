-- ============================================================================
-- Migración: eliminar columna `documents` jsonb de registration_requests.
-- ----------------------------------------------------------------------------
-- REQUISITO PREVIO:
--   Ejecutar antes `node scripts/migrate_registration_requests_documents.js`
--   y verificar que los datos migraron correctamente a:
--     - columnas planas de registration_requests
--     - registration_request_files
--     - registration_request_sports
--
-- Esta migración es IRREVERSIBLE en datos.
-- ============================================================================

ALTER TABLE "registration_requests" DROP COLUMN IF EXISTS "documents";
