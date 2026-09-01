import { pgEnum } from "drizzle-orm/pg-core";

/** The four healing modalities a practitioner can belong to. */
export const modalityEnum = pgEnum("modality", [
  "mind",
  "body",
  "spirit",
  "psychology",
]);

/** How a session is delivered. */
export const appointmentFormatEnum = pgEnum("appointment_format", [
  "online",
  "phone",
  "in_person",
]);

/** Lifecycle of a booking. */
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "declined",
]);

/** Non-recurring changes to a practitioner's weekly schedule. */
export const availabilityExceptionKindEnum = pgEnum(
  "availability_exception_kind",
  ["block", "vacation", "extra"],
);

/** Steps of the resumable practitioner signup wizard, in order. */
export const signupStepEnum = pgEnum("signup_step", [
  "account",
  "verify_email",
  "modality",
  "headline",
  "bio",
  "details",
  "complete",
]);

/** Categories used to render notification-centre entries. */
export const notificationTypeEnum = pgEnum("notification_type", [
  "booking_requested",
  "booking_confirmed",
  "booking_declined",
  "booking_cancelled",
  "booking_rescheduled",
  "booking_completed",
  "booking_reminder",
  "message_received",
  "review_received",
]);

/** When a reminder fires relative to the appointment start. */
export const reminderKindEnum = pgEnum("reminder_kind", ["24h", "1h"]);

/** Synchronised state of a practitioner's Stripe Connect account. */
export const paymentAccountStatusEnum = pgEnum("payment_account_status", [
  "pending",
  "restricted",
  "enabled",
  "disabled",
]);

/** Lifecycle of an appointment payment. */
export const paymentStatusEnum = pgEnum("payment_status", [
  "checkout_pending",
  "processing",
  "paid",
  "partially_refunded",
  "refunded",
  "failed",
  "cancelled",
]);

/** Lifecycle of a refund requested against a payment. */
export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
]);
