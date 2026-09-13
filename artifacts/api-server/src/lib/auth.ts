import { randomBytes, randomInt, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import {
  db,
  emailOtpsTable,
  sessionsTable,
  usersTable,
  type User,
} from "@workspace/db";
import type { PortalRole } from "@workspace/api-zod";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES, SESSION_TTL_DAYS } from "./config";
import { badRequest, unauthorized } from "./errors";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/** `salt:derivedKey`, both hex. Scrypt keeps this slow enough to be safe. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;

  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(key, "hex");
  if (expected.length !== derived.length) return false;

  return timingSafeEqual(derived, expected);
}

/** Only the hash is stored, so a database leak cannot resurrect a session. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  userId: string,
  role: PortalRole,
): Promise<IssuedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await db.insert(sessionsTable).values({
    userId,
    tokenHash: hashToken(token),
    activeRole: role,
    expiresAt,
  });

  return { token, expiresAt };
}

export interface AuthContext {
  user: User;
  sessionId: string;
  role: PortalRole;
}

export async function resolveSession(
  token: string,
): Promise<AuthContext | null> {
  const rows = await db
    .select({ session: sessionsTable, user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(
      and(
        eq(sessionsTable.tokenHash, hashToken(token)),
        gt(sessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    user: row.user,
    sessionId: row.session.id,
    role: row.session.activeRole as PortalRole,
  };
}

export async function destroySession(sessionId: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
}

export async function setSessionRole(
  sessionId: string,
  role: PortalRole,
): Promise<void> {
  await db
    .update(sessionsTable)
    .set({ activeRole: role })
    .where(eq(sessionsTable.id, sessionId));
}

// ---------------------------------------------------------------------------
// Email verification codes
// ---------------------------------------------------------------------------

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Replaces any outstanding code for the address so only the newest works. */
export async function issueOtp(email: string): Promise<string> {
  const code = generateOtpCode();

  await db
    .update(emailOtpsTable)
    .set({ consumedAt: new Date() })
    .where(
      and(eq(emailOtpsTable.email, email), isNull(emailOtpsTable.consumedAt)),
    );

  await db.insert(emailOtpsTable).values({
    email,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
  });

  return code;
}

/**
 * Consumes the newest unused code for the address. Attempts are counted so a
 * six-digit code cannot be brute-forced.
 */
export async function consumeOtp(email: string, code: string): Promise<void> {
  const rows = await db
    .select()
    .from(emailOtpsTable)
    .where(
      and(eq(emailOtpsTable.email, email), isNull(emailOtpsTable.consumedAt)),
    )
    .orderBy(sql`${emailOtpsTable.createdAt} desc`)
    .limit(1);

  const record = rows[0];
  if (!record) {
    throw badRequest("That code has expired. Send yourself a new one.");
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw badRequest("That code has expired. Send yourself a new one.");
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw badRequest("Too many attempts. Send yourself a new code.");
  }

  if (record.codeHash !== hashToken(code)) {
    await db
      .update(emailOtpsTable)
      .set({ attempts: record.attempts + 1 })
      .where(eq(emailOtpsTable.id, record.id));
    throw badRequest("That code is not right. Check the email and try again.");
  }

  await db
    .update(emailOtpsTable)
    .set({ consumedAt: new Date() })
    .where(eq(emailOtpsTable.id, record.id));
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
 * Authorization is always re-derived from the session on the server; the client
 * never tells us which role it is acting as.
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
