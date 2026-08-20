import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  clientProfilesTable,
  db,
  practitionerProfilesTable,
  practitionerSignupProgressTable,
  servicesTable,
  availabilityRulesTable,
  usersTable,
  type PractitionerSignupProgress,
  type User,
} from "@workspace/db";
import {
  LoginBody,
  RegisterClientBody,
  ResendPractitionerOtpBody,
  StartPractitionerSignupBody,
  SwitchRoleBody,
  UpdateClientProfileBody,
  UpdatePractitionerSignupProgressBody,
  VerifyPractitionerEmailBody,
  type AuthSession,
  type ClientProfile,
  type PractitionerSignupDraft,
  type PractitionerSignupState,
} from "@workspace/api-zod";
import { isValidTimeZone, safeZone } from "@workspace/scheduling";
import {
  consumeOtp,
  createSession,
  destroySession,
  hashPassword,
  issueOtp,
  requireAuth,
  setSessionRole,
  verifyPassword,
} from "../lib/auth";
import { badRequest, conflict, handler, notFound, unauthorized } from "../lib/errors";
import { emailProviderConfigured, sendEmail, verificationEmail } from "../lib/email";
import { loadSignupProgress, toCurrentUser } from "../lib/current-user";
import { DEFAULT_CURRENCY } from "../lib/config";

const router: IRouter = Router();

const normaliseEmail = (email: string): string => email.trim().toLowerCase();

function assertTimezone(timezone: string): string {
  if (!isValidTimeZone(timezone)) {
    throw badRequest(`"${timezone}" is not a time zone we recognise.`);
  }
  return timezone;
}

async function findUserByEmail(email: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  return user ?? null;
}

async function issueAuthSession(
  user: User,
  role: "client" | "practitioner",
): Promise<AuthSession> {
  const session = await createSession(user.id, role);
  const progress = user.isPractitioner ? await loadSignupProgress(user.id) : null;

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: toCurrentUser(user, role, progress),
  };
}

function toSignupState(
  user: User,
  progress: PractitionerSignupProgress | null,
  devCode?: string | null,
): PractitionerSignupState {
  return {
    email: user.email,
    currentStep: progress?.currentStep ?? "account",
    completed: Boolean(progress?.completedAt),
    draft: (progress?.draft ?? {}) as PractitionerSignupDraft,
    devCode: devCode ?? null,
  };
}

/** Emails the code, or hands it back in development where there is no mailer. */
async function deliverVerificationCode(email: string): Promise<string | null> {
  const code = await issueOtp(email);
  await sendEmail({ to: email, ...verificationEmail(code) });
  return emailProviderConfigured ? null : code;
}

// ---------------------------------------------------------------------------
// Client accounts
// ---------------------------------------------------------------------------

router.post(
  "/auth/register",
  handler(async (req, res) => {
    const body = RegisterClientBody.parse(req.body);
    const email = normaliseEmail(body.email);
    assertTimezone(body.timezone);

    const existing = await findUserByEmail(email);

    if (existing) {
      const passwordMatches = await verifyPassword(
        body.password,
        existing.passwordHash,
      );
      if (!passwordMatches) {
        throw conflict(
          "An account already exists with this email. Sign in instead.",
          "email_taken",
        );
      }
      if (existing.isClient) {
        throw conflict(
          "You already have a client account. Sign in instead.",
          "email_taken",
        );
      }

      // A practitioner adding the client side of the marketplace.
      const [updated] = await db
        .update(usersTable)
        .set({ isClient: true })
        .where(eq(usersTable.id, existing.id))
        .returning();

      await db
        .insert(clientProfilesTable)
        .values({ userId: existing.id, onboardedAt: new Date() })
        .onConflictDoNothing();

      res.status(201).json(await issueAuthSession(updated ?? existing, "client"));
      return;
    }

    const [user] = await db
      .insert(usersTable)
      .values({
        email,
        passwordHash: await hashPassword(body.password),
        fullName: body.fullName.trim(),
        timezone: body.timezone,
        country: body.country ?? null,
        phone: body.phone ?? null,
        isClient: true,
        emailVerified: true,
      })
      .returning();

    if (!user) throw badRequest("We could not create that account.");

    await db
      .insert(clientProfilesTable)
      .values({ userId: user.id, onboardedAt: new Date() });

    res.status(201).json(await issueAuthSession(user, "client"));
  }),
);

router.post(
  "/auth/login",
  handler(async (req, res) => {
    const body = LoginBody.parse(req.body);
    const email = normaliseEmail(body.email);

    const user = await findUserByEmail(email);
    const passwordMatches = user
      ? await verifyPassword(body.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw unauthorized("That email and password do not match.");
    }

    if (body.role === "practitioner") {
      if (!user.isPractitioner) {
        throw unauthorized(
          "This email is registered as a client. Use the client sign in.",
        );
      }
      if (!user.emailVerified) {
        throw unauthorized(
          "Please verify your email address to finish setting up your practice.",
        );
      }
    }

    if (body.role === "client" && !user.isClient) {
      throw unauthorized(
        "This email is registered as a practitioner. Use the practitioner sign in.",
      );
    }

    res.json(await issueAuthSession(user, body.role));
  }),
);

