-- Agrega la columna display_order a sport_types.
-- Permite que el superadministrador defina el orden en que los deportes aparecen
-- en los filtros de reserva (landing y panel de cliente). El orden se persiste en
-- BD y es la fuente única de verdad para todos los listados de deportes.

ALTER TABLE "sport_types" ADD COLUMN IF NOT EXISTS "display_order" INTEGER;

-- Backfill: asignar un orden secuencial inicial basado en el orden alfabético
-- actual, de modo que no existan posiciones nulas ni saltos al activar la
-- funcionalidad. Incluye filas activas e inactivas para mantener consistencia.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS rn
  FROM "sport_types"
)
UPDATE "sport_types" s
SET display_order = o.rn
FROM ordered o
WHERE s.id = o.id;
