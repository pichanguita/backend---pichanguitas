-- Agrega la columna sport_type a reservations.
-- Permite registrar qué deporte se realizará en una reserva específica cuando
-- la cancha es multi-deporte (la columna fields.sport_type representa el
-- deporte principal/sugerido, no el elegido por el cliente al reservar).
-- NULL es válido y representa "no especificado" (canchas mono-deporte o
-- reservas legacy creadas antes de esta migración).

ALTER TABLE "reservations"
ADD COLUMN IF NOT EXISTS "sport_type" INTEGER;

-- FK opcional: si el deporte se elimina (soft delete), no perdemos la reserva.
ALTER TABLE "reservations"
ADD CONSTRAINT "fk_reservations_sport_type"
FOREIGN KEY ("sport_type") REFERENCES "sport_types"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "idx_reservations_sport_type"
ON "reservations"("sport_type");
