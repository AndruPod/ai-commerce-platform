CREATE TYPE "public"."checkout_provider" AS ENUM('STRIPE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."observed_billing_interval" AS ENUM('ONE_TIME', 'MONTHLY', 'ANNUAL');--> statement-breakpoint
CREATE TYPE "public"."transaction_block_code" AS ENUM('PRICE_CONFLICT', 'PAYMENT_TERMS_CONFLICT');--> statement-breakpoint
ALTER TYPE "public"."source_type" ADD VALUE 'MANUAL_CHECKOUT_VERIFICATION' BEFORE 'DERIVED';--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD COLUMN "provider" "checkout_provider";--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD COLUMN "observed_merchant" text;--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD COLUMN "observed_product_label" text;--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD COLUMN "observed_amount_minor" integer;--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD COLUMN "observed_currency" char(3);--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD COLUMN "observed_billing" "observed_billing_interval";--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD COLUMN "observed_terms_text" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD COLUMN "observed_at" date;--> statement-breakpoint
ALTER TABLE "data_quality_issues" ADD COLUMN "blocking_code" "transaction_block_code";--> statement-breakpoint
ALTER TABLE "checkout_actions" ADD CONSTRAINT "checkout_observed_amount_currency_together" CHECK (("checkout_actions"."observed_amount_minor" IS NULL) = ("checkout_actions"."observed_currency" IS NULL));