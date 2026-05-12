-- Agregar columna requires_manual_confirmation a fields
-- Cuando es true, las reservas creadas por clientes quedan en estado "pending"
-- hasta que el administrador de la cancha las apruebe o rechace manualmente.
ALTER TABLE fields
  ADD COLUMN requires_manual_confirmation BOOLEAN DEFAULT false;

-- Backfill: dejar las canchas existentes en false (modo automático actual)
UPDATE fields
SET requires_manual_confirmation = false
WHERE requires_manual_confirmation IS NULL;

-- Forzar NOT NULL para evitar tri-estado en lectura
ALTER TABLE fields
  ALTER COLUMN requires_manual_confirmation SET NOT NULL;
