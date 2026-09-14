import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";
import type { PortalRole } from "@workspace/api-zod";
import { fetchClerkProfile, verifyClerkSessionToken } from "./clerk";
import { unauthorized } from "./errors";
import { logger } from "./logger";

export interface AuthContext {
  user: User;
  role: PortalRole;
}

function toRole(value: string): PortalRole {
  return value === "practitioner" ? "practitioner" : "client";
}

export async function findUserByClerkId(clerkUserId: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .limit(1);
  return user ?? null;
}

/**
 * Every Clerk account gets a local row the first time it calls the API. The
 * row starts with no role: the client or practitioner onboarding endpoints
 * grant one. Provisioning here (rather than only via webhook) means a brand
 * new sign-up works even if the webhook is delayed.
 */
export async function ensureLocalUser(clerkUserId: string): Promise<User> {
  const existing = await findUserByClerkId(clerkUserId);
  if (existing) return existing;

  const profile = await fetchClerkProfile(clerkUserId);
  const [created] = await db
    .insert(usersTable)
    .values({
      clerkUserId,
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
    })
    .onConflictDoNothing({ target: usersTable.clerkUserId })
    .returning();

  if (created) {
    logger.info({ userId: created.id, clerkUserId }, "Provisioned local user");
    return created;
  }
  // Lost a race with a concurrent first request; the row exists now.
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .limit(1);
  if (!row) throw new Error("Could not provision the local user.");
  return row;
}

/** Verifies a Clerk session JWT and loads (or provisions) the local account. */
export async function resolveAuth(token: string): Promise<AuthContext | null> {
  const clerkUserId = await verifyClerkSessionToken(token);
  if (!clerkUserId) return null;
  const user = await ensureLocalUser(clerkUserId);
  return { user, role: toRole(user.activeRole) };
}

export async function setActiveRole(userId: string, role: PortalRole): Promise<User> {
  const [updated] = await db
    .update(usersTable)
    .set({ activeRole: role })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) throw new Error("User disappeared while switching role.");
  return updated;
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

export function requireAuth(auth: AuthContext | undefined): AuthContext {
  if (!auth) throw unauthorized();
  return auth;
}

/**
 * Authorization is always re-derived from the account on the server; the
 * client never tells us which role it is acting as.
 */
export function requireRole(
  auth: AuthContext | undefined,
  role: PortalRole,
): AuthContext {
  const context = requireAuth(auth);

  if (role === "practitioner" && !context.user.isPractitioner) {
    throw unauthorized("This area is for practitioners.");
  }
  if (role === "client" && !context.user.isClient) {
    throw unauthorized("This area is for clients.");
  }
  if (context.role !== role) {
    throw unauthorized(
      role === "practitioner"
        ? "Switch to your practitioner account to do that."
        : "Switch to your client account to do that.",
    );
  }

  return context;
}
