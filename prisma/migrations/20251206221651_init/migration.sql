-- CreateTable
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER,
    "details" JSONB,
    "ip_address" VARCHAR(45),
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "field_id" INTEGER,
    "customer_id" INTEGER,
    "reservation_id" INTEGER,
    "user_id" INTEGER,
    "status" VARCHAR(20) DEFAULT 'unread',
    "priority" VARCHAR(10) DEFAULT 'medium',
    "admin_id" INTEGER NOT NULL,
    "reservation_data" JSONB,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_tiers" (
    "id" SERIAL NOT NULL,
    "badge_id" INTEGER NOT NULL,
    "tier" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(255),
    "label" VARCHAR(100),
    "required_value" INTEGER NOT NULL,
    "reward_hours" DECIMAL(10,2) DEFAULT 0.00,
    "color" VARCHAR(20),
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "badge_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "icon" VARCHAR(255),
    "description" TEXT,
    "criteria_type" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),
    "criteria_id" INTEGER,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklist" (
    "id" SERIAL NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "reason" TEXT NOT NULL,
    "blocked_by" INTEGER NOT NULL,
    "blocked_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "blocked_until" TIMESTAMPTZ(6),
    "reservations_missed" INTEGER DEFAULT 0,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_alert_rules" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sport_types" JSONB,
    "time_ranges" JSONB,
    "days" JSONB,
    "enabled" BOOLEAN DEFAULT true,
    "notify_in_app" BOOLEAN DEFAULT true,
    "notify_whatsapp" BOOLEAN DEFAULT false,
    "notify_email" BOOLEAN DEFAULT false,
    "created_by" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "booking_alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_fields" (
    "id" SERIAL NOT NULL,
    "coupon_id" INTEGER NOT NULL,
    "field_id" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "coupon_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usage" (
    "id" SERIAL NOT NULL,
    "coupon_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "customer_id" INTEGER,
    "reservation_id" INTEGER NOT NULL,
    "used_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "coupon_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "usage_limit" INTEGER,
    "used_count" INTEGER DEFAULT 0,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "min_purchase" DECIMAL(10,2) DEFAULT 0.00,
    "applicable_fields" JSONB,
    "created_by" INTEGER NOT NULL,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_badges" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "badge_id" INTEGER NOT NULL,
    "tier" VARCHAR(20) NOT NULL,
    "unlocked_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "auto_assigned" BOOLEAN DEFAULT false,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "customer_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_promotion_history" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "hours_redeemed" DECIMAL(10,2) DEFAULT 0.00,
    "hours_earned" DECIMAL(10,2) DEFAULT 0.00,
    "remaining_hours" DECIMAL(10,2) DEFAULT 0.00,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "customer_promotion_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "phone_number" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "created_by" INTEGER NOT NULL,
    "total_reservations" INTEGER DEFAULT 0,
    "total_hours" DECIMAL(10,2) DEFAULT 0.00,
    "total_spent" DECIMAL(10,2) DEFAULT 0.00,
    "earned_free_hours" DECIMAL(10,2) DEFAULT 0.00,
    "used_free_hours" DECIMAL(10,2) DEFAULT 0.00,
    "available_free_hours" DECIMAL(10,2) DEFAULT 0.00,
    "last_reservation" TIMESTAMPTZ(6),
    "is_vip" BOOLEAN DEFAULT false,
    "notes" TEXT,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),
    "accumulated_hours" DECIMAL(10,2) DEFAULT 0.00,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(2) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "province_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_amenities" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "amenity" VARCHAR(255) NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_cancellation_policies" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "allow_cancellation" BOOLEAN DEFAULT true,
    "hours_before_event" INTEGER DEFAULT 24,
    "refund_percentage" DECIMAL(5,2) DEFAULT 100.00,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_cancellation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_dimensions" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "length" VARCHAR(50),
    "width" VARCHAR(50),
    "area" VARCHAR(50),
    "goal_size" VARCHAR(50),
    "court_type" VARCHAR(50),
    "surface_type" VARCHAR(30),
    "basket_height" VARCHAR(20),
    "net_height" VARCHAR(20),
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_equipment" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "has_jersey_rental" BOOLEAN DEFAULT false,
    "jersey_price" DECIMAL(10,2),
    "has_ball_rental" BOOLEAN DEFAULT false,
    "ball_rental_price" DECIMAL(10,2),
    "has_scoreboard" BOOLEAN DEFAULT false,
    "has_nets" BOOLEAN DEFAULT true,
    "has_goals" BOOLEAN DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),
    "has_cone_rental" BOOLEAN DEFAULT false,
    "cone_price" DECIMAL(10,2),

    CONSTRAINT "field_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_images" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "category" VARCHAR(50),
    "is_primary" BOOLEAN DEFAULT false,
    "order_index" INTEGER DEFAULT 0,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_maintenance_schedules" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "reason" TEXT,
    "is_recurring" BOOLEAN DEFAULT false,
    "recurrence_pattern" VARCHAR(20),
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_rules" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "rule" TEXT NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_schedules" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "day_of_week" VARCHAR(10) NOT NULL,
    "is_open" BOOLEAN DEFAULT true,
    "open_time" TIME(6),
    "close_time" TIME(6),
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_special_pricing" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "time_ranges" JSONB,
    "days" JSONB,
    "is_active" BOOLEAN DEFAULT true,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_special_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_sports" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_videos" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "video_url" TEXT NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fields" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "location" TEXT,
    "departamento" VARCHAR(100),
    "provincia" VARCHAR(100),
    "distrito" VARCHAR(100),
    "district_id" INTEGER,
    "address" TEXT,
    "phone" VARCHAR(20),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "price_per_hour" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) DEFAULT 'available',
    "approval_status" VARCHAR(20) DEFAULT 'pending',
    "field_type" VARCHAR(50),
    "sport_type" INTEGER,
    "capacity" INTEGER,
    "requires_advance_payment" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "is_multi_sport" BOOLEAN DEFAULT false,
    "rating" DECIMAL(3,2) DEFAULT 0.00,
    "total_reviews" INTEGER DEFAULT 0,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMPTZ(6),
    "rejected_by" INTEGER,
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_by" INTEGER,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),
    "advance_payment_amount" DECIMAL(10,2) DEFAULT 0.00,

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_configs" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "monthly_fee" DECIMAL(10,2) NOT NULL,
    "due_day" INTEGER NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_payments" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "payment_config_id" INTEGER,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" VARCHAR(20) DEFAULT 'pending',
    "paid_at" TIMESTAMPTZ(6),
    "paid_amount" DECIMAL(10,2) DEFAULT 0,
    "payment_method" VARCHAR(50),
    "payment_reference" VARCHAR(255),
    "notes" TEXT,
    "generated_by" INTEGER,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "confirmed_by" INTEGER,
    "payment_voucher_url" VARCHAR(500),
    "reported_at" TIMESTAMPTZ(6),
    "reported_by" INTEGER,

    CONSTRAINT "monthly_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) DEFAULT 'pending',
    "paid_date" TIMESTAMPTZ(6),
    "payment_method" VARCHAR(50),
    "operation_number" VARCHAR(100),
    "notes" TEXT,
    "registered_by" INTEGER,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "module" VARCHAR(50),
    "is_active" BOOLEAN DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_rule_fields" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "field_id" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "promotion_rule_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_rule_sports" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "promotion_rule_sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_rules" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "hours_required" DECIMAL(10,2) NOT NULL,
    "free_hours" DECIMAL(10,2) NOT NULL,
    "applies_to" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "promotion_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provinces" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(4) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "department_id" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" SERIAL NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "field_id" INTEGER NOT NULL,
    "refund_amount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) DEFAULT 'pending',
    "cancelled_at" TIMESTAMPTZ(6) NOT NULL,
    "cancellation_reason" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "processed_by" INTEGER,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_requests" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "dni" VARCHAR(8),
    "field_name" VARCHAR(255) NOT NULL,
    "address" TEXT NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "district" VARCHAR(100) NOT NULL,
    "documents" JSONB,
    "status" VARCHAR(20) DEFAULT 'pending',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_time_slots" (
    "id" SERIAL NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "time_slot" VARCHAR(50) NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "reservation_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) DEFAULT 0.00,
    "total_price" DECIMAL(10,2) NOT NULL,
    "advance_payment" DECIMAL(10,2) DEFAULT 0.00,
    "remaining_payment" DECIMAL(10,2) DEFAULT 0.00,
    "payment_method" VARCHAR(50),
    "payment_status" VARCHAR(20) DEFAULT 'pending',
    "payment_voucher_url" TEXT,
    "status" VARCHAR(20) DEFAULT 'pending',
    "type" VARCHAR(20) DEFAULT 'customer_booking',
    "hours" DECIMAL(5,2) NOT NULL,
    "coupon_id" INTEGER,
    "coupon_discount" DECIMAL(10,2) DEFAULT 0.00,
    "reviewed" BOOLEAN DEFAULT false,
    "review_id" INTEGER,
    "cancelled_by" VARCHAR(20),
    "cancellation_reason" TEXT,
    "advance_kept" DECIMAL(10,2) DEFAULT 0.00,
    "lost_revenue" DECIMAL(10,2) DEFAULT 0.00,
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "no_show_date" TIMESTAMPTZ(6),
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),
    "free_hours_used" DECIMAL(10,2) DEFAULT 0,
    "free_hours_discount" DECIMAL(10,2) DEFAULT 0,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMPTZ(6),
    "rejected_by" INTEGER,
    "rejected_at" TIMESTAMPTZ(6),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "field_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "cleanliness" INTEGER NOT NULL,
    "service" INTEGER NOT NULL,
    "facilities" INTEGER NOT NULL,
    "overall_rating" DECIMAL(3,2) NOT NULL,
    "comment" TEXT,
    "is_visible" BOOLEAN DEFAULT true,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "roles_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_config" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "site_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media" (
    "id" SERIAL NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "url" TEXT NOT NULL,
    "icon" VARCHAR(255),
    "enabled" BOOLEAN DEFAULT true,
    "order_index" INTEGER DEFAULT 0,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "social_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(255),
    "color" VARCHAR(20),
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "sport_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_ranges" (
    "id" SERIAL NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "order_index" INTEGER NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "time_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_managed_fields" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "field_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" INTEGER,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "user_managed_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "permission" VARCHAR(100) NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role_id" INTEGER NOT NULL,
    "admin_type" VARCHAR(20),
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "avatar_url" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "last_login" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "login_attempts" INTEGER DEFAULT 0,
    "last_login_attempt" TIMESTAMPTZ(6),
    "is_blocked" BOOLEAN DEFAULT false,
    "block_until" TIMESTAMPTZ(6),
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_configs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "config_data" JSONB NOT NULL,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "whatsapp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_payment_methods" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "method_type" VARCHAR(20) NOT NULL,
    "is_enabled" BOOLEAN DEFAULT true,
    "account_number" VARCHAR(50),
    "account_holder" VARCHAR(255),
    "phone_number" VARCHAR(20),
    "qr_image_url" TEXT,
    "bank_name" VARCHAR(100),
    "cci_number" VARCHAR(30),
    "instructions" TEXT,
    "order_index" INTEGER DEFAULT 0,
    "status" VARCHAR(20) DEFAULT 'active',
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "field_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_criteria" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "calculation_table" VARCHAR(100) NOT NULL,
    "calculation_field" VARCHAR(100) NOT NULL,
    "calculation_type" VARCHAR(20) NOT NULL DEFAULT 'count',
    "filter_conditions" JSONB,
    "is_active" BOOLEAN DEFAULT true,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "badge_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_promotion_redemptions" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "promotion_rule_id" INTEGER NOT NULL,
    "hours_earned" DECIMAL(10,2) NOT NULL,
    "redeemed_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_promotion_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_alerts_admin_id" ON "alerts"("admin_id");

-- CreateIndex
CREATE INDEX "idx_alerts_created_at" ON "alerts"("date_time_registration");

-- CreateIndex
CREATE INDEX "idx_alerts_status" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "idx_alerts_type" ON "alerts"("type");

-- CreateIndex
CREATE UNIQUE INDEX "uk_badge_tiers" ON "badge_tiers"("badge_id", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "badges_name_key" ON "badges"("name");

-- CreateIndex
CREATE INDEX "idx_badges_criteria_id" ON "badges"("criteria_id");

-- CreateIndex
CREATE UNIQUE INDEX "blacklist_phone_number_key" ON "blacklist"("phone_number");

-- CreateIndex
CREATE INDEX "idx_blacklist_blocked_by" ON "blacklist"("blocked_by");

-- CreateIndex
CREATE INDEX "idx_blacklist_phone_number" ON "blacklist"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "uk_coupon_fields" ON "coupon_fields"("coupon_id", "field_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "idx_coupons_code" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "idx_coupons_is_active" ON "coupons"("is_active");

-- CreateIndex
CREATE INDEX "idx_coupons_valid_from" ON "coupons"("valid_from");

-- CreateIndex
CREATE INDEX "idx_coupons_valid_until" ON "coupons"("valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "uk_customer_badges" ON "customer_badges"("customer_id", "badge_id", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_number_key" ON "customers"("phone_number");

-- CreateIndex
CREATE INDEX "idx_customers_created_by" ON "customers"("created_by");

-- CreateIndex
CREATE INDEX "idx_customers_is_vip" ON "customers"("is_vip");

-- CreateIndex
CREATE INDEX "idx_customers_phone_number" ON "customers"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "districts_code_key" ON "districts"("code");

-- CreateIndex
CREATE INDEX "idx_districts_code" ON "districts"("code");

-- CreateIndex
CREATE INDEX "idx_districts_province_id" ON "districts"("province_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_cancellation_policies_field_id_key" ON "field_cancellation_policies"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_dimensions_field_id_key" ON "field_dimensions"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_equipment_field_id_key" ON "field_equipment"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_field_sports" ON "field_sports"("field_id", "sport_id");

-- CreateIndex
CREATE INDEX "idx_fields_admin_id" ON "fields"("admin_id");

-- CreateIndex
CREATE INDEX "idx_fields_approval_status" ON "fields"("approval_status");

-- CreateIndex
CREATE INDEX "idx_fields_departamento" ON "fields"("departamento");

-- CreateIndex
CREATE INDEX "idx_fields_district_id" ON "fields"("district_id");

-- CreateIndex
CREATE INDEX "idx_fields_distrito" ON "fields"("distrito");

-- CreateIndex
CREATE INDEX "idx_fields_is_active" ON "fields"("is_active");

-- CreateIndex
CREATE INDEX "idx_fields_provincia" ON "fields"("provincia");

-- CreateIndex
CREATE INDEX "idx_fields_sport_type" ON "fields"("sport_type");

-- CreateIndex
CREATE INDEX "idx_fields_status" ON "fields"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_configs_field_id_key" ON "payment_configs"("field_id");

-- CreateIndex
CREATE INDEX "idx_monthly_payments_field" ON "monthly_payments"("field_id");

-- CreateIndex
CREATE INDEX "idx_monthly_payments_admin" ON "monthly_payments"("admin_id");

-- CreateIndex
CREATE INDEX "idx_monthly_payments_status" ON "monthly_payments"("status");

-- CreateIndex
CREATE INDEX "idx_monthly_payments_month_year" ON "monthly_payments"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "uk_monthly_payment" ON "monthly_payments"("field_id", "month", "year");

-- CreateIndex
CREATE INDEX "idx_payments_admin_id" ON "payments"("admin_id");

-- CreateIndex
CREATE INDEX "idx_payments_field_id" ON "payments"("field_id");

-- CreateIndex
CREATE INDEX "idx_payments_month" ON "payments"("month");

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uk_promotion_rule_fields" ON "promotion_rule_fields"("rule_id", "field_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_promotion_rule_sports" ON "promotion_rule_sports"("rule_id", "sport_id");

-- CreateIndex
CREATE UNIQUE INDEX "provinces_code_key" ON "provinces"("code");

-- CreateIndex
CREATE INDEX "idx_provinces_department_id" ON "provinces"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_reservation_id_key" ON "refunds"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_refunds_customer_id" ON "refunds"("customer_id");

-- CreateIndex
CREATE INDEX "idx_registration_requests_created_at" ON "registration_requests"("date_time_registration");

-- CreateIndex
CREATE INDEX "idx_reservations_created_at" ON "reservations"("date_time_registration");

-- CreateIndex
CREATE INDEX "idx_reservations_customer_id" ON "reservations"("customer_id");

-- CreateIndex
CREATE INDEX "idx_reservations_date" ON "reservations"("date");

-- CreateIndex
CREATE INDEX "idx_reservations_field_date" ON "reservations"("field_id", "date");

-- CreateIndex
CREATE INDEX "idx_reservations_field_id" ON "reservations"("field_id");

-- CreateIndex
CREATE INDEX "idx_reservations_payment_status" ON "reservations"("payment_status");

-- CreateIndex
CREATE INDEX "idx_reservations_status" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "idx_reservations_approved_at" ON "reservations"("approved_at");

-- CreateIndex
CREATE INDEX "idx_reservations_approved_by" ON "reservations"("approved_by");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_reservation_id_key" ON "reviews"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_reviews_customer_id" ON "reviews"("customer_id");

-- CreateIndex
CREATE INDEX "idx_reviews_field_id" ON "reviews"("field_id");

-- CreateIndex
CREATE INDEX "idx_reviews_is_visible" ON "reviews"("is_visible");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uk_roles_permissions" ON "roles_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_config_key_key" ON "site_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "sport_types_name_key" ON "sport_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uk_time_ranges_times" ON "time_ranges"("start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "uk_user_managed_fields" ON "user_managed_fields"("user_id", "field_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email_phone" ON "users"("email", "phone");

-- CreateIndex
CREATE INDEX "idx_users_is_active" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "idx_users_phone" ON "users"("phone");

-- CreateIndex
CREATE INDEX "idx_users_role_id" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "idx_users_username" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_configs_user_id_key" ON "whatsapp_configs"("user_id");

-- CreateIndex
CREATE INDEX "idx_field_payment_methods_field_id" ON "field_payment_methods"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_field_payment_methods" ON "field_payment_methods"("field_id", "method_type");

-- CreateIndex
CREATE UNIQUE INDEX "badge_criteria_code_key" ON "badge_criteria"("code");

-- CreateIndex
CREATE INDEX "idx_badge_criteria_code" ON "badge_criteria"("code");

-- CreateIndex
CREATE INDEX "idx_cpr_customer" ON "customer_promotion_redemptions"("customer_id");

-- CreateIndex
CREATE INDEX "idx_cpr_promotion" ON "customer_promotion_redemptions"("promotion_rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_promotion_redemption_customer_id_promotion_rule_id_key" ON "customer_promotion_redemptions"("customer_id", "promotion_rule_id");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "fk_activity_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "fk_alerts_admin" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "fk_alerts_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "fk_alerts_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "fk_alerts_reservation" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "fk_alerts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "badge_tiers" ADD CONSTRAINT "fk_badge_tiers_badge" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "fk_badges_criteria" FOREIGN KEY ("criteria_id") REFERENCES "badge_criteria"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "blacklist" ADD CONSTRAINT "fk_blacklist_blocked_by" FOREIGN KEY ("blocked_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "booking_alert_rules" ADD CONSTRAINT "fk_booking_alert_rules_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupon_fields" ADD CONSTRAINT "fk_coupon_fields_coupon" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupon_fields" ADD CONSTRAINT "fk_coupon_fields_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "fk_coupon_usage_coupon" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "fk_coupon_usage_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "fk_coupon_usage_reservation" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "fk_coupon_usage_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "fk_coupons_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_badges" ADD CONSTRAINT "fk_customer_badges_badge" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_badges" ADD CONSTRAINT "fk_customer_badges_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_promotion_history" ADD CONSTRAINT "fk_customer_promotion_history_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "fk_customers_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "fk_customers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "fk_districts_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "fk_districts_province" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_amenities" ADD CONSTRAINT "fk_field_amenities_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_cancellation_policies" ADD CONSTRAINT "fk_field_cancellation_policies_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_dimensions" ADD CONSTRAINT "fk_field_dimensions_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_equipment" ADD CONSTRAINT "fk_field_equipment_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_images" ADD CONSTRAINT "fk_field_images_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_maintenance_schedules" ADD CONSTRAINT "fk_field_maintenance_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_rules" ADD CONSTRAINT "fk_field_rules_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_schedules" ADD CONSTRAINT "fk_field_schedules_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_special_pricing" ADD CONSTRAINT "fk_field_special_pricing_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_sports" ADD CONSTRAINT "fk_field_sports_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_sports" ADD CONSTRAINT "fk_field_sports_sport" FOREIGN KEY ("sport_id") REFERENCES "sport_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_videos" ADD CONSTRAINT "fk_field_videos_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fk_fields_admin" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fk_fields_approved_by" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fk_fields_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fk_fields_district" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fk_fields_rejected_by" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fk_fields_sport_type" FOREIGN KEY ("sport_type") REFERENCES "sport_types"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_configs" ADD CONSTRAINT "fk_payment_configs_admin" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_configs" ADD CONSTRAINT "fk_payment_configs_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "monthly_payments" ADD CONSTRAINT "fk_monthly_payments_admin" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "monthly_payments" ADD CONSTRAINT "fk_monthly_payments_config" FOREIGN KEY ("payment_config_id") REFERENCES "payment_configs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "monthly_payments" ADD CONSTRAINT "fk_monthly_payments_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_admin" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_registered_by" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_rule_fields" ADD CONSTRAINT "fk_promotion_rule_fields_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_rule_fields" ADD CONSTRAINT "fk_promotion_rule_fields_rule" FOREIGN KEY ("rule_id") REFERENCES "promotion_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_rule_sports" ADD CONSTRAINT "fk_promotion_rule_sports_rule" FOREIGN KEY ("rule_id") REFERENCES "promotion_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_rule_sports" ADD CONSTRAINT "fk_promotion_rule_sports_sport" FOREIGN KEY ("sport_id") REFERENCES "sport_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_rules" ADD CONSTRAINT "fk_promotion_rules_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provinces" ADD CONSTRAINT "fk_provinces_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "fk_refunds_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "fk_refunds_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "fk_refunds_processed_by" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "fk_refunds_reservation" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "fk_registration_requests_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservation_time_slots" ADD CONSTRAINT "fk_reservation_time_slots_reservation" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "fk_reservations_approved_by" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "fk_reservations_coupon" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "fk_reservations_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "fk_reservations_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "fk_reservations_rejected_by" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_reservation" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "fk_roles_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "fk_roles_permissions_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_managed_fields" ADD CONSTRAINT "fk_user_managed_fields_assigned_by" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_managed_fields" ADD CONSTRAINT "fk_user_managed_fields_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_managed_fields" ADD CONSTRAINT "fk_user_managed_fields_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "fk_user_permissions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "fk_users_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "fk_users_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_configs" ADD CONSTRAINT "fk_whatsapp_configs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_payment_methods" ADD CONSTRAINT "fk_field_payment_methods_field" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_promotion_redemptions" ADD CONSTRAINT "customer_promotion_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_promotion_redemptions" ADD CONSTRAINT "customer_promotion_redemptions_promotion_rule_id_fkey" FOREIGN KEY ("promotion_rule_id") REFERENCES "promotion_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateTable
CREATE TABLE "platform_payment_methods" (
    "id" SERIAL NOT NULL,
    "method_type" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "bank_name" VARCHAR(100),
    "account_number" VARCHAR(50),
    "account_holder" VARCHAR(255),
    "cci_number" VARCHAR(30),
    "phone_number" VARCHAR(20),
    "qr_image_url" VARCHAR(500),
    "instructions" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "order_index" INTEGER DEFAULT 0,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id_modification" INTEGER,
    "date_time_modification" TIMESTAMPTZ(6),

    CONSTRAINT "platform_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_platform_payment_methods_active" ON "platform_payment_methods"("is_active");

-- CreateIndex
CREATE INDEX "idx_platform_payment_methods_type" ON "platform_payment_methods"("method_type");
