const pool = require('../config/db');
const { toProxyUrl } = require('../services/wasabiService');

/**
 * Obtener todas las canchas con filtros
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de canchas
 */
const getAllFields = async (filters = {}) => {
  let query = `
    SELECT
      f.id,
      f.admin_id,
      f.name,
      f.location,
      f.departamento,
      f.provincia,
      f.distrito,
      f.district_id,
      f.address,
      f.phone,
      f.latitude,
      f.longitude,
      f.price_per_hour,
      f.status,
      f.approval_status,
      f.field_type,
      f.sport_type,
      f.capacity,
      f.requires_advance_payment,
      f.advance_payment_amount,
      f.is_active,
      f.is_multi_sport,
      f.rating,
      f.total_reviews,
      f.approved_by,
      f.approved_at,
      f.rejected_by,
      f.rejected_at,
      f.rejection_reason,
      f.created_by,
      f.user_id_registration,
      f.date_time_registration,
      u.name AS admin_name,
      u.phone AS admin_phone,
      u.email AS admin_email,
      st.name AS sport_type_name
    FROM fields f
    LEFT JOIN users u ON f.admin_id = u.id
    LEFT JOIN sport_types st ON f.sport_type = st.id
    WHERE 1=1
      AND f.status != 'deleted'
  `;

  const params = [];
  let paramCount = 1;

  // Filtro por admin
  if (filters.admin_id) {
    query += ` AND f.admin_id = $${paramCount}`;
    params.push(filters.admin_id);
    paramCount++;
  }

  // Filtro por estado
  if (filters.status) {
    query += ` AND f.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Filtro por estado de aprobación
  if (filters.approval_status) {
    query += ` AND f.approval_status = $${paramCount}`;
    params.push(filters.approval_status);
    paramCount++;
  }

  // Filtro por tipo de deporte
  if (filters.sport_type) {
    query += ` AND f.sport_type = $${paramCount}`;
    params.push(filters.sport_type);
    paramCount++;
  }

  // Filtro por ubicación
  if (filters.departamento) {
    query += ` AND f.departamento ILIKE $${paramCount}`;
    params.push(`%${filters.departamento}%`);
    paramCount++;
  }

  if (filters.provincia) {
    query += ` AND f.provincia ILIKE $${paramCount}`;
    params.push(`%${filters.provincia}%`);
    paramCount++;
  }

  if (filters.distrito) {
    query += ` AND f.distrito ILIKE $${paramCount}`;
    params.push(`%${filters.distrito}%`);
    paramCount++;
  }

  // Filtro por activo
  if (filters.is_active !== undefined) {
    query += ` AND f.is_active = $${paramCount}`;
    params.push(filters.is_active);
    paramCount++;
  }

  // Búsqueda por nombre
  if (filters.search) {
    query += ` AND f.name ILIKE $${paramCount}`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` ORDER BY f.date_time_registration DESC`;

  const result = await pool.query(query, params);
  const fields = result.rows;

  // Obtener datos relacionados para cada cancha
  // Cada sub-query está protegida individualmente para que un error en una
  // tabla relacionada no impida cargar todas las canchas
  const { getImagesByFieldId } = require('./fieldImagesModel');

  for (const field of fields) {
    // Imágenes (convertir URLs de Wasabi a proxy)
    try {
      const images = await getImagesByFieldId(field.id);
      field.images = images.map(img => toProxyUrl(img.image_url));
    } catch (err) {
      console.error(`Error obteniendo imágenes para cancha ${field.id}:`, err.message);
      field.images = [];
    }

    // Deportes desde field_sports
    try {
      const sportsQuery = `
        SELECT fs.sport_id, st.name AS sport_name
        FROM field_sports fs
        INNER JOIN sport_types st ON fs.sport_id = st.id
        WHERE fs.field_id = $1
        ORDER BY st.name
      `;
      const sportsResult = await pool.query(sportsQuery, [field.id]);
      field.sport_ids = sportsResult.rows.map(row => row.sport_id);
      field.sport_names = sportsResult.rows.map(row => row.sport_name);
    } catch (err) {
      console.error(`Error obteniendo deportes para cancha ${field.id}:`, err.message);
      field.sport_ids = [];
      field.sport_names = [];
    }

    // Amenities (servicios) desde field_amenities
    try {
      const amenitiesQuery = `
        SELECT amenity FROM field_amenities WHERE field_id = $1
      `;
      const amenitiesResult = await pool.query(amenitiesQuery, [field.id]);
      field.amenities = amenitiesResult.rows.map(row => row.amenity);
    } catch (err) {
      console.error(`Error obteniendo amenities para cancha ${field.id}:`, err.message);
      field.amenities = [];
    }

    // Dimensiones desde field_dimensions
    try {
      const dimensionsQuery = `
        SELECT length, width, area, surface_type
        FROM field_dimensions WHERE field_id = $1
      `;
      const dimensionsResult = await pool.query(dimensionsQuery, [field.id]);
      field.dimensions = dimensionsResult.rows.length > 0 ? dimensionsResult.rows[0] : null;
    } catch (err) {
      console.error(`Error obteniendo dimensiones para cancha ${field.id}:`, err.message);
      field.dimensions = null;
    }

    // Equipamiento desde field_equipment
    try {
      const equipmentQuery = `
        SELECT has_jersey_rental, jersey_price, has_ball_rental, ball_rental_price,
               has_cone_rental, cone_price, has_scoreboard, has_nets, has_goals
        FROM field_equipment WHERE field_id = $1
      `;
      const equipmentResult = await pool.query(equipmentQuery, [field.id]);
      field.equipment = equipmentResult.rows.length > 0 ? equipmentResult.rows[0] : null;
    } catch (err) {
      console.error(`Error obteniendo equipamiento para cancha ${field.id}:`, err.message);
      field.equipment = null;
    }

    // Política de cancelación desde field_cancellation_policies
    try {
      const cancellationQuery = `
        SELECT allow_cancellation, hours_before_event, refund_percentage
        FROM field_cancellation_policies WHERE field_id = $1
      `;
      const cancellationResult = await pool.query(cancellationQuery, [field.id]);
      field.cancellationPolicy =
        cancellationResult.rows.length > 0
          ? {
              allowCancellation: cancellationResult.rows[0].allow_cancellation ?? true,
              hoursBeforeEvent: cancellationResult.rows[0].hours_before_event ?? 24,
              refundPercentage: parseFloat(cancellationResult.rows[0].refund_percentage) ?? 0,
            }
          : {
              allowCancellation: true,
              hoursBeforeEvent: 24,
              refundPercentage: 0,
            };
    } catch (err) {
      console.error(`Error obteniendo política de cancelación para cancha ${field.id}:`, err.message);
      field.cancellationPolicy = {
        allowCancellation: true,
        hoursBeforeEvent: 24,
        refundPercentage: 0,
      };
    }

    // Precios especiales desde field_special_pricing
    try {
      const specialPricingQuery = `
        SELECT
          fsp.id,
          fsp.name,
          fsp.description,
          fsp.price AS "discountValue",
          fsp.discount_type AS "discountType",
          fsp.time_ranges AS "timeSlots",
          fsp.days AS "daysOfWeek"
        FROM field_special_pricing fsp
        WHERE fsp.field_id = $1 AND fsp.is_active = true
      `;
      const specialPricingResult = await pool.query(specialPricingQuery, [field.id]);
      field.specialPricing = specialPricingResult.rows.map(row => ({
        id: row.id,
        name: row.name || '',
        discountValue: parseFloat(row.discountValue) || 0,
        discountType: row.discountType || 'percentage',
        timeSlots: row.timeSlots || [],
        daysOfWeek: row.daysOfWeek || [],
      }));
    } catch (err) {
      console.error(`Error obteniendo precios especiales para cancha ${field.id}:`, err.message);
      field.specialPricing = [];
    }
  }

  return fields;
};

/**
 * Obtener una cancha por ID con todos sus detalles y deportes
 * @param {number} id - ID de la cancha
 * @returns {Promise<Object|null>} Cancha o null
 */
const getFieldById = async id => {
  // Obtener datos de la cancha
  const fieldQuery = `
    SELECT
      f.*,
      u.name AS admin_name,
      u.email AS admin_email,
      u.phone AS admin_phone,
      st.name AS sport_type_name,
      d.name AS district_name,
      p.name AS province_name,
      dep.name AS department_name
    FROM fields f
    LEFT JOIN users u ON f.admin_id = u.id
    LEFT JOIN sport_types st ON f.sport_type = st.id
    LEFT JOIN districts d ON f.district_id = d.id
    LEFT JOIN provinces p ON d.province_id = p.id
    LEFT JOIN departments dep ON d.department_id = dep.id
    WHERE f.id = $1
  `;

  const fieldResult = await pool.query(fieldQuery, [id]);

  if (fieldResult.rows.length === 0) {
    return null;
  }

  const field = fieldResult.rows[0];

  // Datos relacionados con protección individual por sub-query
  // Deportes desde field_sports
  try {
    const sportsQuery = `
      SELECT fs.sport_id, st.name AS sport_name
      FROM field_sports fs
      INNER JOIN sport_types st ON fs.sport_id = st.id
      WHERE fs.field_id = $1
      ORDER BY st.name
    `;
    const sportsResult = await pool.query(sportsQuery, [id]);
    field.sport_ids = sportsResult.rows.map(row => row.sport_id);
    field.sport_names = sportsResult.rows.map(row => row.sport_name);
  } catch (err) {
    console.error(`Error obteniendo deportes para cancha ${id}:`, err.message);
    field.sport_ids = [];
    field.sport_names = [];
  }

  // Amenities (servicios) desde field_amenities
  try {
    const amenitiesQuery = `
      SELECT amenity FROM field_amenities WHERE field_id = $1
    `;
    const amenitiesResult = await pool.query(amenitiesQuery, [id]);
    field.amenities = amenitiesResult.rows.map(row => row.amenity);
  } catch (err) {
    console.error(`Error obteniendo amenities para cancha ${id}:`, err.message);
    field.amenities = [];
  }

  // Dimensiones desde field_dimensions
  try {
    const dimensionsQuery = `
      SELECT length, width, area, surface_type
      FROM field_dimensions WHERE field_id = $1
    `;
    const dimensionsResult = await pool.query(dimensionsQuery, [id]);
    field.dimensions = dimensionsResult.rows.length > 0 ? dimensionsResult.rows[0] : null;
  } catch (err) {
    console.error(`Error obteniendo dimensiones para cancha ${id}:`, err.message);
    field.dimensions = null;
  }

  // Equipamiento desde field_equipment
  try {
    const equipmentQuery = `
      SELECT has_jersey_rental, jersey_price, has_ball_rental, ball_rental_price,
             has_cone_rental, cone_price, has_scoreboard, has_nets, has_goals
      FROM field_equipment WHERE field_id = $1
    `;
    const equipmentResult = await pool.query(equipmentQuery, [id]);
    field.equipment = equipmentResult.rows.length > 0 ? equipmentResult.rows[0] : null;
  } catch (err) {
    console.error(`Error obteniendo equipamiento para cancha ${id}:`, err.message);
    field.equipment = null;
  }

  // Política de cancelación desde field_cancellation_policies
  try {
    const cancellationQuery = `
      SELECT allow_cancellation, hours_before_event, refund_percentage
      FROM field_cancellation_policies WHERE field_id = $1
    `;
    const cancellationResult = await pool.query(cancellationQuery, [id]);
    field.cancellationPolicy =
      cancellationResult.rows.length > 0
        ? {
            allowCancellation: cancellationResult.rows[0].allow_cancellation ?? true,
            hoursBeforeEvent: cancellationResult.rows[0].hours_before_event ?? 24,
            refundPercentage: parseFloat(cancellationResult.rows[0].refund_percentage) ?? 0,
          }
        : {
            allowCancellation: true,
            hoursBeforeEvent: 24,
            refundPercentage: 0,
          };
  } catch (err) {
    console.error(`Error obteniendo política de cancelación para cancha ${id}:`, err.message);
    field.cancellationPolicy = {
      allowCancellation: true,
      hoursBeforeEvent: 24,
      refundPercentage: 0,
    };
  }

  // Precios especiales desde field_special_pricing
  try {
    const specialPricingQuery = `
      SELECT
        fsp.id,
        fsp.name,
        fsp.description,
        fsp.price AS "discountValue",
        fsp.discount_type AS "discountType",
        fsp.time_ranges AS "timeSlots",
        fsp.days AS "daysOfWeek"
      FROM field_special_pricing fsp
      WHERE fsp.field_id = $1 AND fsp.is_active = true
    `;
    const specialPricingResult = await pool.query(specialPricingQuery, [id]);
    field.specialPricing = specialPricingResult.rows.map(row => ({
      id: row.id,
      name: row.name || '',
      discountValue: parseFloat(row.discountValue) || 0,
      discountType: row.discountType || 'percentage',
      timeSlots: row.timeSlots || [],
      daysOfWeek: row.daysOfWeek || [],
    }));
  } catch (err) {
    console.error(`Error obteniendo precios especiales para cancha ${id}:`, err.message);
    field.specialPricing = [];
  }

  return field;
};

/**
 * Crear una nueva cancha con todos sus deportes, dimensiones, amenities y equipamiento
 * @param {Object} fieldData - Datos de la cancha
 * @returns {Promise<Object>} Cancha creada
 */
const createField = async fieldData => {
  const {
    admin_id,
    name,
    location,
    departamento,
    provincia,
    distrito,
    district_id,
    address,
    phone,
    latitude,
    longitude,
    price_per_hour,
    status = 'available',
    approval_status = 'pending',
    field_type,
    sport_type,
    sport_ids = [], // Array de IDs de todos los deportes
    capacity,
    requires_advance_payment = false,
    advance_payment_amount = 0,
    is_active = true,
    is_multi_sport = false,
    created_by,
    user_id_registration,
    // Campos adicionales para tablas relacionadas
    dimensions = null,
    amenities = [],
    equipment = null,
  } = fieldData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Crear la cancha
    const fieldQuery = `
      INSERT INTO fields (
        admin_id,
        name,
        location,
        departamento,
        provincia,
        distrito,
        district_id,
        address,
        phone,
        latitude,
        longitude,
        price_per_hour,
        status,
        approval_status,
        field_type,
        sport_type,
        capacity,
        requires_advance_payment,
        advance_payment_amount,
        is_active,
        is_multi_sport,
        created_by,
        user_id_registration,
        date_time_registration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const fieldResult = await client.query(fieldQuery, [
      admin_id,
      name,
      location,
      departamento,
      provincia,
      distrito,
      district_id,
      address,
      phone,
      latitude,
      longitude,
      price_per_hour,
      status,
      approval_status,
      field_type,
      sport_type,
      capacity,
      requires_advance_payment,
      advance_payment_amount,
      is_active,
      is_multi_sport,
      created_by,
      user_id_registration,
    ]);

    const newField = fieldResult.rows[0];
    const fieldId = newField.id;

    // 2. Insertar TODOS los deportes en field_sports
    if (sport_ids && sport_ids.length > 0) {
      for (const sportId of sport_ids) {
        try {
          await client.query(
            `INSERT INTO field_sports (field_id, sport_id, user_id_registration, date_time_registration)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [fieldId, sportId, user_id_registration]
          );
        } catch (sportError) {
          console.warn(`Error al asociar deporte ${sportId}:`, sportError.message);
        }
      }
    }

    // 3. Insertar dimensiones en field_dimensions (si se proporcionaron)
    if (
      dimensions &&
      (dimensions.length || dimensions.width || dimensions.area || dimensions.surface_type)
    ) {
      try {
        await client.query(
          `INSERT INTO field_dimensions (
            field_id, length, width, area, surface_type, user_id_registration, date_time_registration
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            fieldId,
            dimensions.length || null,
            dimensions.width || null,
            dimensions.area || null,
            dimensions.surface_type || null,
            user_id_registration,
          ]
        );
      } catch (dimError) {
        console.warn(`Error al guardar dimensiones:`, dimError.message);
      }
    }

    // 4. Insertar amenities en field_amenities (si se proporcionaron)
    if (amenities && amenities.length > 0) {
      for (const amenity of amenities) {
        try {
          await client.query(
            `INSERT INTO field_amenities (field_id, amenity, user_id_registration, date_time_registration)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [fieldId, amenity, user_id_registration]
          );
        } catch (amenityError) {
          console.warn(`Error al guardar amenity "${amenity}":`, amenityError.message);
        }
      }
    }

    // 5. Insertar equipamiento en field_equipment (si se proporcionó objeto equipment)
    if (equipment) {
      try {
        await client.query(
          `INSERT INTO field_equipment (
            field_id, has_jersey_rental, jersey_price, has_ball_rental, ball_rental_price,
            has_cone_rental, cone_price, has_scoreboard, has_nets, has_goals,
            user_id_registration, date_time_registration
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
          [
            fieldId,
            equipment.has_jersey_rental || false,
            equipment.jersey_price || null,
            equipment.has_ball_rental || false,
            equipment.ball_rental_price || null,
            equipment.has_cone_rental || false,
            equipment.cone_price || null,
            equipment.has_scoreboard || false,
            equipment.has_nets !== false, // Por defecto true
            equipment.has_goals !== false, // Por defecto true
            user_id_registration,
          ]
        );
      } catch (equipError) {
        console.warn(`Error al guardar equipamiento:`, equipError.message);
      }
    }

    await client.query('COMMIT');

    // ✅ CORRECCIÓN: Obtener los deportes insertados para retornarlos con la cancha
    // Esto asegura que la respuesta de creación incluya sport_ids y sport_names
    const sportsQuery = `
      SELECT fs.sport_id, st.name AS sport_name
      FROM field_sports fs
      INNER JOIN sport_types st ON fs.sport_id = st.id
      WHERE fs.field_id = $1
      ORDER BY st.name
    `;
    const sportsResult = await pool.query(sportsQuery, [fieldId]);

    newField.sport_ids = sportsResult.rows.map(row => row.sport_id);
    newField.sport_names = sportsResult.rows.map(row => row.sport_name);

    // Obtener amenities insertados
    const amenitiesQuery = `SELECT amenity FROM field_amenities WHERE field_id = $1`;
    const amenitiesResult = await pool.query(amenitiesQuery, [fieldId]);
    newField.amenities = amenitiesResult.rows.map(row => row.amenity);

    // Obtener dimensiones insertadas
    const dimensionsQuery = `SELECT length, width, area, surface_type FROM field_dimensions WHERE field_id = $1`;
    const dimensionsResult = await pool.query(dimensionsQuery, [fieldId]);
    newField.dimensions = dimensionsResult.rows.length > 0 ? dimensionsResult.rows[0] : null;

    // Obtener equipamiento insertado
    const equipmentQuery = `
      SELECT has_jersey_rental, jersey_price, has_ball_rental, ball_rental_price,
             has_cone_rental, cone_price, has_scoreboard, has_nets, has_goals
      FROM field_equipment WHERE field_id = $1
    `;
    const equipmentResult = await pool.query(equipmentQuery, [fieldId]);
    newField.equipment = equipmentResult.rows.length > 0 ? equipmentResult.rows[0] : null;

    return newField;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Actualizar una cancha con todos sus deportes asociados
 * @param {number} id - ID de la cancha
 * @param {Object} fieldData - Datos a actualizar
 * @returns {Promise<Object|null>} Cancha actualizada o null
 */
const updateField = async (id, fieldData) => {
  const {
    name,
    location,
    departamento,
    provincia,
    distrito,
    district_id,
    address,
    phone,
    latitude,
    longitude,
    price_per_hour,
    status,
    field_type,
    sport_type,
    sport_ids = [], // Array de IDs de todos los deportes
    capacity,
    requires_advance_payment,
    advance_payment_amount,
    is_active,
    is_multi_sport,
    user_id_modification,
    // Campos adicionales para tablas relacionadas
    dimensions = null,
    amenities = [],
    equipment = null,
  } = fieldData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Actualizar datos de la cancha
    const updateQuery = `
      UPDATE fields
      SET name = COALESCE($1, name),
          location = COALESCE($2, location),
          departamento = COALESCE($3, departamento),
          provincia = COALESCE($4, provincia),
          distrito = COALESCE($5, distrito),
          district_id = COALESCE($6, district_id),
          address = COALESCE($7, address),
          phone = COALESCE($8, phone),
          latitude = COALESCE($9, latitude),
          longitude = COALESCE($10, longitude),
          price_per_hour = COALESCE($11, price_per_hour),
          status = COALESCE($12, status),
          field_type = COALESCE($13, field_type),
          sport_type = COALESCE($14, sport_type),
          capacity = COALESCE($15, capacity),
          requires_advance_payment = COALESCE($16, requires_advance_payment),
          advance_payment_amount = COALESCE($17, advance_payment_amount),
          is_active = COALESCE($18, is_active),
          is_multi_sport = COALESCE($19, is_multi_sport),
          user_id_modification = $20,
          date_time_modification = CURRENT_TIMESTAMP
      WHERE id = $21
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      name,
      location,
      departamento,
      provincia,
      distrito,
      district_id,
      address,
      phone,
      latitude,
      longitude,
      price_per_hour,
      status,
      field_type,
      sport_type,
      capacity,
      requires_advance_payment,
      advance_payment_amount,
      is_active,
      is_multi_sport,
      user_id_modification,
      id,
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // 2. Actualizar deportes en field_sports (si se enviaron sport_ids)
    if (sport_ids && sport_ids.length > 0) {
      // Eliminar deportes anteriores
      await client.query('DELETE FROM field_sports WHERE field_id = $1', [id]);

      // Insertar los nuevos deportes
      for (const sportId of sport_ids) {
        try {
          await client.query(
            `INSERT INTO field_sports (field_id, sport_id, user_id_registration, date_time_registration)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [id, sportId, user_id_modification]
          );
        } catch (sportError) {
          console.warn(`Error al asociar deporte ${sportId}:`, sportError.message);
        }
      }
    }

    // 3. Actualizar dimensiones en field_dimensions (upsert)
    if (
      dimensions &&
      (dimensions.length || dimensions.width || dimensions.area || dimensions.surface_type)
    ) {
      try {
        // Verificar si ya existen dimensiones
        const dimCheck = await client.query('SELECT id FROM field_dimensions WHERE field_id = $1', [
          id,
        ]);

        if (dimCheck.rows.length > 0) {
          // Actualizar
          await client.query(
            `UPDATE field_dimensions
             SET length = COALESCE($1, length),
                 width = COALESCE($2, width),
                 area = COALESCE($3, area),
                 surface_type = COALESCE($4, surface_type),
                 user_id_modification = $5,
                 date_time_modification = CURRENT_TIMESTAMP
             WHERE field_id = $6`,
            [
              dimensions.length || null,
              dimensions.width || null,
              dimensions.area || null,
              dimensions.surface_type || null,
              user_id_modification,
              id,
            ]
          );
        } else {
          // Insertar
          await client.query(
            `INSERT INTO field_dimensions (field_id, length, width, area, surface_type, user_id_registration, date_time_registration)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
            [
              id,
              dimensions.length || null,
              dimensions.width || null,
              dimensions.area || null,
              dimensions.surface_type || null,
              user_id_modification,
            ]
          );
        }
      } catch (dimError) {
        console.warn(`Error al actualizar dimensiones:`, dimError.message);
      }
    }

    // 4. Actualizar amenities en field_amenities (delete + insert)
    if (amenities && amenities.length > 0) {
      // Eliminar amenities anteriores
      await client.query('DELETE FROM field_amenities WHERE field_id = $1', [id]);

      // Insertar los nuevos amenities
      for (const amenity of amenities) {
        try {
          await client.query(
            `INSERT INTO field_amenities (field_id, amenity, user_id_registration, date_time_registration)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [id, amenity, user_id_modification]
          );
        } catch (amenityError) {
          console.warn(`Error al guardar amenity "${amenity}":`, amenityError.message);
        }
      }
    }

    // 5. Actualizar equipamiento en field_equipment (upsert) - siempre si se envía objeto equipment
    if (equipment) {
      try {
        // Verificar si ya existe equipamiento
        const equipCheck = await client.query(
          'SELECT id FROM field_equipment WHERE field_id = $1',
          [id]
        );

        if (equipCheck.rows.length > 0) {
          // Actualizar
          await client.query(
            `UPDATE field_equipment
             SET has_jersey_rental = COALESCE($1, has_jersey_rental),
                 jersey_price = COALESCE($2, jersey_price),
                 has_ball_rental = COALESCE($3, has_ball_rental),
                 ball_rental_price = COALESCE($4, ball_rental_price),
                 has_cone_rental = COALESCE($5, has_cone_rental),
                 cone_price = COALESCE($6, cone_price),
                 has_scoreboard = COALESCE($7, has_scoreboard),
                 user_id_modification = $8,
                 date_time_modification = CURRENT_TIMESTAMP
             WHERE field_id = $9`,
            [
              equipment.has_jersey_rental || false,
              equipment.jersey_price || null,
              equipment.has_ball_rental || false,
              equipment.ball_rental_price || null,
              equipment.has_cone_rental || false,
              equipment.cone_price || null,
              equipment.has_scoreboard || false,
              user_id_modification,
              id,
            ]
          );
        } else {
          // Insertar
          await client.query(
            `INSERT INTO field_equipment (field_id, has_jersey_rental, jersey_price, has_ball_rental, ball_rental_price, has_cone_rental, cone_price, has_scoreboard, has_nets, has_goals, user_id_registration, date_time_registration)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
            [
              id,
              equipment.has_jersey_rental || false,
              equipment.jersey_price || null,
              equipment.has_ball_rental || false,
              equipment.ball_rental_price || null,
              equipment.has_cone_rental || false,
              equipment.cone_price || null,
              equipment.has_scoreboard || false,
              equipment.has_nets !== false,
              equipment.has_goals !== false,
              user_id_modification,
            ]
          );
        }
      } catch (equipError) {
        console.warn(`Error al actualizar equipamiento:`, equipError.message);
      }
    }

    await client.query('COMMIT');

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Aprobar una cancha
 * @param {number} id - ID de la cancha
 * @param {number} approved_by - ID del usuario que aprueba
 * @returns {Promise<Object|null>} Cancha aprobada o null
 */
const approveField = async (id, approved_by) => {
  const query = `
    UPDATE fields
    SET approval_status = 'approved',
        approved_by = $1,
        approved_at = CURRENT_TIMESTAMP,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [approved_by, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Rechazar una cancha
 * @param {number} id - ID de la cancha
 * @param {number} rejected_by - ID del usuario que rechaza
 * @param {string} rejection_reason - Razón del rechazo
 * @returns {Promise<Object|null>} Cancha rechazada o null
 */
const rejectField = async (id, rejected_by, rejection_reason) => {
  const query = `
    UPDATE fields
    SET approval_status = 'rejected',
        rejected_by = $1,
        rejected_at = CURRENT_TIMESTAMP,
        rejection_reason = $2,
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [rejected_by, rejection_reason, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Eliminar (soft delete) una cancha
 * @param {number} id - ID de la cancha
 * @param {number} user_id_modification - ID del usuario que realiza la acción
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteField = async (id, user_id_modification) => {
  const query = `
    UPDATE fields
    SET is_active = false,
        status = 'deleted',
        user_id_modification = $1,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id
  `;

  const result = await pool.query(query, [user_id_modification, id]);
  return result.rows.length > 0;
};

/**
 * Actualizar rating de una cancha
 * @param {number} id - ID de la cancha
 * @param {number} rating - Nuevo rating
 * @param {number} totalReviews - Total de reseñas
 * @returns {Promise<Object|null>} Cancha actualizada o null
 */
const updateFieldRating = async (id, rating, totalReviews) => {
  const query = `
    UPDATE fields
    SET rating = $1,
        total_reviews = $2,
        date_time_modification = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [rating, totalReviews, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Obtener configuración completa de una cancha
 * Incluye información de todas las tablas relacionadas
 * @param {number} fieldId - ID de la cancha
 * @returns {Promise<Object>} Configuración completa
 */
const getFieldConfig = async fieldId => {
  const client = await pool.connect();
  try {
    // Obtener información básica del campo (incluyendo status para actualización en tiempo real)
    const fieldQuery = 'SELECT field_type, capacity, is_active, status FROM fields WHERE id = $1';
    const fieldResult = await client.query(fieldQuery, [fieldId]);

    if (fieldResult.rows.length === 0) {
      throw new Error('Cancha no encontrada');
    }

    // Obtener horarios
    const schedulesQuery = `
      SELECT id, day_of_week, is_open, open_time, close_time
      FROM field_schedules
      WHERE field_id = $1
      ORDER BY
        CASE day_of_week
          WHEN 'monday' THEN 1
          WHEN 'tuesday' THEN 2
          WHEN 'wednesday' THEN 3
          WHEN 'thursday' THEN 4
          WHEN 'friday' THEN 5
          WHEN 'saturday' THEN 6
          WHEN 'sunday' THEN 7
        END
    `;
    const schedulesResult = await client.query(schedulesQuery, [fieldId]);

    // Obtener amenidades
    const amenitiesQuery =
      'SELECT id, amenity as amenity_name, true as is_available FROM field_amenities WHERE field_id = $1';
    const amenitiesResult = await client.query(amenitiesQuery, [fieldId]);

    // Obtener reglas
    const rulesQuery =
      "SELECT id, rule as rule_text, 'general' as category, 0 as priority FROM field_rules WHERE field_id = $1";
    const rulesResult = await client.query(rulesQuery, [fieldId]);

    // Obtener mantenimiento
    const maintenanceQuery = `
      SELECT id, start_date, end_date, reason, 'general' as maintenance_type, 'scheduled' as status
      FROM field_maintenance_schedules
      WHERE field_id = $1
      ORDER BY start_date DESC
    `;
    const maintenanceResult = await client.query(maintenanceQuery, [fieldId]);

    // Obtener precios especiales
    const pricingQuery = `
      SELECT
        fsp.id,
        fsp.name,
        fsp.description,
        fsp.price AS "discountValue",
        fsp.time_ranges AS "timeSlots",
        fsp.days AS "daysOfWeek"
      FROM field_special_pricing fsp
      WHERE fsp.field_id = $1 AND fsp.is_active = true
    `;
    const pricingResult = await client.query(pricingQuery, [fieldId]);

    // Formatear precios especiales para el frontend
    const specialPricingFormatted = pricingResult.rows.map(row => ({
      id: row.id,
      name: row.name || '',
      discountValue: parseFloat(row.discountValue) || 0,
      discountType: 'percentage',
      timeSlots: row.timeSlots || [],
      daysOfWeek: row.daysOfWeek || [],
    }));

    // Obtener equipamiento
    const equipmentQuery = `
      SELECT
        id,
        'jersey_rental' as equipment_type,
        CASE WHEN has_jersey_rental THEN 1 ELSE 0 END as quantity,
        'good' as condition,
        'Alquiler de camisetas' as description
      FROM field_equipment
      WHERE field_id = $1 AND has_jersey_rental = true
      UNION ALL
      SELECT
        id,
        'ball_rental' as equipment_type,
        CASE WHEN has_ball_rental THEN 1 ELSE 0 END as quantity,
        'good' as condition,
        'Alquiler de balones' as description
      FROM field_equipment
      WHERE field_id = $1 AND has_ball_rental = true
      UNION ALL
      SELECT
        id,
        'scoreboard' as equipment_type,
        CASE WHEN has_scoreboard THEN 1 ELSE 0 END as quantity,
        'good' as condition,
        'Tablero de puntaje' as description
      FROM field_equipment
      WHERE field_id = $1 AND has_scoreboard = true
    `;
    const equipmentResult = await client.query(equipmentQuery, [fieldId]);

    // Obtener política de cancelación
    const cancellationPolicyQuery = `
      SELECT
        allow_cancellation,
        hours_before_event,
        refund_percentage
      FROM field_cancellation_policies
      WHERE field_id = $1
    `;
    const cancellationPolicyResult = await client.query(cancellationPolicyQuery, [fieldId]);

    // Formato de política de cancelación (con valores por defecto si no existe)
    const cancellationPolicy =
      cancellationPolicyResult.rows.length > 0
        ? {
            allowCancellation: cancellationPolicyResult.rows[0].allow_cancellation ?? true,
            hoursBeforeEvent: cancellationPolicyResult.rows[0].hours_before_event ?? 24,
            refundPercentage: parseFloat(cancellationPolicyResult.rows[0].refund_percentage) ?? 0,
          }
        : {
            allowCancellation: true,
            hoursBeforeEvent: 24,
            refundPercentage: 0,
          };

    return {
      field: fieldResult.rows[0],
      schedules: schedulesResult.rows,
      amenities: amenitiesResult.rows,
      rules: rulesResult.rows,
      maintenanceSchedules: maintenanceResult.rows,
      specialPricing: specialPricingFormatted,
      equipment: equipmentResult.rows,
      cancellationPolicy: cancellationPolicy,
    };
  } finally {
    client.release();
  }
};

/**
 * Actualizar configuración completa de una cancha
 * Usa transacciones para garantizar consistencia de datos
 * @param {number} fieldId - ID de la cancha
 * @param {Object} configData - Datos de configuración
 * @param {number} userId - ID del usuario que realiza la actualización
 * @returns {Promise<Object>} Configuración actualizada
 */
const updateFieldConfig = async (fieldId, configData, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Actualizar información básica del campo
    if (configData.field) {
      await client.query(
        `UPDATE fields
         SET field_type = COALESCE($1, field_type),
             capacity = COALESCE($2, capacity),
             is_active = COALESCE($3, is_active),
             user_id_modification = $4,
             date_time_modification = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [
          configData.field.field_type,
          configData.field.capacity,
          configData.field.is_active,
          userId,
          fieldId,
        ]
      );
    }

    // 2. Actualizar horarios
    if (configData.schedules && Array.isArray(configData.schedules)) {
      // Eliminar horarios existentes
      await client.query('DELETE FROM field_schedules WHERE field_id = $1', [fieldId]);

      // Insertar nuevos horarios
      for (const schedule of configData.schedules) {
        await client.query(
          `INSERT INTO field_schedules (field_id, day_of_week, is_open, open_time, close_time, user_id_registration)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            fieldId,
            schedule.day_of_week,
            schedule.is_open ?? schedule.is_available ?? true,
            schedule.start_time,
            schedule.end_time,
            userId,
          ]
        );
      }
    }

    // 3. Actualizar amenidades
    if (configData.amenities && Array.isArray(configData.amenities)) {
      // Eliminar amenidades existentes
      await client.query('DELETE FROM field_amenities WHERE field_id = $1', [fieldId]);

      // Insertar nuevas amenidades
      for (const amenity of configData.amenities) {
        if (amenity.is_available !== false) {
          await client.query(
            `INSERT INTO field_amenities (field_id, amenity, user_id_registration)
             VALUES ($1, $2, $3)`,
            [fieldId, amenity.amenity_name, userId]
          );
        }
      }
    }

    // 4. Actualizar reglas
    if (configData.rules && Array.isArray(configData.rules)) {
      // Eliminar reglas existentes
      await client.query('DELETE FROM field_rules WHERE field_id = $1', [fieldId]);

      // Insertar nuevas reglas
      for (const rule of configData.rules) {
        await client.query(
          `INSERT INTO field_rules (field_id, rule, user_id_registration)
           VALUES ($1, $2, $3)`,
          [fieldId, rule.rule_text, userId]
        );
      }
    }

    // 5. Actualizar mantenimiento
    if (configData.maintenanceSchedules && Array.isArray(configData.maintenanceSchedules)) {
      // Eliminar mantenimientos existentes
      await client.query('DELETE FROM field_maintenance_schedules WHERE field_id = $1', [fieldId]);

      // Insertar nuevos mantenimientos
      for (const maintenance of configData.maintenanceSchedules) {
        await client.query(
          `INSERT INTO field_maintenance_schedules (field_id, start_date, end_date, reason, user_id_registration)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            fieldId,
            maintenance.start_date,
            maintenance.end_date,
            maintenance.reason || maintenance.description || '',
            userId,
          ]
        );
      }

      // Actualizar estado de la cancha automáticamente según mantenimientos activos
      // IMPORTANTE: Usar zona horaria de Perú (UTC-5) para comparar fechas correctamente
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      const activeMaintenanceQuery = `
        SELECT COUNT(*) as count
        FROM field_maintenance_schedules
        WHERE field_id = $1
        AND start_date <= $2
        AND end_date >= $2
      `;
      const activeMaintenanceResult = await client.query(activeMaintenanceQuery, [fieldId, today]);
      const hasActiveMaintenance = parseInt(activeMaintenanceResult.rows[0].count) > 0;

      // Si hay mantenimiento activo, cambiar estado a 'maintenance', sino a 'available'
      const newStatus = hasActiveMaintenance ? 'maintenance' : 'available';
      await client.query(
        `UPDATE fields
         SET status = $1,
             user_id_modification = $2,
             date_time_modification = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newStatus, userId, fieldId]
      );
    }

    // 6. Actualizar precios especiales con tablas normalizadas
    if (configData.specialPricing && Array.isArray(configData.specialPricing)) {
      // Eliminar precios especiales existentes (CASCADE elimina slots y days)
      await client.query('DELETE FROM field_special_pricing WHERE field_id = $1', [fieldId]);

      // Insertar nuevos precios especiales
      for (const pricing of configData.specialPricing) {
        const priceName = pricing.name || 'Precio especial';

        // Obtener el valor del precio/descuento de forma segura
        let priceValue = 0;
        if (pricing.discountValue !== undefined && pricing.discountValue !== null) {
          priceValue = parseFloat(pricing.discountValue);
        } else if (pricing.special_price !== undefined && pricing.special_price !== null) {
          priceValue = parseFloat(pricing.special_price);
        } else if (pricing.price !== undefined && pricing.price !== null) {
          priceValue = parseFloat(pricing.price);
        }
        if (isNaN(priceValue)) {
          priceValue = 0;
        }

        // Insertar precio especial principal con time_ranges y days como JSONB
        const timeRanges = pricing.timeSlots && Array.isArray(pricing.timeSlots) ? JSON.stringify(pricing.timeSlots) : null;
        const days = pricing.daysOfWeek && Array.isArray(pricing.daysOfWeek) ? JSON.stringify(pricing.daysOfWeek.map(d => d.toLowerCase())) : null;

        await client.query(
          `INSERT INTO field_special_pricing (field_id, name, description, price, time_ranges, days, is_active, user_id_registration)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7)
           RETURNING id`,
          [fieldId, priceName, pricing.description || null, priceValue, timeRanges, days, userId]
        );
      }
    }

    // 7. Actualizar equipamiento
    if (configData.equipment && Array.isArray(configData.equipment)) {
      // Verificar si existe registro de equipamiento
      const equipmentCheck = await client.query(
        'SELECT id FROM field_equipment WHERE field_id = $1',
        [fieldId]
      );

      const hasJerseyRental = configData.equipment.some(e => e.equipment_type === 'jersey_rental');
      const hasBallRental = configData.equipment.some(e => e.equipment_type === 'ball_rental');
      const hasScoreboard = configData.equipment.some(e => e.equipment_type === 'scoreboard');
      const hasNets = configData.equipment.some(e => e.equipment_type === 'nets');
      const hasGoals = configData.equipment.some(e => e.equipment_type === 'goals');

      if (equipmentCheck.rows.length > 0) {
        // Actualizar equipamiento existente
        await client.query(
          `UPDATE field_equipment
           SET has_jersey_rental = $1,
               has_ball_rental = $2,
               has_scoreboard = $3,
               has_nets = $4,
               has_goals = $5,
               user_id_modification = $6,
               date_time_modification = CURRENT_TIMESTAMP
           WHERE field_id = $7`,
          [hasJerseyRental, hasBallRental, hasScoreboard, hasNets, hasGoals, userId, fieldId]
        );
      } else {
        // Crear nuevo registro de equipamiento
        await client.query(
          `INSERT INTO field_equipment (
            field_id, has_jersey_rental, has_ball_rental, has_scoreboard,
            has_nets, has_goals, user_id_registration
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [fieldId, hasJerseyRental, hasBallRental, hasScoreboard, hasNets, hasGoals, userId]
        );
      }
    }

    // 8. Actualizar política de cancelación
    if (configData.cancellationPolicy) {
      const {
        allowCancellation = true,
        hoursBeforeEvent = 24,
        refundPercentage = 0,
      } = configData.cancellationPolicy;

      // Verificar si ya existe una política
      const policyCheck = await client.query(
        'SELECT id FROM field_cancellation_policies WHERE field_id = $1',
        [fieldId]
      );

      if (policyCheck.rows.length > 0) {
        // Actualizar política existente
        await client.query(
          `UPDATE field_cancellation_policies
           SET allow_cancellation = $1,
               hours_before_event = $2,
               refund_percentage = $3,
               user_id_modification = $4,
               date_time_modification = CURRENT_TIMESTAMP
           WHERE field_id = $5`,
          [allowCancellation, hoursBeforeEvent, refundPercentage, userId, fieldId]
        );
      } else {
        // Crear nueva política
        await client.query(
          `INSERT INTO field_cancellation_policies (
            field_id, allow_cancellation, hours_before_event, refund_percentage,
            user_id_registration, date_time_registration
           )
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [fieldId, allowCancellation, hoursBeforeEvent, refundPercentage, userId]
        );
      }
    }

    await client.query('COMMIT');

    // Sincronizar estados de mantenimiento inmediatamente después de actualizar
    // Esto asegura que los cambios se reflejen sin esperar al CRON diario
    try {
      const { runManualUpdate } = require('../jobs/updateFieldMaintenanceStatus');
      await runManualUpdate();
    } catch (syncError) {
      // No fallar la actualización si falla la sincronización
      console.error('Error al sincronizar mantenimientos:', syncError.message);
    }

    // Retornar configuración actualizada
    return await getFieldConfig(fieldId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllFields,
  getFieldById,
  createField,
  updateField,
  approveField,
  rejectField,
  deleteField,
  updateFieldRating,
  getFieldConfig,
  updateFieldConfig,
};
