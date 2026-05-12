-- Reemplaza el índice UNIQUE global sobre sport_types.name por uno parcial
-- que solo aplica a registros activos (status = 'active').
-- Motivo: el soft-delete dejaba la fila con status='inactive' bloqueando la
-- recreación de un deporte con el mismo nombre, porque el UNIQUE global no
-- distinguía filas vivas de filas borradas. Con el índice parcial, los
-- deportes eliminados ya no afectan la creación ni la edición de los activos.
-- Adicionalmente, el índice usa LOWER(name) para que la unicidad sea
-- case-insensitive, alineado con la verificación aplicativa (LOWER(name)).

DROP INDEX IF EXISTS "sport_types_name_key";

CREATE UNIQUE INDEX "sport_types_active_name_uk"
  ON "sport_types" (LOWER("name"))
  WHERE "status" = 'active';
