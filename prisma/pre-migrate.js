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

const FAILED_MIGRATIONS_TO_CLEAR = ['20260424000000_clean_badges_schema'];

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
