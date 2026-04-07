-- ============================================================================
-- PICHANGUITAS - SCRIPT DE VERIFICACION DE INSTALACION
-- Ejecutar despues de: npx prisma migrate deploy && npx prisma db seed
-- ============================================================================

-- 1. Verificar que existen todas las tablas (53 tablas esperadas)
SELECT
    'TABLAS' as verificacion,
    COUNT(*) as encontradas,
    53 as esperadas,
    CASE WHEN COUNT(*) = 53 THEN 'OK' ELSE 'ERROR' END as estado
FROM pg_tables
WHERE schemaname = 'public'
AND tablename != '_prisma_migrations';

-- 2. Verificar tablas criticas con columnas especificas
SELECT
    'field_equipment.has_cone_rental' as verificacion,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'field_equipment' AND column_name = 'has_cone_rental'
    ) THEN 'OK' ELSE 'FALTA' END as estado;

SELECT
    'field_equipment.cone_price' as verificacion,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'field_equipment' AND column_name = 'cone_price'
    ) THEN 'OK' ELSE 'FALTA' END as estado;

SELECT
    'fields.advance_payment_amount' as verificacion,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fields' AND column_name = 'advance_payment_amount'
    ) THEN 'OK' ELSE 'FALTA' END as estado;

-- 3. Verificar datos del seed
SELECT
    'ROLES' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 5 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM roles;

SELECT
    'USUARIOS' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 3 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM users;

SELECT
    'PERMISOS' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 10 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM permissions;

SELECT
    'DEPARTAMENTOS' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM departments;

SELECT
    'PROVINCIAS' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM provinces;

SELECT
    'DISTRITOS' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM districts;

SELECT
    'TIPOS_DEPORTE' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 4 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM sport_types;

SELECT
    'RANGOS_HORARIOS' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 10 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM time_ranges;

SELECT
    'CRITERIOS_INSIGNIAS' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 3 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM badge_criteria;

SELECT
    'INSIGNIAS' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 3 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM badges;

SELECT
    'NIVELES_INSIGNIAS' as tabla,
    COUNT(*) as registros,
    CASE WHEN COUNT(*) >= 9 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM badge_tiers;

-- 4. Verificar indices criticos
SELECT
    'INDICES' as verificacion,
    COUNT(*) as encontrados,
    CASE WHEN COUNT(*) >= 100 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM pg_indexes
WHERE schemaname = 'public';

-- 5. Verificar foreign keys
SELECT
    'FOREIGN_KEYS' as verificacion,
    COUNT(*) as encontradas,
    CASE WHEN COUNT(*) >= 80 THEN 'OK' ELSE 'VERIFICAR' END as estado
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
AND table_schema = 'public';

-- ============================================================================
-- RESUMEN: Si todos los estados son 'OK', la instalacion es correcta
-- ============================================================================
