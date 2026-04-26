-- Eliminar columna reward_hours de badge_tiers.
-- Las insignias ya no otorgan horas gratis; esas solo se obtienen por promociones.
ALTER TABLE "badge_tiers" DROP COLUMN IF EXISTS "reward_hours";
