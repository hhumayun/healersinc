import { logger } from "./logger";

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const RESEND_API_KEY = process.env["RESEND_API_KEY"];
const EMAIL_FROM = process.env["EMAIL_FROM"] ?? "Healers Inc <onboarding@resend.dev>";

/**
 * True once a real provider is configured. Until then the app is explicit
 * about it rather than silently swallowing mail: messages are written to the
 * server log, and verification codes are returned to the signup screen so the
 * flow can still be completed in development.
 */
export const emailProviderConfigured = Boolean(RESEND_API_KEY);

async function sendViaResend(email: OutboundEmail): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend rejected the message (${response.status}): ${body}`);
  }
}

export async function sendEmail(email: OutboundEmail): Promise<void> {
  if (!emailProviderConfigured) {
    logger.warn(
      { to: email.to, subject: email.subject, body: email.text },
      "No email provider configured — logging the message instead of sending it",
    );
    return;
  }

  try {
    await sendViaResend(email);
    logger.info({ to: email.to, subject: email.subject }, "Email sent");
  } catch (err) {
    // A failed reminder must not take the scheduler down; surface it loudly.
    logger.error({ err, to: email.to }, "Failed to send email");
    throw err;
  }
}

export function verificationEmail(code: string): Omit<OutboundEmail, "to"> {
  return {
    subject: `${code} is your Healers Inc verification code`,
    text: [
      "Welcome to Healers Inc.",
      "",
      `Your verification code is ${code}.`,
      "",
      "It expires in 10 minutes. If you did not start creating a practitioner account, you can ignore this email.",
    ].join("\n"),
  };
}

export interface ReminderEmailInput {
  recipientName: string;
  counterpartName: string;
  serviceName: string;
  whenLabel: string;
  timezoneLabel: string;
  hoursBefore: 24 | 1;
}

export function reminderEmail(
  input: ReminderEmailInput,
): Omit<OutboundEmail, "to"> {
  const lead = input.hoursBefore === 24 ? "tomorrow" : "in about an hour";

  return {
    subject: `Reminder: ${input.serviceName} with ${input.counterpartName} ${lead}`,
    text: [
      `Hi ${input.recipientName},`,
      "",
      `This is a reminder that your session "${input.serviceName}" with ${input.counterpartName} starts ${lead}.`,
      "",
      `When: ${input.whenLabel} (${input.timezoneLabel})`,
      "",
      "See you there.",
      "— Healers Inc",
    ].join("\n"),
  };
}
