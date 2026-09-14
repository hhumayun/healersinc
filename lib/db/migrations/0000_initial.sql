CREATE TYPE "public"."appointment_format" AS ENUM('online', 'phone', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled', 'declined');--> statement-breakpoint
CREATE TYPE "public"."availability_exception_kind" AS ENUM('block', 'vacation', 'extra');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('mind', 'body', 'spirit', 'psychology');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_requested', 'booking_confirmed', 'booking_declined', 'booking_cancelled', 'booking_rescheduled', 'booking_completed', 'booking_reminder', 'message_received', 'review_received');--> statement-breakpoint
CREATE TYPE "public"."payment_account_status" AS ENUM('pending', 'restricted', 'enabled', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('checkout_pending', 'processing', 'paid', 'partially_refunded', 'refunded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reminder_kind" AS ENUM('24h', '1h');--> statement-breakpoint
CREATE TYPE "public"."signup_step" AS ENUM('account', 'modality', 'headline', 'bio', 'details', 'complete');--> statement-breakpoint
CREATE TABLE "practitioner_signup_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_step" "signup_step" DEFAULT 'account' NOT NULL,
	"draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"country" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"avatar_url" text,
	"is_client" boolean DEFAULT false NOT NULL,
	"is_practitioner" boolean DEFAULT false NOT NULL,
	"active_role" text DEFAULT 'client' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"location" text,
	"notes" text,
	"onboarded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practitioner_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"modality" "modality",
	"headline" text,
	"bio" text,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"hourly_rate_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"location" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"min_notice_minutes" integer DEFAULT 120 NOT NULL,
	"max_advance_days" integer DEFAULT 60 NOT NULL,
	"instant_booking" boolean DEFAULT true NOT NULL,
	"cancellation_notice_hours" integer DEFAULT 24 NOT NULL,
	"rating_average" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"format" "appointment_format" DEFAULT 'online' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"kind" "availability_exception_kind" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_minute" integer,
	"end_minute" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"actor_id" uuid,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"kind" "reminder_kind" NOT NULL,
	"send_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"service_id" uuid,
	"service_name" text NOT NULL,
	"service_duration_minutes" integer NOT NULL,
	"service_price_cents" integer NOT NULL,
	"service_currency" text NOT NULL,
	"service_format" "appointment_format" DEFAULT 'online' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"block_starts_at" timestamp with time zone NOT NULL,
	"block_ends_at" timestamp with time zone NOT NULL,
	"client_timezone" text NOT NULL,
	"practitioner_timezone" text NOT NULL,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"client_notes" text,
	"cancellation_reason" text,
	"cancelled_by_id" uuid,
	"cancelled_late" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_checkout_attempt" integer DEFAULT 0 NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"idempotency_key" text NOT NULL,
	"gross_amount_cents" integer NOT NULL,
	"platform_fee_basis_points" integer NOT NULL,
	"platform_fee_cents" integer NOT NULL,
	"practitioner_net_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_status" DEFAULT 'checkout_pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practitioner_payment_accounts" (
	"practitioner_id" uuid PRIMARY KEY NOT NULL,
	"stripe_account_id" text NOT NULL,
	"account_api_version" text DEFAULT 'v1' NOT NULL,
	"country" text NOT NULL,
	"status" "payment_account_status" DEFAULT 'pending' NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"stripe_refund_id" text,
	"idempotency_key" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"requested_by_id" uuid,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_reconciliation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"livemode" boolean NOT NULL,
	"payment_id" uuid,
	"refund_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone,
	"last_message_preview" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practitioner_signup_progress" ADD CONSTRAINT "practitioner_signup_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_profiles" ADD CONSTRAINT "practitioner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_practitioner_id_users_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_practitioner_id_users_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_practitioner_id_users_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_practitioner_id_users_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_payment_accounts" ADD CONSTRAINT "practitioner_payment_accounts_practitioner_id_users_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_reconciliation_events" ADD CONSTRAINT "stripe_reconciliation_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_reconciliation_events" ADD CONSTRAINT "stripe_reconciliation_events_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_practitioner_id_users_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_id_users_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_practitioner_id_users_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_unique" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "practitioner_profiles_modality_idx" ON "practitioner_profiles" USING btree ("modality");--> statement-breakpoint
CREATE INDEX "practitioner_profiles_published_idx" ON "practitioner_profiles" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "services_practitioner_idx" ON "services" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX "availability_exceptions_practitioner_idx" ON "availability_exceptions" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX "availability_exceptions_range_idx" ON "availability_exceptions" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "availability_rules_practitioner_idx" ON "availability_rules" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX "appointment_events_appointment_idx" ON "appointment_events" USING btree ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_reminders_unique" ON "appointment_reminders" USING btree ("appointment_id","kind");--> statement-breakpoint
CREATE INDEX "appointment_reminders_due_idx" ON "appointment_reminders" USING btree ("send_at","sent_at");--> statement-breakpoint
CREATE INDEX "appointments_practitioner_idx" ON "appointments" USING btree ("practitioner_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_client_idx" ON "appointments" USING btree ("client_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_idempotency_key_unique" ON "appointments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_appointment_unique" ON "payments" USING btree ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_key_unique" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_checkout_session_unique" ON "payments" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_payment_intent_unique" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_charge_unique" ON "payments" USING btree ("stripe_charge_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "practitioner_payment_accounts_stripe_account_unique" ON "practitioner_payment_accounts" USING btree ("stripe_account_id");--> statement-breakpoint
CREATE INDEX "practitioner_payment_accounts_status_idx" ON "practitioner_payment_accounts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_stripe_refund_unique" ON "refunds" USING btree ("stripe_refund_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_idempotency_key_unique" ON "refunds" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_reconciliation_events_provider_event_unique" ON "stripe_reconciliation_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "stripe_reconciliation_events_payment_idx" ON "stripe_reconciliation_events" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "stripe_reconciliation_events_refund_idx" ON "stripe_reconciliation_events" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "stripe_reconciliation_events_processed_idx" ON "stripe_reconciliation_events" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_pair_unique" ON "conversations" USING btree ("client_id","practitioner_id");--> statement-breakpoint
CREATE INDEX "conversations_client_idx" ON "conversations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "conversations_practitioner_idx" ON "conversations" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_blocks_unique" ON "user_blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "user_reports_reported_idx" ON "user_reports" USING btree ("reported_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_appointment_unique" ON "reviews" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "reviews_practitioner_idx" ON "reviews" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");