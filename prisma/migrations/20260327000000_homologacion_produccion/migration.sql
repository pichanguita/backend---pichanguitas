-- ============================================================================
-- MIGRACIÓN DE HOMOLOGACIÓN: Schema.prisma ↔ Railway ↔ Local
-- Fecha: 2026-03-27
-- ============================================================================
-- Esta migración sincroniza las 3 fuentes de verdad:
--   1. Crea gamification_config (existía en Railway, faltaba en schema+local)
--   2. Agrega discount_type a field_special_pricing (existía en Railway, faltaba en schema+local)
--   3. Elimina whatsapp_configs (eliminada de Railway, sobraba en schema+local)
--   4. Elimina tablas huérfanas field_special_pricing_days/slots (sin uso en código)
--
-- Todas las operaciones usan IF EXISTS/IF NOT EXISTS para ser idempotentes.
-- ============================================================================

-- ============================================================================
-- 1. CREAR TABLA gamification_config
-- ============================================================================
CREATE TABLE IF NOT EXISTS "gamification_config" (
    "id" SERIAL NOT NULL,
    "config_key" VARCHAR(100) NOT NULL,
    "config_value" VARCHAR(500),
    "description" VARCHAR(255),
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gamification_config_pkey" PRIMARY KEY ("id")
);

-- Índice único en config_key
CREATE UNIQUE INDEX IF NOT EXISTS "gamification_config_config_key_key" ON "gamification_config"("config_key");

-- Seed de datos iniciales (solo si la tabla está vacía)
INSERT INTO "gamification_config" ("config_key", "config_value", "description")
SELECT 'is_active', 'true', 'Sistema de gamificación activo/inactivo'
WHERE NOT EXISTS (SELECT 1 FROM "gamification_config" WHERE "config_key" = 'is_active');

INSERT INTO "gamification_config" ("config_key", "config_value", "description")
SELECT 'auto_assign', 'true', 'Asignación automática de insignias'
WHERE NOT EXISTS (SELECT 1 FROM "gamification_config" WHERE "config_key" = 'auto_assign');

INSERT INTO "gamification_config" ("config_key", "config_value", "description")
SELECT 'notify_clients', 'true', 'Notificar a clientes cuando obtienen insignias'
WHERE NOT EXISTS (SELECT 1 FROM "gamification_config" WHERE "config_key" = 'notify_clients');

INSERT INTO "gamification_config" ("config_key", "config_value", "description")
SELECT 'notify_admin', 'true', 'Notificar a administradores sobre nuevas insignias'
WHERE NOT EXISTS (SELECT 1 FROM "gamification_config" WHERE "config_key" = 'notify_admin');

INSERT INTO "gamification_config" ("config_key", "config_value", "description")
SELECT 'show_in_profile', 'true', 'Mostrar insignias en perfil del cliente'
WHERE NOT EXISTS (SELECT 1 FROM "gamification_config" WHERE "config_key" = 'show_in_profile');

INSERT INTO "gamification_config" ("config_key", "config_value", "description")
SELECT 'show_public_ranking', 'true', 'Mostrar ranking público de clientes'
WHERE NOT EXISTS (SELECT 1 FROM "gamification_config" WHERE "config_key" = 'show_public_ranking');

INSERT INTO "gamification_config" ("config_key", "config_value", "description")
SELECT 'hide_locked_badges', 'false', 'Ocultar insignias bloqueadas'
WHERE NOT EXISTS (SELECT 1 FROM "gamification_config" WHERE "config_key" = 'hide_locked_badges');

INSERT INTO "gamification_config" ("config_key", "config_value", "description")
SELECT 'enable_rewards', 'true', 'Habilitar recompensas (horas gratis)'
WHERE NOT EXISTS (SELECT 1 FROM "gamification_config" WHERE "config_key" = 'enable_rewards');

-- ============================================================================
-- 2. AGREGAR columnas faltantes a social_media
-- ============================================================================
ALTER TABLE "social_media"
ADD COLUMN IF NOT EXISTS "color" VARCHAR(20) DEFAULT '#22c55e';

ALTER TABLE "social_media"
ADD COLUMN IF NOT EXISTS "is_phone" BOOLEAN DEFAULT false;

-- ============================================================================
-- 3. AGREGAR discount_type A field_special_pricing
-- ============================================================================
ALTER TABLE "field_special_pricing"
ADD COLUMN IF NOT EXISTS "discount_type" VARCHAR(20) NOT NULL DEFAULT 'percentage';

-- ============================================================================
-- 3. ELIMINAR TABLA whatsapp_configs (obsoleta)
-- ============================================================================
ALTER TABLE IF EXISTS "whatsapp_configs"
DROP CONSTRAINT IF EXISTS "fk_whatsapp_configs_user";

DROP TABLE IF EXISTS "whatsapp_configs";

-- ============================================================================
-- 4. ELIMINAR TABLAS HUÉRFANAS (sin uso en código)
-- ============================================================================
DROP TABLE IF EXISTS "field_special_pricing_days";
DROP TABLE IF EXISTS "field_special_pricing_slots";
