const { Pool, types } = require('pg');
require('dotenv').config();

// ============================================
// CONFIGURACIÓN DE BASE DE DATOS - PICHANGUITAS
// ============================================
//
// 🏠 DESARROLLO LOCAL:
//    - Usa PostgreSQL instalado localmente
//    - Base de datos: db_pichanguitas
//    - Usuario: postgres / Contraseña: sql
//    - Sin SSL (ssl: false)
//
// 🚀 PRODUCCIÓN (RAILWAY):
//    - Railway inyecta DATABASE_URL automáticamente
//    - NODE_ENV=production
//    - Con SSL habilitado
//
// ============================================

// ============================================
// FIX TIMEZONE: Devolver DATE como string YYYY-MM-DD
// ============================================
// El tipo DATE de PostgreSQL (OID 1082) por defecto se convierte
// a un objeto Date de JavaScript en medianoche UTC.
// Esto causa que en clientes con timezone diferente (ej: Perú UTC-5)
// la fecha se muestre un día antes.
//
// Solución: Devolver DATE como string "YYYY-MM-DD" sin conversión.
// ============================================
types.setTypeParser(1082, val => val); // DATE como string YYYY-MM-DD

// ============================================
// DETECTAR ENTORNO
// ============================================
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// Validar que DATABASE_URL esté configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está configurada en las variables de entorno');
  console.error('');
  console.error('📌 Para desarrollo local, crea un archivo .env con:');
  console.error('   DATABASE_URL="postgresql://postgres:sql@localhost:5432/db_pichanguitas"');
  console.error('');
  console.error('📌 Para producción (Railway), configura DATABASE_URL en el dashboard de Railway');
  process.exit(1);
}

// ============================================
// CONFIGURACIÓN DEL POOL DE CONEXIONES
// ============================================
const poolConfig = {
  connectionString: process.env.DATABASE_URL,

  // 🔒 SSL:
  // - Producción (Railway): SSL habilitado para conexiones seguras
  // - Desarrollo (Local): SSL deshabilitado (PostgreSQL local no lo requiere)
  ssl: isProduction ? { rejectUnauthorized: false } : false,

  // Configuración del pool de conexiones
  max: parseInt(process.env.DB_POOL_MAX) || 10,
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
};

const pool = new Pool(poolConfig);

// ============================================
// EVENTOS DEL POOL
// ============================================
pool.on('error', err => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
  // No finalizar el proceso aquí, dejar que la aplicación maneje el error
});

pool.on('connect', () => {
  // Conexión establecida silenciosamente
});

// ============================================
// VERIFICAR CONEXIÓN INICIAL
// ============================================
pool.query('SELECT NOW() as now, current_database() as db', (err, result) => {
  if (err) {
    console.error('');
    console.error('❌ ERROR AL CONECTAR CON LA BASE DE DATOS');
    console.error('   Mensaje:', err.message);
    console.error('');

    if (isDevelopment) {
      console.error('📌 DESARROLLO LOCAL - Verifica que:');
      console.error('   1. PostgreSQL esté corriendo en localhost:5432');
      console.error('   2. La base de datos "db_pichanguitas" exista');
      console.error('   3. Usuario: postgres / Contraseña: sql');
      console.error('   4. El archivo .env tenga DATABASE_URL correcta');
      console.error('');
    }
  } else if (isDevelopment) {
    // Solo mostrar mensaje detallado en desarrollo local
    console.log('');
    console.log('🏠 ═══════════════════════════════════════════════════════');
    console.log('   MODO: DESARROLLO LOCAL');
    console.log('   Base de datos:', result.rows[0].db);
    console.log('   Conexión: PostgreSQL LOCAL (localhost:5432)');
    console.log('   SSL: Deshabilitado');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  }
});

module.exports = pool;
