-- Fix: Agregar columnas faltantes a field_special_pricing
-- La tabla fue creada sin las columnas time_ranges y days que el schema define
-- Esto causaba: ERROR 42703 "column fsp.time_ranges does not exist"
-- que impedía cargar TODAS las canchas (GET /api/fields retornaba 500)

ALTER TABLE "field_special_pricing" ADD COLUMN IF NOT EXISTS "time_ranges" JSONB;
ALTER TABLE "field_special_pricing" ADD COLUMN IF NOT EXISTS "days" JSONB;
ALTER TABLE "field_special_pricing" ADD COLUMN IF NOT EXISTS "discount_type" VARCHAR(50);
