const bcrypt = require('bcrypt');

const pool = require('../config/db');

/**
 * Función auxiliar para generar username único
 * Formato: nombreapellido (sin punto, todo junto)
 * Si existe, agrega números: nombreapellido1, nombreapellido2, etc.
 */
const generateUniqueUsername = async (name, lastName, client) => {
  // Normalizar: quitar acentos, espacios, caracteres especiales, convertir a minúsculas
  const normalize = text => {
    const accentsMap = {
      á: 'a',
      é: 'e',
      í: 'i',
      ó: 'o',
      ú: 'u',
      Á: 'a',
      É: 'e',
      Í: 'i',
      Ó: 'o',
      Ú: 'u',
      ñ: 'n',
      Ñ: 'n',
      ü: 'u',
      Ü: 'u',
    };

    return text
      .toLowerCase()
      .split('')
      .map(char => accentsMap[char] || char)
      .join('')
      .replace(/[^a-z0-9]/g, '') // Solo letras y números
      .trim();
  };

  const normalizedName = normalize(name);
  const normalizedLastName = normalize(lastName);

  // Generar base del username (sin punto)
  const baseUsername = `${normalizedName}${normalizedLastName}`;

  // Verificar si el username base está disponible
  let username = baseUsername;
  let counter = 1;
  let exists = true;

  while (exists) {
    const result = await client.query('SELECT id FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      exists = false; // Username disponible
    } else {
      // Username ocupado, agregar número
      username = `${baseUsername}${counter}`;
      counter++;
    }
  }

  return username;
};

/**
 * Registro público de clientes (auto-registro)
 * No requiere autenticación
 */
const registerCustomer = async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, lastName, dni, phone, email, password } = req.body;

    // ===========================
    // VALIDACIONES
    // ===========================

    // Nombre
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'El nombre debe tener al menos 2 caracteres',
      });
    }

    // Apellido
    if (!lastName || lastName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'El apellido debe tener al menos 2 caracteres',
      });
    }

    // DNI
    if (!dni || !/^\d{8}$/.test(dni)) {
      return res.status(400).json({
        success: false,
        error: 'El DNI debe tener exactamente 8 dígitos',
      });
    }

    // Teléfono
    if (!phone || !/^9\d{8}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'El teléfono debe comenzar con 9 y tener 9 dígitos',
      });
    }

    // Contraseña
    if (!password || password.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 4 caracteres',
      });
    }

    // Email (obligatorio)
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El correo electrónico es obligatorio',
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'El correo electrónico no es válido',
      });
    }

    // ===========================
    // VERIFICAR DUPLICADOS
    // ===========================

    // Verificar si ya existe un usuario con el mismo teléfono
    const existingPhone = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);

    if (existingPhone.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una cuenta con este número de teléfono',
      });
    }

    // Verificar si ya existe un customer con el mismo teléfono
    const existingCustomerPhone = await client.query(
      'SELECT id, user_id FROM customers WHERE phone_number = $1',
      [phone]
    );

    // Si existe customer con user_id, significa que ya tiene cuenta
    if (existingCustomerPhone.rows.length > 0 && existingCustomerPhone.rows[0].user_id) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una cuenta vinculada a este número de teléfono',
      });
    }

    // Si existe customer sin user_id, lo vincularemos después de crear el usuario
    const existingCustomerId =
      existingCustomerPhone.rows.length > 0 ? existingCustomerPhone.rows[0].id : null;

    // Verificar email duplicado
    const existingEmail = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 AND email NOT LIKE '%@pichanguitas.temp'",
      [email.trim().toLowerCase()]
    );

    if (existingEmail.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una cuenta con este correo electrónico',
      });
    }

    // ===========================
    // INICIAR TRANSACCIÓN
    // ===========================
    await client.query('BEGIN');

    // Generar username único basado en nombre y apellido
    const username = await generateUniqueUsername(name, lastName, client);

    // Hashear contraseña
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const fullName = `${name.trim()} ${lastName.trim()}`;
    const emailValue = email.trim().toLowerCase();

    // 1. Crear usuario en tabla users (role_id = 3 para customer)
    const userResult = await client.query(
      `INSERT INTO users (
        username,
        email,
        password_hash,
        role_id,
        name,
        phone,
        is_active,
        status,
        login_attempts,
        is_blocked,
        date_time_registration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING id, username, email, name, phone, role_id, is_active, status, date_time_registration`,
      [
        username, // username generado automáticamente (ej: juanperez)
        emailValue, // email
        password_hash, // password hasheado
        3, // role_id = 3 (customer)
        fullName, // nombre completo
        phone, // phone
        true, // is_active
        'active', // status
        0, // login_attempts
        false, // is_blocked
      ]
    );

    const newUser = userResult.rows[0];

    // 2. Crear o vincular registro en tabla customers
    let customerResult;

    if (existingCustomerId) {
      // Vincular customer existente al nuevo usuario (mantiene historial de reservas)
      customerResult = await client.query(
        `UPDATE customers SET
          user_id = $1,
          name = $2,
          email = $3,
          user_id_modification = $4,
          date_time_modification = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING id, user_id, phone_number, name, email, status, date_time_registration`,
        [
          newUser.id, // user_id
          fullName, // name
          emailValue, // email
          newUser.id, // user_id_modification
          existingCustomerId, // id del customer existente
        ]
      );
      console.log('✅ Customer existente vinculado al nuevo usuario:', existingCustomerId);
    } else {
      // Crear nuevo customer
      customerResult = await client.query(
        `INSERT INTO customers (
          user_id,
          phone_number,
          name,
          email,
          created_by,
          status,
          is_vip,
          total_reservations,
          total_hours,
          total_spent,
          earned_free_hours,
          used_free_hours,
          available_free_hours,
          user_id_registration,
          date_time_registration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
        RETURNING id, user_id, phone_number, name, email, status, date_time_registration`,
        [
          newUser.id, // user_id
          phone, // phone_number
          fullName, // name
          emailValue, // email
          newUser.id, // created_by = el mismo cliente
          'active', // status
          false, // is_vip
          0, // total_reservations
          0.0, // total_hours
          0.0, // total_spent
          0.0, // earned_free_hours
          0.0, // used_free_hours
          0.0, // available_free_hours
          newUser.id, // user_id_registration
        ]
      );
    }

    const newCustomer = customerResult.rows[0];

    // Confirmar transacción
    await client.query('COMMIT');

    console.log('✅ Cliente registrado exitosamente:', {
      user_id: newUser.id,
      customer_id: newCustomer.id,
      phone: phone,
      name: fullName,
    });

    // Respuesta exitosa (sin incluir password_hash)
    res.status(201).json({
      success: true,
      message: 'Cuenta creada exitosamente',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          name: newUser.name,
          phone: newUser.phone,
          role_id: newUser.role_id,
        },
        customer: {
          id: newCustomer.id,
          phone_number: newCustomer.phone_number,
          name: newCustomer.name,
          email: newCustomer.email,
        },
      },
    });
  } catch (error) {
    // Rollback en caso de error
    await client.query('ROLLBACK');

    console.error('❌ Error al registrar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la cuenta. Por favor intente nuevamente.',
    });
  } finally {
    client.release();
  }
};

module.exports = {
  registerCustomer,
};
