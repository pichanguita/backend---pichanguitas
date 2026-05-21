-- ============================================================
-- MIGRACIÓN: Tabla dedicada video_tutorials
-- ============================================================
-- Reemplaza el almacenamiento legacy de tutoriales en
-- site_config (key='tutorialReserva' / 'tutorialAdmin', value JSONB)
-- por una tabla con columnas tipadas. Catálogo cerrado (2 filas).
--
-- Idempotente: usa IF NOT EXISTS / ON CONFLICT.
-- Transaccional: rollback completo si algo falla.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tabla
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_tutorials (
    id                     SERIAL PRIMARY KEY,
    slug                   VARCHAR(50)  NOT NULL UNIQUE,
    title                  VARCHAR(255) NOT NULL,
    description            TEXT         NOT NULL DEFAULT '',
    video_url              TEXT         NOT NULL DEFAULT '',
    sort_order             INTEGER      NOT NULL DEFAULT 0,
    is_active              BOOLEAN      NOT NULL DEFAULT TRUE,
    user_id_registration   INTEGER,
    date_time_registration TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    user_id_modification   INTEGER,
    date_time_modification TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS idx_video_tutorials_active_sort
    ON video_tutorials (is_active, sort_order);

-- ------------------------------------------------------------
-- 2. Seed inicial (2 tutoriales canónicos)
-- ------------------------------------------------------------
INSERT INTO video_tutorials (slug, title, description, video_url, sort_order)
VALUES
    ('tutorial_reserva',
     '¿Cómo reservar una cancha?',
     'Aprende a reservar tu cancha en pocos pasos',
     '',
     10),
    ('tutorial_admin',
     'Cómo registrarse como admin',
     'Inscribe tu cancha y administra tus reservas',
     '',
     20)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Migrar URLs legacy desde site_config (si existen)
--    Se preservan title/description del seed (los legacy en BD
--    nunca contuvieron texto del admin: solo URL y un 'alt' fijo).
-- ------------------------------------------------------------
UPDATE video_tutorials vt
SET video_url = (sc.value->>'url')
FROM site_config sc
WHERE sc.key = 'tutorialReserva'
  AND vt.slug = 'tutorial_reserva'
  AND sc.value->>'url' IS NOT NULL
  AND sc.value->>'url' <> '';

UPDATE video_tutorials vt
SET video_url = (sc.value->>'url')
FROM site_config sc
WHERE sc.key = 'tutorialAdmin'
  AND vt.slug = 'tutorial_admin'
  AND sc.value->>'url' IS NOT NULL
  AND sc.value->>'url' <> '';

-- ------------------------------------------------------------
-- 4. Limpiar filas legacy de site_config
-- ------------------------------------------------------------
DELETE FROM site_config WHERE key IN ('tutorialReserva', 'tutorialAdmin');

COMMIT;
