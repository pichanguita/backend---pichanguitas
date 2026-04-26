-- ============================================================================
-- LIMPIEZA DE ESQUEMA DE LOGROS / GAMIFICACIÓN  (versión idempotente)
-- Fecha: 2026-04-24
-- ----------------------------------------------------------------------------
-- Esta migración debe poder ejecutarse sobre BDs en distintos estados, ya que
-- en algún entorno (producción) el esquema fue sincronizado previamente con
-- `prisma db push`, dejando la tabla `badges` ya sin la columna legacy
-- `criteria_type`. Por eso todas las operaciones son condicionales o
-- idempotentes y no asumen un estado de partida concreto.
-- ============================================================================
-- 1. Renombra calculation_type 'consecutive' -> 'streak' (alinea con el código).
-- 2. Backfill de badges.criteria_id desde criteria_type (sólo si la columna
--    legacy aún existe).
-- 3. Elimina badges huérfanos (sin criterio válido). El cascade limpia
--    customer_badges asociadas a esos badges rotos.
-- 4. Hace badges.criteria_id NOT NULL para garantizar integridad.
-- 5. Elimina la columna deprecada badges.criteria_type si todavía existe.
-- 6. Agrega badge_criteria.unit (unidad de medida usada en UI; reemplaza
--    el hardcodeo del frontend).
-- 7. Pobla unit en los criterios canónicos cuando esté vacío.
-- ============================================================================

-- 1. Renombrar criterios obsoletos (idempotente)
UPDATE "badge_criteria"
SET "calculation_type" = 'streak'
WHERE "calculation_type" = 'consecutive';

-- 2. Backfill criteria_id desde criteria_type sólo si la columna legacy existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name   = 'badges'
      AND column_name  = 'criteria_type'
  ) THEN
    UPDATE "badges" b
    SET "criteria_id" = bc."id"
    FROM "badge_criteria" bc
    WHERE b."criteria_id" IS NULL
      AND b."criteria_type" = bc."code";
  END IF;
END
$$;

-- 3. Eliminar badges huérfanos (cascade limpia customer_badges asociadas)
DELETE FROM "badges" WHERE "criteria_id" IS NULL;

-- 4. Asegurar integridad: criteria_id es obligatorio
--    PostgreSQL no falla si la columna ya es NOT NULL, así que es idempotente.
ALTER TABLE "badges" ALTER COLUMN "criteria_id" SET NOT NULL;

-- 5. Eliminar columna deprecada criteria_type (si aún existe)
ALTER TABLE "badges" DROP COLUMN IF EXISTS "criteria_type";

-- 6. Agregar columna unit a badge_criteria (unidad de medida para UI)
ALTER TABLE "badge_criteria"
  ADD COLUMN IF NOT EXISTS "unit" VARCHAR(50);

-- 7. Poblar unit en criterios existentes según code (idempotente)
UPDATE "badge_criteria" SET "unit" = 'reservas' WHERE "code" = 'total_reservations' AND ("unit" IS NULL OR "unit" = '');
UPDATE "badge_criteria" SET "unit" = 'horas'    WHERE "code" = 'total_hours'        AND ("unit" IS NULL OR "unit" = '');
UPDATE "badge_criteria" SET "unit" = 'S/'       WHERE "code" = 'total_spent'        AND ("unit" IS NULL OR "unit" = '');
UPDATE "badge_criteria" SET "unit" = 'reseñas'  WHERE "code" = 'total_reviews'      AND ("unit" IS NULL OR "unit" = '');
UPDATE "badge_criteria" SET "unit" = 'semanas'  WHERE "code" = 'consecutive_weeks'  AND ("unit" IS NULL OR "unit" = '');
