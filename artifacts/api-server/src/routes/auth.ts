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
  RegisterClientBody,
  StartPractitionerSignupBody,
  SwitchRoleBody,
  UpdateClientProfileBody,
  UpdatePractitionerSignupProgressBody,
  type ClientProfile,
  type CurrentUser,
  type PractitionerSignupDraft,
  type PractitionerSignupState,
} from "@workspace/api-zod";
import { isValidTimeZone, safeZone } from "@workspace/scheduling";
import { requireAuth, setActiveRole } from "../lib/auth";
import { badRequest, conflict, handler } from "../lib/errors";
import { loadSignupProgress, toCurrentUser } from "../lib/current-user";
import { DEFAULT_CURRENCY } from "../lib/config";

/**
 * Identity (sign-up, sign-in, passwords, email verification, sign-out) is
 * handled by Clerk on the device. These endpoints only deal with what the
 * marketplace layers on top: which roles an account holds, the practitioner
 * onboarding wizard, and the client profile.
 */
const router: IRouter = Router();

function assertTimezone(timezone: string): string {
  if (!isValidTimeZone(timezone)) {
    throw badRequest(`"${timezone}" is not a time zone we recognise.`);
  }
  return timezone;
}

async function currentUser(user: User): Promise<CurrentUser> {
  const progress = user.isPractitioner ? await loadSignupProgress(user.id) : null;
  const role = user.activeRole === "practitioner" ? "practitioner" : "client";
  return toCurrentUser(user, role, progress);
}

function toSignupState(
  user: User,
  progress: PractitionerSignupProgress | null,
): PractitionerSignupState {
  return {
    email: user.email,
    currentStep: progress?.currentStep ?? "account",
    completed: Boolean(progress?.completedAt),
    draft: (progress?.draft ?? {}) as PractitionerSignupDraft,
  };
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

router.get(
  "/auth/me",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    res.json(await currentUser(auth.user));
  }),
);

/**
 * Turns a freshly signed-up Clerk account into a client. Idempotent: calling
 * it again simply refreshes the details and switches to the client portal.
 */
router.post(
  "/auth/register",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const body = RegisterClientBody.parse(req.body);
    assertTimezone(body.timezone);

    const [updated] = await db
      .update(usersTable)
      .set({
        fullName: body.fullName?.trim() || auth.user.fullName,
        timezone: body.timezone,
        country: body.country ?? auth.user.country,
        phone: body.phone ?? auth.user.phone,
        isClient: true,
        activeRole: "client",
      })
      .where(eq(usersTable.id, auth.user.id))
      .returning();

    await db
      .insert(clientProfilesTable)
      .values({ userId: auth.user.id, onboardedAt: new Date() })
      .onConflictDoNothing();

    res.status(201).json(await currentUser(updated ?? auth.user));
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

    user = await setActiveRole(user.id, body.role);
    res.json(await currentUser(user));
  }),
);

// ---------------------------------------------------------------------------
// Practitioner onboarding
// ---------------------------------------------------------------------------

router.post(
  "/auth/practitioner/start",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const body = StartPractitionerSignupBody.parse(req.body);
    assertTimezone(body.timezone);

    const progress = await loadSignupProgress(auth.user.id);
    if (auth.user.isPractitioner && progress?.completedAt) {
      throw conflict("Your practice is already set up.", "already_practitioner");
    }

    const [user] = await db
      .update(usersTable)
      .set({
        fullName: body.fullName?.trim() || auth.user.fullName,
        country: body.country,
        phone: body.phone,
        timezone: body.timezone,
        isPractitioner: true,
        activeRole: "practitioner",
      })
      .where(eq(usersTable.id, auth.user.id))
      .returning();

    if (!user) throw badRequest("We could not start that signup.");

    await db
      .insert(practitionerProfilesTable)
      .values({
        userId: user.id,
        timezone: body.timezone,
        currency: DEFAULT_CURRENCY,
      })
      .onConflictDoNothing();

    const [nextProgress] = await db
      .insert(practitionerSignupProgressTable)
      .values({ userId: user.id, currentStep: "modality", draft: {} })
      .onConflictDoNothing()
      .returning();

    res
      .status(201)
      .json(toSignupState(user, nextProgress ?? progress ?? null));
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
