-- ============================================================================
-- MIGRACIÓN: Crear tabla password_reset_tokens
-- Fecha: 2026-03-28
-- ============================================================================
-- La tabla está definida en schema.prisma pero nunca se generó la migración.
-- Requerida por el flujo de recuperación de contraseña.
-- ============================================================================

-- 1. CREAR TABLA password_reset_tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- 2. ÍNDICES para rendimiento
CREATE INDEX IF NOT EXISTS "idx_prt_token_hash" ON "password_reset_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "idx_prt_user_id" ON "password_reset_tokens"("user_id");

-- 3. FOREIGN KEY a users (con CASCADE en DELETE) — idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION;
  END IF;
END $$;
