-- La unicidad del nombre de insignia debe aplicar SOLO entre insignias no
-- eliminadas. El soft-delete (deleteBadge) marca status = 'inactive', por lo que
-- una insignia eliminada debe liberar su nombre para poder volver a crearse otra
-- con el mismo nombre.
--
-- El índice único anterior (badges_name_key) era total y sobre "name"
-- (case-sensitive), por lo que un registro 'inactive' seguía bloqueando el
-- nombre. Se reemplaza por un índice ÚNICO PARCIAL sobre LOWER(name) que solo
-- abarca las insignias activas (status <> 'inactive'). Se usa LOWER(name) para
-- ser coherente con la validación de la aplicación (badgeNameExists), que es
-- case-insensitive.
--
-- Idempotente: usa IF EXISTS / IF NOT EXISTS.

DROP INDEX IF EXISTS "badges_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "badges_name_key"
  ON "badges" (LOWER("name"))
  WHERE "status" <> 'inactive';