router.post(
  "/auth/logout",
  handler(async (req, res) => {
    if (req.auth) await destroySession(req.auth.sessionId);
    res.status(204).end();
  }),
);

router.get(
  "/auth/me",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const progress = auth.user.isPractitioner
      ? await loadSignupProgress(auth.user.id)
      : null;

    res.json(toCurrentUser(auth.user, auth.role, progress));
  }),
);

router.post(
  "/auth/switch-role",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const body = SwitchRoleBody.parse(req.body);

    let user = auth.user;

    if (body.role === "practitioner") {
      const progress = await loadSignupProgress(user.id);
      if (!user.isPractitioner || !progress?.completedAt) {
        throw badRequest(
          "Finish setting up your practitioner profile before switching over.",
        );
      }
    } else if (!user.isClient) {
      // Any practitioner may also book sessions as a client.
      const [updated] = await db
        .update(usersTable)
        .set({ isClient: true })
        .where(eq(usersTable.id, user.id))
        .returning();

      await db
        .insert(clientProfilesTable)
        .values({ userId: user.id, onboardedAt: new Date() })
        .onConflictDoNothing();

      if (updated) user = updated;
    }

    await setSessionRole(auth.sessionId, body.role);
    res.json(await issueAuthSession(user, body.role));
  }),
);

// ---------------------------------------------------------------------------
// Practitioner onboarding
// ---------------------------------------------------------------------------

router.post(
  "/auth/practitioner/start",
  handler(async (req, res) => {
    const body = StartPractitionerSignupBody.parse(req.body);
    const email = normaliseEmail(body.email);
    assertTimezone(body.timezone);

    const existing = await findUserByEmail(email);

    if (existing) {
      const passwordMatches = await verifyPassword(
        body.password,
        existing.passwordHash,
      );
      if (!passwordMatches) {
        throw conflict(
          "An account already exists with this email. Sign in instead.",
          "email_taken",
        );
      }

      const progress = await loadSignupProgress(existing.id);
      if (existing.isPractitioner && progress?.completedAt) {
        throw conflict(
          "Your practice is already set up. Sign in instead.",
          "email_taken",
        );
      }

      // Resuming an interrupted signup: reissue the code, keep the draft.
      const devCode = existing.emailVerified
        ? null
        : await deliverVerificationCode(email);

      res.status(201).json(toSignupState(existing, progress, devCode));
      return;
    }

    const [user] = await db
      .insert(usersTable)
      .values({
        email,
        passwordHash: await hashPassword(body.password),
        fullName: body.fullName.trim(),
        country: body.country,
        phone: body.phone,
        timezone: body.timezone,
        isPractitioner: true,
      })
      .returning();

    if (!user) throw badRequest("We could not start that signup.");

    await db.insert(practitionerProfilesTable).values({
      userId: user.id,
      timezone: body.timezone,
      currency: DEFAULT_CURRENCY,
    });

    const [progress] = await db
      .insert(practitionerSignupProgressTable)
      .values({ userId: user.id, currentStep: "verify_email", draft: {} })
      .returning();

    const devCode = await deliverVerificationCode(email);
    res.status(201).json(toSignupState(user, progress ?? null, devCode));
  }),
);

router.post(
  "/auth/practitioner/verify",
  handler(async (req, res) => {
    const body = VerifyPractitionerEmailBody.parse(req.body);
    const email = normaliseEmail(body.email);

    const user = await findUserByEmail(email);
    if (!user) throw notFound("We could not find a signup for that email.");

    await consumeOtp(email, body.code);

    const [verified] = await db
      .update(usersTable)
      .set({ emailVerified: true })
      .where(eq(usersTable.id, user.id))
      .returning();

    const progress = await loadSignupProgress(user.id);
    if (progress && progress.currentStep === "verify_email") {
      await db
        .update(practitionerSignupProgressTable)
        .set({ currentStep: "modality" })
        .where(eq(practitionerSignupProgressTable.userId, user.id));
    }

    res.json(await issueAuthSession(verified ?? user, "practitioner"));
  }),
);

router.post(
  "/auth/practitioner/resend",
  handler(async (req, res) => {
    const body = ResendPractitionerOtpBody.parse(req.body);
    const email = normaliseEmail(body.email);

    const user = await findUserByEmail(email);
    // Do not reveal whether the address exists.
    if (user && !user.emailVerified) {
      await deliverVerificationCode(email);
    }

    res.status(204).end();
  }),
);

