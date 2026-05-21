// ============================================================================
// pre-migrate.js
// ----------------------------------------------------------------------------
// Limpieza preventiva del estado de migraciones bloqueadas en _prisma_migrations
// antes de ejecutar `prisma migrate deploy` en Railway.
//
// Contexto: la migración 20260424000000_clean_badges_schema falló en producción
// porque la BD había sido sincronizada previamente con `prisma db push` y la
// columna legacy `badges.criteria_type` ya no existía cuando la migración
// intentó hacer un backfill desde ella. El registro quedó marcado como fallido
// (finished_at IS NULL) y eso bloquea cualquier despliegue posterior con P3009.
//
// Este script borra exclusivamente el registro fallido de esa migración. Es
// seguro porque:
//   - Filtra por migration_name específica (no toca otras migraciones).
//   - Sólo borra cuando finished_at IS NULL (intento que nunca completó).
//   - Migraciones aplicadas con éxito quedan intactas.
//   - Si _prisma_migrations no existe todavía (BD virgen), no es error.
//
// Una vez la migración corregida (ahora idempotente) se aplique con éxito,
// futuros despliegues no encontrarán ningún registro fallido y este script
// será un no-op.
// ============================================================================

const { PrismaClient } = require('@prisma/client');

// Migraciones que pueden haber quedado en estado fallido en producción y deben
// ser liberadas (DELETE en _prisma_migrations cuando finished_at IS NULL) para
// que `prisma migrate deploy` las reintente con la versión corregida del SQL.
// - 20260424000000_clean_badges_schema: fallo histórico por backfill desde una
//   columna ya inexistente cuando la BD venía de `prisma db push`.
// - 20260520000000_amenities_catalog: contenía `CREATE EXTENSION unaccent` que
//   requiere SUPERUSER y Railway PostgreSQL no lo concede; abortaba la
//   transacción. SQL ya no depende de la extensión.
const FAILED_MIGRATIONS_TO_CLEAR = [
  '20260424000000_clean_badges_schema',
  '20260520000000_amenities_catalog',
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const migrationName of FAILED_MIGRATIONS_TO_CLEAR) {
      try {
        const deleted = await prisma.$executeRawUnsafe(
          `DELETE FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NULL`,
          migrationName
        );
        if (deleted > 0) {
          console.log(
            `[pre-migrate] Liberado registro fallido de "${migrationName}" (${deleted} fila(s)). migrate deploy reintentará.`
          );
        } else {
          console.log(
            `[pre-migrate] "${migrationName}" no está en estado fallido. Continuando.`
          );
        }
      } catch (err) {
        const message = String(err && err.message ? err.message : err);
        if (/_prisma_migrations" does not exist/i.test(message)) {
          console.log(
            '[pre-migrate] _prisma_migrations no existe aún (BD nueva). Continuando.'
          );
          return;
        }
        throw err;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[pre-migrate] Error inesperado:', err);
  process.exit(1);
});
