CREATE TYPE "public"."access_end_rule" AS ENUM('UNKNOWN', 'DURATION_AFTER_START', 'FIXED_DATE');--> statement-breakpoint
CREATE TYPE "public"."access_start_rule" AS ENUM('UNKNOWN', 'ON_PURCHASE', 'ON_FIRST_CLASS', 'FIXED_DATE');--> statement-breakpoint
CREATE TYPE "public"."checkout_status" AS ENUM('ACTIVE', 'INACTIVE', 'UNVERIFIED', 'NOT_CAPTURED');--> statement-breakpoint
CREATE TYPE "public"."checkout_type" AS ENUM('EXTERNAL_CHECKOUT');--> statement-breakpoint
CREATE TYPE "public"."coach_role" AS ENUM('LEAD', 'ASSISTANT');--> statement-breakpoint
CREATE TYPE "public"."data_quality_issue_status" AS ENUM('OPEN', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."data_quality_issue_type" AS ENUM('CONFLICTING', 'UNVERIFIED', 'MISSING', 'OUTDATED', 'AMBIGUOUS');--> statement-breakpoint
CREATE TYPE "public"."delivery_mode" AS ENUM('ONLINE_LIVE', 'IN_PERSON', 'HYBRID');--> statement-breakpoint
CREATE TYPE "public"."discipline" AS ENUM('BALLET');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('OPEN', 'CLOSED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('BEGINNER', 'RECREATIONAL', 'ADVANCED', 'PROFESSIONAL');--> statement-breakpoint
CREATE TYPE "public"."payment_schedule" AS ENUM('UNKNOWN', 'ONE_TIME', 'INSTALLMENTS', 'RECURRING');--> statement-breakpoint
CREATE TYPE "public"."pricing_basis" AS ENUM('PACKAGE_TOTAL', 'PER_PERIOD', 'PER_CLASS');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('GROUP_PROGRAM', 'PRIVATE_LESSON', 'SUBSCRIPTION');--> statement-breakpoint
CREATE TYPE "public"."recurrence_frequency" AS ENUM('WEEKLY');--> statement-breakpoint
CREATE TYPE "public"."requirement_category" AS ENUM('EQUIPMENT', 'PARTICIPATION', 'TECHNICAL');--> statement-breakpoint
CREATE TYPE "public"."schedule_exception_type" AS ENUM('CANCELLED', 'RESCHEDULED', 'ADDITIONAL');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('LANDING_PAGE', 'ASSIGNMENT_BRIEF', 'BUSINESS_APPROVED_CONFIG', 'PROTOTYPE_CONFIG', 'DERIVED');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('CONFIRMED', 'UNCONFIRMED', 'CONFLICTING', 'UNKNOWN');--> statement-breakpoint
CREATE TABLE "business_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"alias_key" text NOT NULL,
	"source_type" "source_type",
	"source_ref" text,
	"verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "business_aliases_alias_key_unique" UNIQUE("alias_key")
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"canonical_name" text NOT NULL,
	"canonical_name_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "businesses_canonical_name_key_unique" UNIQUE("canonical_name_key")
);
--> statement-breakpoint
CREATE TABLE "coaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_policies" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"entitlement_duration_months" integer,
	"duration_source_type" "source_type",
	"duration_source_ref" text,
	"duration_verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"duration_verified_at" timestamp with time zone,
	"start_rule" "access_start_rule" DEFAULT 'UNKNOWN' NOT NULL,
	"start_rule_source_type" "source_type",
	"start_rule_source_ref" text,
	"start_rule_verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"start_rule_verified_at" timestamp with time zone,
	"end_rule" "access_end_rule" DEFAULT 'UNKNOWN' NOT NULL,
	"end_rule_source_type" "source_type",
	"end_rule_source_ref" text,
	"end_rule_verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"end_rule_verified_at" timestamp with time zone,
	CONSTRAINT "access_policies_duration_positive" CHECK ("access_policies"."entitlement_duration_months" IS NULL OR "access_policies"."entitlement_duration_months" > 0)
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount_minor" integer,
	"currency" char(3),
	"pricing_basis" "pricing_basis" NOT NULL,
	"payment_schedule" "payment_schedule" DEFAULT 'UNKNOWN' NOT NULL,
	"payment_terms" text,
	"source_type" "source_type",
	"source_ref" text,
	"verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_amount_non_negative" CHECK ("offers"."amount_minor" IS NULL OR "offers"."amount_minor" >= 0),
	CONSTRAINT "offers_amount_currency_together" CHECK (("offers"."amount_minor" IS NULL) = ("offers"."currency" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "product_audience_levels" (
	"product_id" uuid NOT NULL,
	"level" "experience_level" NOT NULL,
	"source_type" "source_type",
	"source_ref" text,
	"verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "product_audience_levels_product_id_level_pk" PRIMARY KEY("product_id","level")
);
--> statement-breakpoint
CREATE TABLE "product_coaches" (
	"product_id" uuid NOT NULL,
	"coach_id" uuid NOT NULL,
	"role" "coach_role" NOT NULL,
	"source_type" "source_type",
	"source_ref" text,
	"verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "product_coaches_product_id_coach_id_pk" PRIMARY KEY("product_id","coach_id")
);
--> statement-breakpoint
CREATE TABLE "product_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"category" "requirement_category" NOT NULL,
	"description" text NOT NULL,
	"source_type" "source_type",
	"source_ref" text,
	"verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"product_type" "product_type" NOT NULL,
	"delivery_mode" "delivery_mode" NOT NULL,
	"discipline" "discipline" NOT NULL,
	"description" text,
	"status" "product_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"duration_months" integer NOT NULL,
	"included_class_count" integer NOT NULL,
	"class_duration_minutes" integer NOT NULL,
	"source_type" "source_type",
	"source_ref" text,
	"verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "programs_positive_values" CHECK ("programs"."duration_months" > 0 AND "programs"."included_class_count" > 0 AND "programs"."class_duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"type" "schedule_exception_type" NOT NULL,
	"original_date" date,
	"replacement_date" date,
	"replacement_start_time" time,
	"reason" text,
	"source_type" "source_type",
	"source_ref" text,
	"verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "schedule_exceptions_shape" CHECK (("schedule_exceptions"."type" = 'CANCELLED' AND "schedule_exceptions"."original_date" IS NOT NULL AND "schedule_exceptions"."replacement_date" IS NULL)
       OR ("schedule_exceptions"."type" = 'RESCHEDULED' AND "schedule_exceptions"."original_date" IS NOT NULL AND "schedule_exceptions"."replacement_date" IS NOT NULL AND "schedule_exceptions"."replacement_start_time" IS NOT NULL)
       OR ("schedule_exceptions"."type" = 'ADDITIONAL' AND "schedule_exceptions"."original_date" IS NULL AND "schedule_exceptions"."replacement_date" IS NOT NULL AND "schedule_exceptions"."replacement_start_time" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"frequency" "recurrence_frequency" NOT NULL,
	"iso_weekday" smallint NOT NULL,
	"local_start_time" time,
	"duration_minutes" integer NOT NULL,
	"timezone" text,
	"tz_source_type" "source_type",
	"tz_source_ref" text,
	"tz_verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"tz_verified_at" timestamp with time zone,
	"published_time_labels" text[] DEFAULT '{}'::text[] NOT NULL,
	"exceptions_confirmed_through" date,
	"exceptions_source_type" "source_type",
	"exceptions_source_ref" text,
	"exceptions_verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"exceptions_verified_at" timestamp with time zone,
	"source_type" "source_type",
	"source_ref" text,
	"verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_product_id_unique" UNIQUE("product_id"),
	CONSTRAINT "schedules_iso_weekday_range" CHECK ("schedules"."iso_weekday" BETWEEN 1 AND 7),
	CONSTRAINT "schedules_duration_positive" CHECK ("schedules"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "checkout_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"offer_id" uuid,
	"checkout_type" "checkout_type" NOT NULL,
	"external_url" text,
	"status" "checkout_status" NOT NULL,
	"system_of_record" text NOT NULL,
	"source_type" "source_type",
	"source_ref" text,
	"verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_active_requires_url" CHECK ("checkout_actions"."status" <> 'ACTIVE' OR "checkout_actions"."external_url" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "data_quality_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid,
	"field_path" text NOT NULL,
	"raw_claim" text,
	"claim_source_type" "source_type",
	"claim_source_ref" text,
	"captured_at" timestamp with time zone,
	"issue_type" "data_quality_issue_type" NOT NULL,
	"explanation" text NOT NULL,
	"status" "data_quality_issue_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "enrollment_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"status" "enrollment_status" NOT NULL,
	"effective_from" date,
	"effective_until" date,
	"notes" text,
	"source_type" "source_type",
	"source_ref" text,
	"verification_status" "verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_window_order" CHECK ("enrollment_availability"."effective_from" IS NULL OR "enrollment_availability"."effective_until" IS NULL OR "enrollment_availability"."effective_until" >= "enrollment_availability"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "business_aliases" ADD CONSTRAINT "business_aliases_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_audience_levels" ADD CONSTRAINT "product_audience_levels_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_coaches" ADD CONSTRAINT "product_coaches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_coaches" ADD CONSTRAINT "product_coaches_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_requirements" ADD CONSTRAINT "product_requirements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD CONSTRAINT "checkout_actions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD CONSTRAINT "checkout_actions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_issues" ADD CONSTRAINT "data_quality_issues_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_issues" ADD CONSTRAINT "data_quality_issues_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_availability" ADD CONSTRAINT "enrollment_availability_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;