router.get(
  "/auth/practitioner/progress",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const progress = await loadSignupProgress(auth.user.id);
    res.json(toSignupState(auth.user, progress));
  }),
);

/**
 * Finishing the wizard turns the draft into a real, bookable practice: the
 * profile is published, a starter service is created from the hourly rate, and
 * a default weekday schedule is written so clients see availability right away.
 */
async function completeOnboarding(
  userId: string,
  draft: PractitionerSignupDraft,
): Promise<void> {
  const timezone = safeZone(draft.timezone);
  const currency = draft.currency ?? DEFAULT_CURRENCY;
  const hourlyRateCents = draft.hourlyRateCents ?? 8000;

  await db
    .update(practitionerProfilesTable)
    .set({
      modality: draft.modality ?? "mind",
      headline: draft.headline ?? null,
      bio: draft.bio ?? null,
      photos: draft.photos ?? [],
      languages: draft.languages ?? [],
      tags: draft.tags ?? [],
      hourlyRateCents,
      currency,
      location: draft.location ?? null,
      timezone,
      isPublished: true,
    })
    .where(eq(practitionerProfilesTable.userId, userId));

  const existingServices = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .where(eq(servicesTable.practitionerId, userId))
    .limit(1);

  if (existingServices.length === 0) {
    await db.insert(servicesTable).values({
      practitionerId: userId,
      name: draft.headline ? `${draft.headline} session` : "60 minute session",
      description:
        "A one-to-one session. You can rename this, change the length or add more options any time.",
      durationMinutes: 60,
      priceCents: hourlyRateCents,
      currency,
      format: "online",
    });
  }

  const existingRules = await db
    .select({ id: availabilityRulesTable.id })
    .from(availabilityRulesTable)
    .where(eq(availabilityRulesTable.practitionerId, userId))
    .limit(1);

  if (existingRules.length === 0) {
    await db.insert(availabilityRulesTable).values(
      [1, 2, 3, 4, 5].map((weekday) => ({
        practitionerId: userId,
        weekday,
        startMinute: 9 * 60,
        endMinute: 17 * 60,
      })),
    );
  }
}

router.patch(
  "/auth/practitioner/progress",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    if (!auth.user.isPractitioner) {
      throw badRequest("This account is not setting up a practice.");
    }

    const body = UpdatePractitionerSignupProgressBody.parse(req.body);
    const current = await loadSignupProgress(auth.user.id);

    const merged: PractitionerSignupDraft = {
      ...((current?.draft ?? {}) as PractitionerSignupDraft),
      ...body.draft,
    };

    if (merged.timezone) assertTimezone(merged.timezone);

    const finishing = body.step === "complete";
    if (finishing) {
      if (!merged.modality) throw badRequest("Choose a modality to continue.");
      if (!merged.headline) throw badRequest("Add a professional title to continue.");
      if (!merged.bio) throw badRequest("Add a short bio to continue.");
      merged.timezone = merged.timezone ?? auth.user.timezone;
    }

    const [progress] = await db
      .insert(practitionerSignupProgressTable)
      .values({
        userId: auth.user.id,
        currentStep: body.step,
        draft: merged,
        completedAt: finishing ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: practitionerSignupProgressTable.userId,
        set: {
          currentStep: body.step,
          draft: merged,
          ...(finishing ? { completedAt: new Date() } : {}),
        },
      })
      .returning();

    if (finishing) {
      await completeOnboarding(auth.user.id, merged);
    }

    res.json(toSignupState(auth.user, progress ?? null));
  }),
);

// ---------------------------------------------------------------------------
// Client profile
// ---------------------------------------------------------------------------

async function readClientProfile(user: User): Promise<ClientProfile> {
  const [profile] = await db
    .select()
    .from(clientProfilesTable)
    .where(eq(clientProfilesTable.userId, user.id))
    .limit(1);

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    country: user.country,
    timezone: user.timezone,
    avatarUrl: user.avatarUrl,
    location: profile?.location ?? null,
    isPractitioner: user.isPractitioner,
  };
}

router.get(
  "/client/profile",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    res.json(await readClientProfile(auth.user));
  }),
);

router.put(
  "/client/profile",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const body = UpdateClientProfileBody.parse(req.body);
    assertTimezone(body.timezone);

    const [user] = await db
      .update(usersTable)
      .set({
        fullName: body.fullName.trim(),
        phone: body.phone ?? null,
        country: body.country ?? null,
        timezone: body.timezone,
        avatarUrl: body.avatarUrl ?? null,
      })
      .where(eq(usersTable.id, auth.user.id))
      .returning();

    await db
      .insert(clientProfilesTable)
      .values({ userId: auth.user.id, location: body.location ?? null })
      .onConflictDoUpdate({
        target: clientProfilesTable.userId,
        set: { location: body.location ?? null },
      });

    res.json(await readClientProfile(user ?? auth.user));
  }),
);

export default router;
