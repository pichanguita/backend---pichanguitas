const cors = require('cors');
const cron = require('node-cron');
const express = require('express');

require('dotenv').config();

const pool = require('./config/db');
const { updateFieldMaintenanceStatus } = require('./jobs/updateFieldMaintenanceStatus');
const { initBucket } = require('./services/wasabiService');

// ========================================
// CONFIGURACIÓN DE ZONA HORARIA
// ========================================
// Establecer zona horaria de Perú (UTC-5) para todo el proceso de Node.js
// Esto asegura que new Date() devuelva la hora correcta de Perú
process.env.TZ = 'America/Lima';

// Importar todas las rutas
const authRoutes = require('./routes/authRoutes');
const sportTypesRoutes = require('./routes/sportTypesRoutes');
const locationsRoutes = require('./routes/locationsRoutes');
const customersRoutes = require('./routes/customersRoutes');
const rolesPermissionsRoutes = require('./routes/rolesPermissionsRoutes');
const reservationsRoutes = require('./routes/reservationsRoutes');
const fieldsRoutes = require('./routes/fieldsRoutes');
const usersRoutes = require('./routes/usersRoutes');
const reviewsRoutes = require('./routes/reviewsRoutes');
const alertsRoutes = require('./routes/alertsRoutes');
const couponsRoutes = require('./routes/couponsRoutes');
const registrationRequestsRoutes = require('./routes/registrationRequestsRoutes');
const paymentsRoutes = require('./routes/paymentsRoutes');
const paymentConfigsRoutes = require('./routes/paymentConfigsRoutes');
const blacklistRoutes = require('./routes/blacklistRoutes');
const fieldSchedulesRoutes = require('./routes/fieldSchedulesRoutes');
const fieldAmenitiesRoutes = require('./routes/fieldAmenitiesRoutes');
const fieldImagesRoutes = require('./routes/fieldImagesRoutes');
const fieldSpecialPricingRoutes = require('./routes/fieldSpecialPricingRoutes');
const fieldMaintenanceSchedulesRoutes = require('./routes/fieldMaintenanceSchedulesRoutes');
const badgesRoutes = require('./routes/badgesRoutes');
const badgeCriteriaRoutes = require('./routes/badgeCriteriaRoutes');
const gamificationConfigRoutes = require('./routes/gamificationConfigRoutes');
const promotionRulesRoutes = require('./routes/promotionRulesRoutes');
const couponUsageRoutes = require('./routes/couponUsageRoutes');
const refundsRoutes = require('./routes/refundsRoutes');
const fieldRulesRoutes = require('./routes/fieldRulesRoutes');
const fieldVideosRoutes = require('./routes/fieldVideosRoutes');
const fieldEquipmentRoutes = require('./routes/fieldEquipmentRoutes');
const siteConfigRoutes = require('./routes/siteConfigRoutes');
const socialMediaRoutes = require('./routes/socialMediaRoutes');
const fieldPaymentMethodsRoutes = require('./routes/fieldPaymentMethodsRoutes');
const monthlyPaymentsRoutes = require('./routes/monthlyPaymentsRoutes');
const platformPaymentMethodsRoutes = require('./routes/platformPaymentMethodsRoutes');
const publicRoutes = require('./routes/publicRoutes');
const passwordResetRoutes = require('./routes/passwordResetRoutes');
const activityLogsRoutes = require('./routes/activityLogsRoutes');

const app = express();

