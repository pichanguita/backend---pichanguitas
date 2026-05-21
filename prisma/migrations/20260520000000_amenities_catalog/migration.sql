-- ============================================================
-- MIGRACIÓN: Catálogo de amenities + FK en field_amenities
-- ============================================================
-- Reemplaza la columna VARCHAR `amenity` de field_amenities por
-- un FK `amenity_id` que apunta a la nueva tabla amenities_catalog.
--
-- Es idempotente: puede ejecutarse múltiples veces sin efectos
-- secundarios (usa IF NOT EXISTS / ON CONFLICT).
--
-- IMPORTANTE: ejecutar dentro de una sola transacción.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tabla catálogo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amenities_catalog (
    id                     SERIAL PRIMARY KEY,
    key                    VARCHAR(50)  NOT NULL UNIQUE,
    label                  VARCHAR(100) NOT NULL,
    icon_name              VARCHAR(50)  NOT NULL,
    color_class            VARCHAR(50)  NOT NULL,
    sort_order             INTEGER      NOT NULL DEFAULT 0,
    is_active              BOOLEAN      NOT NULL DEFAULT TRUE,
    date_time_registration TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    date_time_modification TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS idx_amenities_catalog_active_sort
    ON amenities_catalog (is_active, sort_order);

-- ------------------------------------------------------------
-- 2. Seed del catálogo (las 9 amenidades canónicas que el form
--    de admin permite marcar). icon_name son iconos Lucide.
-- ------------------------------------------------------------
INSERT INTO amenities_catalog (key, label, icon_name, color_class, sort_order)
VALUES
    ('bar',            'Bar',                         'Beer',      'bg-orange-600', 10),
    ('drinks',         'Venta de Bebidas',            'GlassWater','bg-blue-500',   20),
    ('snacks',         'Venta de Snacks',             'Cookie',    'bg-amber-600',  30),
    ('parking',        'Estacionamiento',             'Car',       'bg-blue-600',   40),
    ('changing_rooms', 'Vestuarios',                  'DoorOpen',  'bg-cyan-600',   50),
    ('showers',        'Duchas',                      'Droplets',  'bg-teal-600',   60),
    ('wifi',           'WiFi',                        'Wifi',      'bg-purple-600', 70),
    ('security',       'Seguridad',                   'Shield',    'bg-red-600',    80),
    ('first_aid',      'Botiquín Primeros Auxilios',  'HeartPulse','bg-rose-600',   90)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Agregar columna amenity_id a field_amenities (si no existe)
-- ------------------------------------------------------------
ALTER TABLE field_amenities
    ADD COLUMN IF NOT EXISTS amenity_id INTEGER;

-- ------------------------------------------------------------
-- 4. Backfill: mapear strings legacy a IDs del catálogo.
--    Match por label exacto, key, o por contenido (case-insensitive,
--    sin acentos) para tolerar variantes históricas como
--    "Botiquin Primeros Auxilios" / "Primeros auxilios" / etc.
-- ------------------------------------------------------------
-- Helper local: función sin acentos. Se crea solo si no existe.
CREATE EXTENSION IF NOT EXISTS unaccent;

UPDATE field_amenities fa
SET amenity_id = ac.id
FROM amenities_catalog ac
WHERE fa.amenity_id IS NULL
  AND fa.amenity IS NOT NULL
  AND (
        LOWER(unaccent(ac.label)) = LOWER(unaccent(fa.amenity))
     OR LOWER(unaccent(ac.key))   = LOWER(unaccent(fa.amenity))
     OR (
            ac.key = 'first_aid'
        AND LOWER(unaccent(fa.amenity)) LIKE '%primeros auxilios%'
        )
     OR (
            ac.key = 'changing_rooms'
        AND LOWER(unaccent(fa.amenity)) = 'vestuarios'
        )
     OR (
            ac.key = 'drinks'
        AND LOWER(unaccent(fa.amenity)) IN ('venta de bebidas', 'bebidas')
        )
     OR (
            ac.key = 'snacks'
        AND LOWER(unaccent(fa.amenity)) IN ('venta de snacks', 'snacks')
        )
  );

-- ------------------------------------------------------------
-- 5. Eliminar filas legacy que no corresponden al catálogo
--    (p. ej. "Césped sintético"/"Césped natural" que duplicaban
--    field_dimensions.surface_type, y el fallback "Cancha deportiva").
-- ------------------------------------------------------------
DELETE FROM field_amenities WHERE amenity_id IS NULL;

-- ------------------------------------------------------------
-- 6. Hacer amenity_id NOT NULL y FK
-- ------------------------------------------------------------
ALTER TABLE field_amenities
    ALTER COLUMN amenity_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_field_amenities_amenity'
    ) THEN
        ALTER TABLE field_amenities
            ADD CONSTRAINT fk_field_amenities_amenity
            FOREIGN KEY (amenity_id) REFERENCES amenities_catalog(id)
            ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END$$;

-- ------------------------------------------------------------
-- 7. Unicidad por (field_id, amenity_id) — evita duplicados
--    como los que causaban "Duchas/Vestuarios" repetido en UI.
-- ------------------------------------------------------------
-- Limpieza preventiva de duplicados antes de imponer la unique.
DELETE FROM field_amenities a
USING field_amenities b
WHERE a.id < b.id
  AND a.field_id   = b.field_id
  AND a.amenity_id = b.amenity_id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_field_amenities_field_amenity'
    ) THEN
        ALTER TABLE field_amenities
            ADD CONSTRAINT uq_field_amenities_field_amenity
            UNIQUE (field_id, amenity_id);
    END IF;
END$$;

-- ------------------------------------------------------------
-- 8. Eliminar la columna VARCHAR `amenity` (legacy)
-- ------------------------------------------------------------
ALTER TABLE field_amenities DROP COLUMN IF EXISTS amenity;

COMMIT;
