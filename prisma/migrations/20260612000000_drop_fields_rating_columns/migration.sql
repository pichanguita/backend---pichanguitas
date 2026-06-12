-- Eliminación de columnas obsoletas fields.rating y fields.total_reviews.
--
-- El promedio de calificación y el conteo de reseñas de cada cancha ahora se
-- derivan SIEMPRE de la tabla `reviews` (solo reseñas visibles y activas) en
-- tiempo de consulta, dentro de getAllFields. Estas columnas guardaban un valor
-- que nunca se recalculaba (la función updateFieldRating no se invocaba), por lo
-- que quedaban desincronizadas. Se eliminan para tener una única fuente de
-- verdad y evitar confusiones por datos duplicados/obsoletos.
ALTER TABLE "fields" DROP COLUMN IF EXISTS "rating";
ALTER TABLE "fields" DROP COLUMN IF EXISTS "total_reviews";
