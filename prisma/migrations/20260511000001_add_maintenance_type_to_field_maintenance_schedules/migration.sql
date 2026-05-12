-- Agrega la columna maintenance_type a field_maintenance_schedules.
-- Antes de este cambio el backend hardcodeaba 'general' / 'scheduled' al leer y
-- descartaba el tipo enviado por el frontend al guardar, por lo que el select
-- "Tipo" (Programado/Emergencia/Mejora) siempre volvía a "Programado" tras
-- recargar la configuración.
--
-- Valores válidos esperados desde el frontend: 'scheduled', 'emergency', 'improvement'.
-- Default 'scheduled' coincide con el primer option del select y aplica a las
-- filas existentes que no tenían tipo persistido.

ALTER TABLE "field_maintenance_schedules"
ADD COLUMN IF NOT EXISTS "maintenance_type" VARCHAR(20) NOT NULL DEFAULT 'scheduled';
