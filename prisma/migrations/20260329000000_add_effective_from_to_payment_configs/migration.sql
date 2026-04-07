-- Agregar campo effective_from (fecha de inicio de vigencia) a payment_configs
-- Este campo determina desde qué fecha se generan/controlan los pagos mensuales
ALTER TABLE payment_configs ADD COLUMN effective_from DATE;

-- Backfill: para configs existentes, usar la fecha de registro como fecha de vigencia
UPDATE payment_configs
SET effective_from = DATE(date_time_registration)
WHERE date_time_registration IS NOT NULL;

-- Para cualquier registro sin date_time_registration, usar la fecha actual
UPDATE payment_configs
SET effective_from = CURRENT_DATE
WHERE effective_from IS NULL;

-- Hacer el campo NOT NULL después del backfill
ALTER TABLE payment_configs ALTER COLUMN effective_from SET NOT NULL;

-- Default para nuevos registros
ALTER TABLE payment_configs ALTER COLUMN effective_from SET DEFAULT CURRENT_DATE;
