const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const {
  departments: ubigeoDepartments,
  provinces: ubigeoProvinces,
  districts: ubigeoDistricts,
} = require('./data/ubigeo-peru');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de Pichanguitas...');

  // ========================================
  // 1. ROLES
  // ========================================
  console.log('Poblando Roles...');
  await prisma.roles.createMany({
    data: [
      {
        name: 'super_admin',
        description: 'Administrador del sistema con acceso total a todas las funcionalidades',
        is_active: true,
      },
      {
        name: 'admin',
        description: 'Administrador de cancha con acceso a gestión de su propia cancha',
        is_active: true,
      },
      {
        name: 'customer',
        description: 'Cliente que puede realizar reservas de canchas deportivas',
        is_active: true,
      },
    ],
    skipDuplicates: true,
  });

  // ========================================
  // 2. SUPER ADMIN USER
  // ========================================
  console.log('Creando Super Admin...');
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!superAdminPassword) {
    throw new Error('La variable de entorno SUPER_ADMIN_PASSWORD es obligatoria para ejecutar el seed.');
  }
  const hashedPassword = await bcrypt.hash(superAdminPassword, 12);
  const superAdminRole = await prisma.roles.findFirst({ where: { name: 'super_admin' } });
  const adminRole = await prisma.roles.findFirst({ where: { name: 'admin' } });
  const customerRole = await prisma.roles.findFirst({ where: { name: 'customer' } });

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@pichanguitas.com';
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || 'admin';
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Administrador';
  const superAdminPhone = process.env.SUPER_ADMIN_PHONE || '983456789';

  await prisma.users.createMany({
    data: [
      {
        username: superAdminUsername,
        email: superAdminEmail,
        password_hash: hashedPassword,
        role_id: superAdminRole.id,
        name: superAdminName,
        phone: superAdminPhone,
        is_active: true,
        status: 'active',
      },
    ],
    skipDuplicates: true,
  });

  // ========================================
  // 3. PERMISSIONS
  // ========================================
  console.log('Poblando Permisos...');
  await prisma.permissions.createMany({
    data: [
      // SUPER ADMIN PERMISSIONS
      { name: 'administrator.dashboard', description: 'Acceso al dashboard del super administrador', module: 'administrator', is_active: true },
      { name: 'administrator.users.view', description: 'Ver listado de usuarios', module: 'administrator', is_active: true },
      { name: 'administrator.users.create', description: 'Crear nuevos usuarios', module: 'administrator', is_active: true },
      { name: 'administrator.users.edit', description: 'Editar usuarios existentes', module: 'administrator', is_active: true },
      { name: 'administrator.users.delete', description: 'Eliminar usuarios', module: 'administrator', is_active: true },
      { name: 'administrator.fields.view', description: 'Ver todas las canchas del sistema', module: 'administrator', is_active: true },
      { name: 'administrator.fields.approve', description: 'Aprobar canchas pendientes', module: 'administrator', is_active: true },
      { name: 'administrator.fields.reject', description: 'Rechazar canchas', module: 'administrator', is_active: true },
      { name: 'administrator.reservations.view', description: 'Ver todas las reservas', module: 'administrator', is_active: true },
      { name: 'administrator.reports.view', description: 'Ver reportes del sistema', module: 'administrator', is_active: true },
      { name: 'administrator.settings.manage', description: 'Gestionar configuración del sitio', module: 'administrator', is_active: true },
      { name: 'administrator.sports.manage', description: 'Gestionar tipos de deportes', module: 'administrator', is_active: true },
      { name: 'administrator.coupons.manage', description: 'Gestionar cupones del sistema', module: 'administrator', is_active: true },
      { name: 'administrator.badges.manage', description: 'Gestionar insignias', module: 'administrator', is_active: true },
      { name: 'administrator.payments.view', description: 'Ver pagos mensuales de administradores', module: 'administrator', is_active: true },
      // ADMIN (FIELD OWNER) PERMISSIONS
      { name: 'admin.dashboard', description: 'Acceso al dashboard del administrador de cancha', module: 'admin', is_active: true },
      { name: 'admin.fields.view', description: 'Ver sus propias canchas', module: 'admin', is_active: true },
      { name: 'admin.fields.create', description: 'Crear nuevas canchas', module: 'admin', is_active: true },
      { name: 'admin.fields.edit', description: 'Editar sus canchas', module: 'admin', is_active: true },
      { name: 'admin.reservations.view', description: 'Ver reservas de sus canchas', module: 'admin', is_active: true },
      { name: 'admin.reservations.manage', description: 'Gestionar reservas (confirmar, cancelar)', module: 'admin', is_active: true },
      { name: 'admin.customers.view', description: 'Ver clientes de sus canchas', module: 'admin', is_active: true },
      { name: 'admin.reviews.view', description: 'Ver reseñas de sus canchas', module: 'admin', is_active: true },
      { name: 'admin.analytics.view', description: 'Ver estadísticas de sus canchas', module: 'admin', is_active: true },
      { name: 'admin.schedule.manage', description: 'Gestionar horarios de sus canchas', module: 'admin', is_active: true },
      { name: 'admin.pricing.manage', description: 'Gestionar precios de sus canchas', module: 'admin', is_active: true },
      { name: 'admin.blacklist.manage', description: 'Gestionar lista negra de clientes', module: 'admin', is_active: true },
      // CUSTOMER PERMISSIONS
      { name: 'customer.dashboard', description: 'Acceso al dashboard del cliente', module: 'customer', is_active: true },
      { name: 'customer.fields.view', description: 'Ver canchas disponibles', module: 'customer', is_active: true },
      { name: 'customer.reservations.create', description: 'Crear nuevas reservas', module: 'customer', is_active: true },
      { name: 'customer.reservations.view', description: 'Ver sus propias reservas', module: 'customer', is_active: true },
      { name: 'customer.reservations.cancel', description: 'Cancelar sus reservas', module: 'customer', is_active: true },
      { name: 'customer.reviews.create', description: 'Crear reseñas', module: 'customer', is_active: true },
      { name: 'customer.profile.edit', description: 'Editar su perfil', module: 'customer', is_active: true },
      { name: 'customer.badges.view', description: 'Ver sus insignias', module: 'customer', is_active: true },
    ],
    skipDuplicates: true,
  });

  // ========================================
  // 4. ROLES_PERMISSIONS
  // ========================================
  console.log('Asignando permisos a roles...');
  const permissions = await prisma.permissions.findMany();
  const rolesPermissionsData = [];

  // SUPER_ADMIN - Todos los permisos
  permissions.forEach(permission => {
    rolesPermissionsData.push({ role_id: superAdminRole.id, permission_id: permission.id });
  });

  // ADMIN - Solo permisos de admin
  permissions
    .filter(p => p.module === 'admin')
    .forEach(permission => {
      rolesPermissionsData.push({ role_id: adminRole.id, permission_id: permission.id });
    });

  // CUSTOMER - Solo permisos de customer
  permissions
    .filter(p => p.module === 'customer')
    .forEach(permission => {
      rolesPermissionsData.push({ role_id: customerRole.id, permission_id: permission.id });
    });

  await prisma.roles_permissions.createMany({
    data: rolesPermissionsData,
    skipDuplicates: true,
  });

  // ========================================
  // 5. UBIGEO PERU (Departamentos, Provincias, Distritos)
  // ========================================
  console.log('Poblando ubicacion geografica (Peru completo)...');

  await prisma.departments.createMany({
    data: ubigeoDepartments.map(dept => ({ code: dept.code, name: dept.name })),
    skipDuplicates: true,
  });

  const createdDepartments = await prisma.departments.findMany();
  const deptCodeToId = {};
  createdDepartments.forEach(d => { deptCodeToId[d.code] = d.id; });

  await prisma.provinces.createMany({
    data: ubigeoProvinces.map(prov => ({
      code: prov.code,
      name: prov.name,
      department_id: deptCodeToId[prov.department_code],
    })),
    skipDuplicates: true,
  });

  const createdProvinces = await prisma.provinces.findMany();
  const provCodeToId = {};
  const provCodeToDeptId = {};
  createdProvinces.forEach(p => {
    provCodeToId[p.code] = p.id;
    provCodeToDeptId[p.code] = p.department_id;
  });

  await prisma.districts.createMany({
    data: ubigeoDistricts.map(dist => ({
      code: dist.code,
      name: dist.name,
      province_id: provCodeToId[dist.province_code],
      department_id: provCodeToDeptId[dist.province_code],
    })),
    skipDuplicates: true,
  });

  // ========================================
  // 6. SPORT TYPES
  // ========================================
  console.log('Poblando tipos de deportes...');
  await prisma.sport_types.createMany({
    data: [
      { name: 'Futbol', icon: '⚽', color: '#22c55e', description: 'Futbol en canchas de grass sintetico o natural', is_active: true, status: 'active' },
      { name: 'Futbol 5', icon: '⚽', color: '#16a34a', description: 'Futbol en canchas pequenas de 5 jugadores', is_active: true, status: 'active' },
      { name: 'Futbol 7', icon: '⚽', color: '#15803d', description: 'Futbol en canchas medianas de 7 jugadores', is_active: true, status: 'active' },
      { name: 'Basquet', icon: '🏀', color: '#f97316', description: 'Baloncesto en canchas techadas o al aire libre', is_active: true, status: 'active' },
      { name: 'Voley', icon: '🏐', color: '#3b82f6', description: 'Voleibol en canchas con net reglamentario', is_active: true, status: 'active' },
      { name: 'Tenis', icon: '🎾', color: '#eab308', description: 'Tenis en canchas especializadas', is_active: true, status: 'active' },
      { name: 'Padel', icon: '🎾', color: '#a855f7', description: 'Padel en canchas cerradas', is_active: true, status: 'active' },
    ],
    skipDuplicates: true,
  });

  // ========================================
  // 7. TIME RANGES
  // ========================================
  console.log('Poblando rangos horarios...');
  const timeRangesData = [];
  for (let h = 6; h < 23; h++) {
    timeRangesData.push({
      start_time: new Date(Date.UTC(1970, 0, 1, h, 0, 0)),
      end_time: new Date(Date.UTC(1970, 0, 1, h + 1, 0, 0)),
      label: `${h.toString().padStart(2, '0')}:00 - ${(h + 1).toString().padStart(2, '0')}:00`,
      order_index: h - 5,
      is_active: true,
    });
  }
  await prisma.time_ranges.createMany({ data: timeRangesData, skipDuplicates: true });

  // ========================================
  // 8. SITE CONFIG
  // ========================================
  console.log('Poblando configuracion del sitio...');
  await prisma.site_config.createMany({
    data: [
      {
        key: 'site_name',
        value: JSON.stringify({ name: 'Pichanguitas', subtitle: 'Reserva tu cancha favorita' }),
      },
      {
        key: 'contact_info',
        value: JSON.stringify({
          email: 'contacto@pichanguitas.com',
          phone: '+51 999 999 999',
          whatsapp: '+51 999 999 999',
          address: 'Lima, Peru',
        }),
      },
      {
        key: 'business_hours',
        value: JSON.stringify({
          monday: { open: '06:00', close: '23:00', is_open: true },
          tuesday: { open: '06:00', close: '23:00', is_open: true },
          wednesday: { open: '06:00', close: '23:00', is_open: true },
          thursday: { open: '06:00', close: '23:00', is_open: true },
          friday: { open: '06:00', close: '23:00', is_open: true },
          saturday: { open: '06:00', close: '23:00', is_open: true },
          sunday: { open: '06:00', close: '23:00', is_open: true },
        }),
      },
      {
        key: 'reservation_settings',
        value: JSON.stringify({
          min_advance_hours: 1,
          max_advance_days: 30,
          cancellation_hours: 24,
          default_slot_duration: 60,
          allow_multiple_slots: true,
          require_advance_payment: false,
          advance_payment_percentage: 50,
        }),
      },
      {
        key: 'notification_settings',
        value: JSON.stringify({
          send_confirmation_email: true,
          send_reminder_whatsapp: true,
          reminder_hours_before: 24,
          send_review_request: true,
        }),
      },
      {
        key: 'seo_settings',
        value: JSON.stringify({
          meta_title: 'Pichanguitas - Reserva canchas deportivas',
          meta_description: 'Reserva tu cancha de futbol, basquet, voley y mas. Facil, rapido y seguro.',
          meta_keywords: 'canchas, futbol, reservas, deportes, pichanguitas',
        }),
      },
      {
        key: 'payment_settings',
        value: JSON.stringify({
          currency: 'PEN',
          currency_symbol: 'S/',
          accepted_methods: ['cash', 'yape', 'plin', 'transfer'],
          monthly_subscription_fee: 50.0,
          commission_percentage: 0,
        }),
      },
      {
        key: 'promotion_settings',
        value: JSON.stringify({
          enable_free_hours: true,
          hours_for_free_hour: 10,
          free_hour_value: 1,
          enable_coupons: true,
          enable_badges: true,
        }),
      },
    ],
    skipDuplicates: true,
  });

  // ========================================
  // 9. BADGE CRITERIA
  // ========================================
  console.log('Poblando criterios de insignias...');
  await prisma.badge_criteria.createMany({
    data: [
      { code: 'total_reservations', name: 'Total de Reservas', description: 'Cantidad total de reservas completadas por el cliente', calculation_table: 'reservations', calculation_field: 'id', calculation_type: 'count', filter_conditions: JSON.stringify({ status: 'completed' }), is_active: true },
      { code: 'total_hours', name: 'Horas Totales Jugadas', description: 'Suma total de horas reservadas y completadas', calculation_table: 'reservations', calculation_field: 'hours', calculation_type: 'sum', filter_conditions: JSON.stringify({ status: 'completed' }), is_active: true },
      { code: 'total_spent', name: 'Total Gastado', description: 'Monto total gastado en reservas', calculation_table: 'customers', calculation_field: 'total_spent', calculation_type: 'value', filter_conditions: null, is_active: true },
      { code: 'total_reviews', name: 'Resenas Realizadas', description: 'Cantidad de resenas publicadas', calculation_table: 'reviews', calculation_field: 'id', calculation_type: 'count', filter_conditions: JSON.stringify({ is_visible: true }), is_active: true },
      { code: 'consecutive_weeks', name: 'Semanas Consecutivas', description: 'Numero de semanas consecutivas con al menos una reserva', calculation_table: 'reservations', calculation_field: 'date', calculation_type: 'consecutive', filter_conditions: JSON.stringify({ status: 'completed' }), is_active: true },
    ],
    skipDuplicates: true,
  });

  // ========================================
  // 10. BADGES
  // ========================================
  console.log('Poblando insignias...');
  const criteria = await prisma.badge_criteria.findMany();
  const criteriaMap = {};
  criteria.forEach(c => { criteriaMap[c.code] = c.id; });

  await prisma.badges.createMany({
    data: [
      { name: 'Jugador Frecuente', icon: '⚽', description: 'Otorgada por cantidad de reservas realizadas', criteria_type: 'reservations', criteria_id: criteriaMap['total_reservations'], is_active: true, status: 'active' },
      { name: 'Maratonista', icon: '🏃', description: 'Otorgada por horas totales jugadas', criteria_type: 'hours', criteria_id: criteriaMap['total_hours'], is_active: true, status: 'active' },
      { name: 'Patrocinador', icon: '💰', description: 'Otorgada por monto total gastado', criteria_type: 'spending', criteria_id: criteriaMap['total_spent'], is_active: true, status: 'active' },
      { name: 'Critico Deportivo', icon: '⭐', description: 'Otorgada por cantidad de resenas realizadas', criteria_type: 'reviews', criteria_id: criteriaMap['total_reviews'], is_active: true, status: 'active' },
      { name: 'Constante', icon: '📅', description: 'Otorgada por semanas consecutivas jugando', criteria_type: 'consecutive', criteria_id: criteriaMap['consecutive_weeks'], is_active: true, status: 'active' },
    ],
    skipDuplicates: true,
  });

  // ========================================
  // 11. BADGE TIERS
  // ========================================
  console.log('Poblando niveles de insignias...');
  const badges = await prisma.badges.findMany();
  const badgeMap = {};
  badges.forEach(b => { badgeMap[b.name] = b.id; });

  const tierTemplate = (badgeName, tiers) =>
    tiers.map(t => ({ badge_id: badgeMap[badgeName], ...t }));

  const badgeTiersData = [
    ...tierTemplate('Jugador Frecuente', [
      { tier: 'bronze', icon: '🥉', label: 'Principiante', required_value: 5, reward_hours: 0.5, color: '#CD7F32' },
      { tier: 'silver', icon: '🥈', label: 'Regular', required_value: 20, reward_hours: 1.0, color: '#C0C0C0' },
      { tier: 'gold', icon: '🥇', label: 'Veterano', required_value: 50, reward_hours: 2.0, color: '#FFD700' },
      { tier: 'platinum', icon: '💎', label: 'Leyenda', required_value: 100, reward_hours: 5.0, color: '#E5E4E2' },
    ]),
    ...tierTemplate('Maratonista', [
      { tier: 'bronze', icon: '🥉', label: '10 horas', required_value: 10, reward_hours: 0.5, color: '#CD7F32' },
      { tier: 'silver', icon: '🥈', label: '50 horas', required_value: 50, reward_hours: 1.0, color: '#C0C0C0' },
      { tier: 'gold', icon: '🥇', label: '100 horas', required_value: 100, reward_hours: 2.0, color: '#FFD700' },
      { tier: 'platinum', icon: '💎', label: '500 horas', required_value: 500, reward_hours: 5.0, color: '#E5E4E2' },
    ]),
    ...tierTemplate('Patrocinador', [
      { tier: 'bronze', icon: '🥉', label: 'S/ 100+', required_value: 100, reward_hours: 0.5, color: '#CD7F32' },
      { tier: 'silver', icon: '🥈', label: 'S/ 500+', required_value: 500, reward_hours: 1.0, color: '#C0C0C0' },
      { tier: 'gold', icon: '🥇', label: 'S/ 1000+', required_value: 1000, reward_hours: 2.0, color: '#FFD700' },
      { tier: 'platinum', icon: '💎', label: 'S/ 5000+', required_value: 5000, reward_hours: 5.0, color: '#E5E4E2' },
    ]),
    ...tierTemplate('Critico Deportivo', [
      { tier: 'bronze', icon: '🥉', label: '3 resenas', required_value: 3, reward_hours: 0.5, color: '#CD7F32' },
      { tier: 'silver', icon: '🥈', label: '10 resenas', required_value: 10, reward_hours: 1.0, color: '#C0C0C0' },
      { tier: 'gold', icon: '🥇', label: '25 resenas', required_value: 25, reward_hours: 2.0, color: '#FFD700' },
      { tier: 'platinum', icon: '💎', label: '50 resenas', required_value: 50, reward_hours: 3.0, color: '#E5E4E2' },
    ]),
    ...tierTemplate('Constante', [
      { tier: 'bronze', icon: '🥉', label: '4 semanas', required_value: 4, reward_hours: 1.0, color: '#CD7F32' },
      { tier: 'silver', icon: '🥈', label: '8 semanas', required_value: 8, reward_hours: 2.0, color: '#C0C0C0' },
      { tier: 'gold', icon: '🥇', label: '16 semanas', required_value: 16, reward_hours: 3.0, color: '#FFD700' },
      { tier: 'platinum', icon: '💎', label: '52 semanas', required_value: 52, reward_hours: 10.0, color: '#E5E4E2' },
    ]),
  ];

  await prisma.badge_tiers.createMany({ data: badgeTiersData, skipDuplicates: true });

  // ========================================
  // 12. SOCIAL MEDIA
  // ========================================
  console.log('Poblando redes sociales...');
  await prisma.social_media.createMany({
    data: [
      { platform: 'Facebook', url: 'https://facebook.com/pichanguitas', icon: 'facebook', enabled: true, order_index: 1, status: 'active' },
      { platform: 'Instagram', url: 'https://instagram.com/pichanguitas', icon: 'instagram', enabled: true, order_index: 2, status: 'active' },
      { platform: 'TikTok', url: 'https://tiktok.com/@pichanguitas', icon: 'tiktok', enabled: true, order_index: 3, status: 'active' },
      { platform: 'WhatsApp', url: 'https://wa.me/51999999999', icon: 'whatsapp', enabled: true, order_index: 4, status: 'active' },
      { platform: 'YouTube', url: 'https://youtube.com/@pichanguitas', icon: 'youtube', enabled: false, order_index: 5, status: 'active' },
    ],
    skipDuplicates: true,
  });

  // ========================================
  // 13. GAMIFICATION CONFIG
  // ========================================
  console.log('Poblando configuracion de gamificacion...');
  await prisma.gamification_config.createMany({
    data: [
      { config_key: 'is_active', config_value: 'true', description: 'Sistema de gamificacion activo/inactivo' },
      { config_key: 'auto_assign', config_value: 'true', description: 'Asignacion automatica de insignias' },
      { config_key: 'notify_clients', config_value: 'true', description: 'Notificar a clientes cuando obtienen insignias' },
      { config_key: 'notify_admin', config_value: 'true', description: 'Notificar a administradores sobre nuevas insignias' },
      { config_key: 'show_in_profile', config_value: 'true', description: 'Mostrar insignias en perfil del cliente' },
      { config_key: 'show_public_ranking', config_value: 'true', description: 'Mostrar ranking publico de clientes' },
      { config_key: 'hide_locked_badges', config_value: 'false', description: 'Ocultar insignias bloqueadas' },
      { config_key: 'enable_rewards', config_value: 'true', description: 'Habilitar recompensas (horas gratis)' },
    ],
    skipDuplicates: true,
  });

  // ========================================
  // RESUMEN
  // ========================================
  console.log('');
  console.log('Seed completado exitosamente');
  console.log('');
  console.log('  Tablas pobladas:');
  console.log('  - 3 Roles');
  console.log('  - 1 Super Admin (admin / 123456)');
  console.log('  - 35 Permisos');
  console.log('  - Asignacion roles-permisos');
  console.log(`  - ${ubigeoDepartments.length} Departamentos, ${ubigeoProvinces.length} Provincias, ${ubigeoDistricts.length} Distritos`);
  console.log('  - 7 Tipos de deportes');
  console.log('  - 17 Rangos horarios (06:00-23:00)');
  console.log('  - 8 Configuraciones del sitio');
  console.log('  - 5 Criterios de insignias');
  console.log('  - 5 Insignias con 20 niveles');
  console.log('  - 5 Redes sociales');
  console.log('  - 8 Configuraciones de gamificacion');
  console.log('');
  console.log(`  Acceso inicial: ${superAdminEmail} (password via env SUPER_ADMIN_PASSWORD)`);
}

main()
  .catch(e => {
    console.error('Error ejecutando el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