// Configuración de puerto
// Railway asigna automáticamente el puerto mediante la variable PORT
// En local, usar el puerto definido en .env o 4009 por defecto
const PORT = process.env.PORT || 4009;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware CORS
// En producción, configurar orígenes permitidos específicos
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
// Aumentar límite de payload para soportar archivos/imágenes en base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/sport-types', sportTypesRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/roles-permissions', rolesPermissionsRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/fields', fieldsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/registration-requests', registrationRequestsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/payment-configs', paymentConfigsRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/field-schedules', fieldSchedulesRoutes);
app.use('/api/field-amenities', fieldAmenitiesRoutes);
app.use('/api/field-images', fieldImagesRoutes);
app.use('/api/field-special-pricing', fieldSpecialPricingRoutes);
app.use('/api/field-maintenance-schedules', fieldMaintenanceSchedulesRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/badge-criteria', badgeCriteriaRoutes);
app.use('/api/gamification-config', gamificationConfigRoutes);
app.use('/api/promotion-rules', promotionRulesRoutes);
app.use('/api/coupon-usage', couponUsageRoutes);
app.use('/api/refunds', refundsRoutes);
app.use('/api/field-rules', fieldRulesRoutes);
app.use('/api/field-videos', fieldVideosRoutes);
app.use('/api/field-equipment', fieldEquipmentRoutes);
app.use('/api/site-config', siteConfigRoutes);
app.use('/api/social-media', socialMediaRoutes);
app.use('/api/field-payment-methods', fieldPaymentMethodsRoutes);
app.use('/api/monthly-payments', monthlyPaymentsRoutes);
app.use('/api/platform-payment-methods', platformPaymentMethodsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/activity-logs', activityLogsRoutes);

// Proxy público para archivos no sensibles de Wasabi.
// Los documentos sensibles (solicitudes de registro) se sirven vía
// endpoint autenticado en /api/registration-requests/:id/files/:fileId/download.
const { getFileStream } = require('./services/wasabiService');
const {
  WASABI_FOLDERS,
  MEDIA_PROXY_PATH,
} = require('./config/storage');

const PRIVATE_PROXY_PREFIXES = [`${WASABI_FOLDERS.REGISTRATION_REQUESTS}/`];

app.get(`${MEDIA_PROXY_PATH}/*key`, async (req, res) => {
  try {
    const rawKey = req.params.key;
    const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;
    if (!key) {
      return res.status(400).json({ error: 'Key requerida' });
    }
    // Bloquear acceso al proxy para carpetas privadas.
    if (PRIVATE_PROXY_PREFIXES.some(prefix => key.startsWith(prefix))) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    const { stream, contentType, contentLength } = await getFileStream(key);
    res.set('Content-Type', contentType || 'application/octet-stream');
    if (contentLength) res.set('Content-Length', contentLength);
    res.set('Cache-Control', 'public, max-age=604800');
    stream.pipe(res);
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    console.error('Error al servir archivo:', error.message);
    res.status(500).json({ error: 'Error al servir archivo' });
  }
});

// Ruta de prueba
app.get('/api/ping', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  const isLocal = NODE_ENV === 'development';

  console.log('');
  console.log('═'.repeat(60));
  console.log('🚀 Servidor backend PICHANGUITAS iniciado');
  console.log('═'.repeat(60));

  if (isLocal) {
    // ========================================
    // 🏠 MODO DESARROLLO LOCAL
    // ========================================
    console.log('');
    console.log('   🏠 MODO: DESARROLLO LOCAL');
    console.log('   📌 Base de datos: PostgreSQL LOCAL (db_pichanguitas)');
    console.log('   📌 Este entorno NO afecta la versión en Railway');
    console.log('');
  } else {
    // ========================================
    // 🚀 MODO PRODUCCIÓN (RAILWAY)
    // ========================================
    console.log('');
    console.log('   🚀 MODO: PRODUCCIÓN (RAILWAY)');
    console.log('   📌 Base de datos: Railway PostgreSQL');
    console.log('');
  }

  console.log(`   Entorno: ${NODE_ENV.toUpperCase()}`);
  console.log(`   Puerto: ${PORT}`);
  console.log(
    `   Timezone: ${process.env.TZ || 'America/Lima'} (${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })})`
  );
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   API Health Check: http://localhost:${PORT}/api/ping`);
  console.log('═'.repeat(60));
  console.log('');

  // ========================================
  // CRON JOB: Actualización de Estados de Mantenimiento
  // ========================================
  // Ejecutar diariamente a las 00:01 (medianoche)
  cron.schedule(
    '1 0 * * *',
    async () => {
      console.log('\n🕐 [CRON SCHEDULER] Ejecutando job de actualización de mantenimiento...');
      await updateFieldMaintenanceStatus();
    },
    {
      scheduled: true,
      timezone: 'America/Lima', // Timezone de Perú
    }
  );

  // Ejecutar el job una vez al iniciar el servidor (sincronizacion inicial)
  updateFieldMaintenanceStatus().catch(error => {
    console.error('Error en sincronizacion inicial de mantenimientos:', error.message);
  });

  // Inicializar bucket de Wasabi (verificar/crear)
  initBucket().catch(error => {
    console.error('Error al inicializar Wasabi:', error.message);
  });
});
