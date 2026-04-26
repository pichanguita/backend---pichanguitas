-- ============================================================================
-- Migración: habilitar registro real de actividad de usuarios.
-- ----------------------------------------------------------------------------
-- Agrega columnas description y status a activity_logs para que el FE pueda
-- mostrar texto legible y clasificar por éxito/error. Se preserva la columna
-- jsonb `details` por compatibilidad, pero se deja de usarla (deuda técnica
-- documentada). Se crean índices para consulta por user_id y entity_type.
-- ============================================================================

ALTER TABLE "activity_logs"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "status"      VARCHAR(20) NOT NULL DEFAULT 'info';

CREATE INDEX IF NOT EXISTS "idx_activity_logs_user_id"
  ON "activity_logs" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_activity_logs_user_entity"
  ON "activity_logs" ("user_id", "entity_type");

CREATE INDEX IF NOT EXISTS "idx_activity_logs_date"
  ON "activity_logs" ("date_time_registration" DESC);
