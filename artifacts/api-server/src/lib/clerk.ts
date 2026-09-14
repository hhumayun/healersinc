import { createClerkClient, verifyToken } from "@clerk/backend";
import { logger } from "./logger";

/**
 * Clerk owns identity: sign-up, passwords, email verification, sessions and
 * sign-out all happen there. The API only ever sees a short-lived session JWT
 * and maps it to a local `users` row.
 */
const secretKey = process.env["CLERK_SECRET_KEY"]?.trim();
const publishableKey = process.env["CLERK_PUBLISHABLE_KEY"]?.trim();
/** Optional PEM public key; makes verification networkless. */
const jwtKey = process.env["CLERK_JWT_KEY"]?.trim();

if (!secretKey) {
  throw new Error("CLERK_SECRET_KEY is required.");
}

export const clerkClient = createClerkClient({ secretKey, publishableKey });

export const clerkWebhookSigningSecret =
  process.env["CLERK_WEBHOOK_SIGNING_SECRET"]?.trim() ?? null;

/** Returns the Clerk user id the token belongs to, or null if it is invalid. */
export async function verifyClerkSessionToken(
  token: string,
): Promise<string | null> {
  try {
    // `verifyToken` throws on an expired or forged token.
    const payload = (await verifyToken(token, { secretKey, jwtKey })) as {
      sub?: string;
    };
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch (err) {
    logger.debug({ err }, "Rejected Clerk token");
    return null;
  }
}

export interface ClerkProfile {
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

/** The subset of a Clerk user this app mirrors into its own `users` row. */
export async function fetchClerkProfile(clerkUserId: string): Promise<ClerkProfile> {
  const user = await clerkClient.users.getUser(clerkUserId);
  return clerkUserToProfile(user);
}

export function clerkUserToProfile(user: {
  id: string;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
  primaryEmailAddressId: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  hasImage?: boolean;
}): ClerkProfile {
  const primary =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
    user.emailAddresses[0];
  if (!primary) {
    throw new Error(`Clerk user ${user.id} has no email address.`);
  }
  const fullName = [user.firstName, user.lastName]
    .filter((part) => part && part.trim())
    .join(" ")
    .trim();
  return {
    email: primary.emailAddress.trim().toLowerCase(),
    fullName: fullName || primary.emailAddress.split("@")[0] || "New member",
    avatarUrl: user.hasImage === false ? null : user.imageUrl || null,
  };
}
