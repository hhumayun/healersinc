import { Router, type IRouter } from "express";
import { and, count, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import {
  appointmentsTable,
  availabilityExceptionsTable,
  availabilityRulesTable,
  conversationsTable,
  db,
  messagesTable,
  paymentsTable,
  practitionerProfilesTable,
  reviewsTable,
  servicesTable,
  usersTable,
  type PractitionerProfile,
  type User,
} from "@workspace/db";
import {
  CreateAvailabilityExceptionBody,
  CreateServiceBody,
  GetPractitionerCalendarQueryParams,
  UpdateBookingPolicyBody,
  UpdateMyAvailabilityBody,
  UpdateMyPractitionerProfileBody,
  UpdateServiceBody,
  type AvailabilityException,
  type AvailabilitySchedule,
  type BookingPolicy,
  type CalendarDay,
  type CalendarResponse,
  type DashboardSummary,
  type PractitionerProfile as PractitionerProfileDto,
  ListPractitionerPaymentsResponse,
  CreatePractitionerPaymentOnboardingLinkResponse,
} from "@workspace/api-zod";
import { isValidTimeZone, safeZone } from "@workspace/scheduling";
import { requireRole } from "../lib/auth";
import { badRequest, conflict, handler, notFound } from "../lib/errors";
import { requireCalendarRange } from "../lib/query";
import { toAppointment, toAvailabilityException, toService } from "../lib/serializers";
import { getUncachableStripeClient } from "../stripeClient";
import {
  loadPaymentAccount,
  persistStripeV2Account,
  publicAccountStatus,
  refreshStripePaymentAccount,
  toPaymentSummary,
} from "../lib/payments";
import {
  v2RecipientAccountCreateParams,
  v2RecipientAccountLinkParams,
} from "../lib/stripeAccountState";
import {
  countryIsEligible,
  normalizeCountry,
  paymentPolicy,
} from "../lib/paymentPolicy";

const router: IRouter = Router();

function assertTimezone(timezone: string): string {
  if (!isValidTimeZone(timezone)) {
    throw badRequest(`"${timezone}" is not a time zone we recognise.`);
  }
  return timezone;
}

function isStripeConnectNotConfigured(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { type?: unknown; message?: unknown };
  return (
    candidate.type === "StripeInvalidRequestError" &&
    typeof candidate.message === "string" &&
    candidate.message.includes("signed up for Connect")
  );
}

async function loadProfile(userId: string): Promise<PractitionerProfile> {
  const [profile] = await db
    .select()
    .from(practitionerProfilesTable)
    .where(eq(practitionerProfilesTable.userId, userId))
    .limit(1);

  if (!profile) throw notFound("Your practitioner profile is not set up yet.");
  return profile;
}

function toBookingPolicy(profile: PractitionerProfile): BookingPolicy {
  return {
    bufferBeforeMinutes: profile.bufferBeforeMinutes,
    bufferAfterMinutes: profile.bufferAfterMinutes,
    minNoticeMinutes: profile.minNoticeMinutes,
    maxAdvanceDays: profile.maxAdvanceDays,
    instantBooking: profile.instantBooking,
    cancellationNoticeHours: profile.cancellationNoticeHours,
  };
}

function toSelfProfile(
  user: User,
  profile: PractitionerProfile,
): PractitionerProfileDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    country: user.country,
    avatarUrl: user.avatarUrl,
    modality: profile.modality ?? undefined,
    headline: profile.headline,
    bio: profile.bio,
    photos: profile.photos,
    languages: profile.languages,
    tags: profile.tags,
    hourlyRateCents: profile.hourlyRateCents,
    currency: profile.currency,
    location: profile.location,
    timezone: profile.timezone,
    isPublished: profile.isPublished,
    ratingAverage: profile.ratingAverage ? Number(profile.ratingAverage) : null,
    ratingCount: profile.ratingCount,
    policy: toBookingPolicy(profile),
  };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

router.get(
  "/practitioner/profile",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    res.json(toSelfProfile(auth.user, await loadProfile(auth.user.id)));
  }),
);

router.put(
  "/practitioner/profile",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const body = UpdateMyPractitionerProfileBody.parse(req.body);
    assertTimezone(body.timezone);

    const [user] = await db
      .update(usersTable)
      .set({
        fullName: body.fullName.trim(),
        phone: body.phone ?? null,
        country: body.country ?? null,
        avatarUrl: body.avatarUrl ?? null,
        timezone: body.timezone,
      })
      .where(eq(usersTable.id, auth.user.id))
      .returning();

    const current = await loadProfile(auth.user.id);

    const [profile] = await db
      .update(practitionerProfilesTable)
      .set({
        headline: body.headline ?? null,
        bio: body.bio ?? null,
        photos: body.photos ?? current.photos,
        languages: body.languages ?? current.languages,
        tags: body.tags ?? current.tags,
        hourlyRateCents: body.hourlyRateCents ?? null,
        currency: body.currency ?? current.currency,
        location: body.location ?? null,
        timezone: body.timezone,
        modality: body.modality ?? current.modality,
        isPublished: body.isPublished ?? current.isPublished,
      })
      .where(eq(practitionerProfilesTable.userId, auth.user.id))
      .returning();

    res.json(toSelfProfile(user ?? auth.user, profile ?? current));
  }),
);

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

router.get(
  "/practitioner/services",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");

    const rows = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.practitionerId, auth.user.id))
      .orderBy(servicesTable.createdAt);

    res.json(rows.map(toService));
  }),
);

router.post(
  "/practitioner/services",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const body = CreateServiceBody.parse(req.body);

    const [service] = await db
      .insert(servicesTable)
      .values({ practitionerId: auth.user.id, ...body })
      .returning();

    if (!service) throw badRequest("We could not add that service.");
    res.status(201).json(toService(service));
  }),
);

router.put(
  "/practitioner/services/:serviceId",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const body = UpdateServiceBody.parse(req.body);

    const [service] = await db
      .update(servicesTable)
      .set(body)
      .where(
        and(
          eq(servicesTable.id, req.params["serviceId"] as string),
          eq(servicesTable.practitionerId, auth.user.id),
        ),
      )
      .returning();

    if (!service) throw notFound("We could not find that service.");
    res.json(toService(service));
  }),
);

router.delete(
  "/practitioner/services/:serviceId",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const serviceId = req.params["serviceId"] as string;

    // Retire rather than delete: past appointments keep their price and name
    // snapshots, but the service must stop appearing in search and booking.
    const [service] = await db
      .update(servicesTable)
      .set({ isActive: false })
      .where(
        and(
          eq(servicesTable.id, serviceId),
          eq(servicesTable.practitionerId, auth.user.id),
        ),
      )
      .returning();

    if (!service) throw notFound("We could not find that service.");
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

router.get(
  "/practitioner/availability",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const profile = await loadProfile(auth.user.id);

    const rules = await db
      .select()
      .from(availabilityRulesTable)
      .where(eq(availabilityRulesTable.practitionerId, auth.user.id))
      .orderBy(availabilityRulesTable.weekday, availabilityRulesTable.startMinute);

    const availability: AvailabilitySchedule = {
      timezone: profile.timezone,
      rules: rules.map((rule) => ({
        weekday: rule.weekday,
        startMinute: rule.startMinute,
        endMinute: rule.endMinute,
      })),
    };

    res.json(availability);
  }),
);

router.put(
  "/practitioner/availability",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const body = UpdateMyAvailabilityBody.parse(req.body);
    assertTimezone(body.timezone);

    for (const rule of body.rules) {
      if (rule.endMinute <= rule.startMinute) {
        throw badRequest(
          "Each availability window has to end after it starts.",
        );
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(practitionerProfilesTable)
        .set({ timezone: body.timezone })
        .where(eq(practitionerProfilesTable.userId, auth.user.id));

      await tx
        .delete(availabilityRulesTable)
        .where(eq(availabilityRulesTable.practitionerId, auth.user.id));

      if (body.rules.length > 0) {
        await tx.insert(availabilityRulesTable).values(
          body.rules.map((rule) => ({
            practitionerId: auth.user.id,
            weekday: rule.weekday,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute,
          })),
        );
      }
    });

    const availability: AvailabilitySchedule = {
      timezone: body.timezone,
      rules: body.rules,
    };
    res.json(availability);
  }),
);

router.get(
  "/practitioner/exceptions",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");

    const rows = await db
      .select()
      .from(availabilityExceptionsTable)
      .where(eq(availabilityExceptionsTable.practitionerId, auth.user.id))
      .orderBy(availabilityExceptionsTable.startDate);

    res.json(rows.map(toAvailabilityException));
  }),
);

router.post(
  "/practitioner/exceptions",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const body = CreateAvailabilityExceptionBody.parse(req.body);

    if (body.endDate < body.startDate) {
      throw badRequest("The last day has to be on or after the first day.");
    }

    const hasStart = body.startMinute !== null && body.startMinute !== undefined;
    const hasEnd = body.endMinute !== null && body.endMinute !== undefined;
    if (hasStart !== hasEnd) {
      throw badRequest("Give both a start and an end time, or neither.");
    }
    if (hasStart && hasEnd && body.endMinute! <= body.startMinute!) {
      throw badRequest("The end time has to be after the start time.");
    }

    const [exception] = await db
      .insert(availabilityExceptionsTable)
      .values({
        practitionerId: auth.user.id,
        kind: body.kind,
        startDate: body.startDate,
        endDate: body.endDate,
        startMinute: body.startMinute ?? null,
        endMinute: body.endMinute ?? null,
        note: body.note ?? null,
      })
      .returning();

    if (!exception) throw badRequest("We could not save that change.");

    const dto: AvailabilityException = toAvailabilityException(exception);
    res.status(201).json(dto);
  }),
);

router.delete(
  "/practitioner/exceptions/:exceptionId",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");

    const deleted = await db
      .delete(availabilityExceptionsTable)
      .where(
        and(
          eq(availabilityExceptionsTable.id, req.params["exceptionId"] as string),
          eq(availabilityExceptionsTable.practitionerId, auth.user.id),
        ),
      )
      .returning({ id: availabilityExceptionsTable.id });

    if (deleted.length === 0) throw notFound("We could not find that change.");
    res.status(204).end();
  }),
);

router.put(
  "/practitioner/booking-policy",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const body = UpdateBookingPolicyBody.parse(req.body);

    const [profile] = await db
      .update(practitionerProfilesTable)
      .set(body)
      .where(eq(practitionerProfilesTable.userId, auth.user.id))
      .returning();

    if (!profile) throw notFound("Your practitioner profile is not set up yet.");
    res.json(toBookingPolicy(profile));
  }),
);

// ---------------------------------------------------------------------------
// Dashboard and calendar
// ---------------------------------------------------------------------------

/** A rough "how finished is your profile" score for the home screen nudge. */
function profileCompletion(
  profile: PractitionerProfile,
  serviceCount: number,
  ruleCount: number,
): number {
  const checks = [
    Boolean(profile.modality),
    Boolean(profile.headline),
    Boolean(profile.bio && profile.bio.length >= 60),
    profile.photos.length > 0,
    profile.languages.length > 0,
    Boolean(profile.hourlyRateCents),
    serviceCount > 0,
    ruleCount > 0,
  ];

  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

router.get(
  "/practitioner/payments",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    let account = await loadPaymentAccount(auth.user.id);
    if (paymentPolicy.enabled && account) {
      const stripe = await getUncachableStripeClient();
      account = await refreshStripePaymentAccount(auth.user.id, account, stripe);
    }
    const accountStatus = publicAccountStatus(
      account?.country ?? auth.user.country,
      account,
    );
    const rows = await db
      .select({ payment: paymentsTable })
      .from(paymentsTable)
      .innerJoin(
        appointmentsTable,
        eq(appointmentsTable.id, paymentsTable.appointmentId),
      )
      .where(eq(appointmentsTable.practitionerId, auth.user.id))
      .orderBy(sql`${paymentsTable.createdAt} desc`);
    res.json(
      ListPractitionerPaymentsResponse.parse({
        accountStatus: accountStatus.status,
        message: accountStatus.message,
        country: normalizeCountry(auth.user.country),
        payments: rows.map(({ payment }) => toPaymentSummary(payment)),
      }),
    );
  }),
);

router.post(
  "/practitioner/payments/onboarding-link",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    if (!paymentPolicy.enabled) throw conflict("In-app payments are currently disabled.");
    const country = normalizeCountry(auth.user.country);
    if (!country || !countryIsEligible(country)) {
      throw conflict("In-app payments are not available in your country yet.");
    }
    const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
    if (!domain) throw new Error("REPLIT_DOMAINS is required for payment onboarding.");
    const stripe = await getUncachableStripeClient();
    const countrySpec = await stripe.countrySpecs.retrieve(country);
    if (!countrySpec.supported_payment_methods.includes("card")) {
      throw conflict("Card payments are unavailable for this country.");
    }
    let account = await loadPaymentAccount(auth.user.id);
    let linkUrl: string;
    let linkExpiresAt: Date;
    try {
      if (!account) {
        const created = await stripe.v2.core.accounts.create(
          v2RecipientAccountCreateParams({
            practitionerId: auth.user.id,
            email: auth.user.email,
            country,
          }),
          { idempotencyKey: `connect-account:${auth.user.id}` },
        );
        account = await persistStripeV2Account(auth.user.id, created);
      } else {
        account = await refreshStripePaymentAccount(auth.user.id, account, stripe);
      }
      const baseUrl = `https://${domain}`;
      if (account.accountApiVersion === "v2") {
        const link = await stripe.v2.core.accountLinks.create(
          v2RecipientAccountLinkParams({
            accountId: account.stripeAccountId,
            returnUrl: `${baseUrl}/api/payments/onboarding/return`,
            refreshUrl: `${baseUrl}/api/payments/onboarding/refresh`,
          }),
        );
        linkUrl = link.url;
        linkExpiresAt = new Date(link.expires_at);
      } else {
        const link = await stripe.accountLinks.create({
          account: account.stripeAccountId,
          type: "account_onboarding",
          return_url: `${baseUrl}/api/payments/onboarding/return`,
          refresh_url: `${baseUrl}/api/payments/onboarding/refresh`,
        });
        linkUrl = link.url;
        linkExpiresAt = new Date(link.expires_at * 1000);
      }
    } catch (error) {
      if (isStripeConnectNotConfigured(error)) {
        throw conflict(
          "Stripe Connect must be activated for this platform before payout setup can begin.",
          "stripe_connect_unavailable",
        );
      }
      throw error;
    }
    res.json(
      CreatePractitionerPaymentOnboardingLinkResponse.parse({
        status: publicAccountStatus(country, account).status,
        url: linkUrl,
        expiresAt: linkExpiresAt,
      }),
    );
  }),
);

router.get(
  "/practitioner/dashboard",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const profile = await loadProfile(auth.user.id);
    const now = new Date();

    const monthStart = DateTime.now()
      .setZone(safeZone(profile.timezone))
      .startOf("month")
      .toJSDate();

    const mine = eq(appointmentsTable.practitionerId, auth.user.id);

    const [[pending], [upcoming], [completed], [earnings], [services], [rules], [unread]] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(appointmentsTable)
          .where(and(mine, eq(appointmentsTable.status, "pending"))),
        db
          .select({ value: count() })
          .from(appointmentsTable)
          .where(
            and(
              mine,
              eq(appointmentsTable.status, "confirmed"),
              gte(appointmentsTable.startsAt, now),
            ),
          ),
        db
          .select({
            value: count(),
            earnings: sql<number>`coalesce(sum(${appointmentsTable.servicePriceCents}), 0)::int`,
          })
          .from(appointmentsTable)
          .where(
            and(
              mine,
              eq(appointmentsTable.status, "completed"),
              gte(appointmentsTable.startsAt, monthStart),
            ),
          ),
        db
          .select({
            earnings: sql<number>`
              coalesce(sum(
                ${paymentsTable.practitionerNetCents} -
                coalesce((
                  select sum(r.amount_cents * (10000 - ${paymentsTable.platformFeeBasisPoints}) / 10000)
                  from refunds r
                  where r.payment_id = ${paymentsTable.id}
                    and r.status = 'succeeded'
                ), 0)
              ), 0)::int
            `,
          })
          .from(paymentsTable)
          .innerJoin(
            appointmentsTable,
            eq(appointmentsTable.id, paymentsTable.appointmentId),
          )
          .where(
            and(
              mine,
              inArray(paymentsTable.status, ["paid", "partially_refunded"]),
              gte(paymentsTable.paidAt, monthStart),
            ),
          ),
        db
          .select({ value: count() })
          .from(servicesTable)
          .where(
            and(
              eq(servicesTable.practitionerId, auth.user.id),
              eq(servicesTable.isActive, true),
            ),
          ),
        db
          .select({ value: count() })
          .from(availabilityRulesTable)
          .where(eq(availabilityRulesTable.practitionerId, auth.user.id)),
        db
          .select({ value: count() })
          .from(messagesTable)
          .innerJoin(
            conversationsTable,
            eq(conversationsTable.id, messagesTable.conversationId),
          )
          .where(
            and(
              eq(conversationsTable.practitionerId, auth.user.id),
              ne(messagesTable.senderId, auth.user.id),
              isNull(messagesTable.readAt),
            ),
          ),
      ]);

    const [next] = await db
      .select({ appointment: appointmentsTable, client: usersTable })
      .from(appointmentsTable)
      .innerJoin(usersTable, eq(usersTable.id, appointmentsTable.clientId))
      .where(
        and(
          mine,
          eq(appointmentsTable.status, "confirmed"),
          gte(appointmentsTable.startsAt, now),
        ),
      )
      .orderBy(appointmentsTable.startsAt)
      .limit(1);

    const summary: DashboardSummary = {
      pendingCount: pending?.value ?? 0,
      upcomingCount: upcoming?.value ?? 0,
      completedThisMonth: completed?.value ?? 0,
      earningsThisMonthCents: Number(
        earnings?.earnings ?? 0,
      ),
      currency: profile.currency,
      ratingAverage: profile.ratingAverage ? Number(profile.ratingAverage) : null,
      ratingCount: profile.ratingCount,
      unreadMessages: unread?.value ?? 0,
      profileCompletion: profileCompletion(
        profile,
        services?.value ?? 0,
        rules?.value ?? 0,
      ),
      isPublished: profile.isPublished,
      nextAppointment: next
        ? toAppointment({
            appointment: next.appointment,
            client: next.client,
            practitioner: auth.user,
            practitionerHeadline: profile.headline,
            viewerId: auth.user.id,
            hasReview: false,
          })
        : null,
    };

    res.json(summary);
  }),
);

router.get(
  "/practitioner/calendar",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const query = GetPractitionerCalendarQueryParams.parse(req.query);
    const range = requireCalendarRange(req.query["from"], req.query["to"]);
    const profile = await loadProfile(auth.user.id);
    const zone = safeZone(profile.timezone);

    const rangeStart = DateTime.fromISO(range.from, { zone })
      .startOf("day")
      .toJSDate();
    const rangeEnd = DateTime.fromISO(range.to, { zone }).endOf("day").toJSDate();

    const rows = await db
      .select({ appointment: appointmentsTable, client: usersTable })
      .from(appointmentsTable)
      .innerJoin(usersTable, eq(usersTable.id, appointmentsTable.clientId))
      .where(
        and(
          eq(appointmentsTable.practitionerId, auth.user.id),
          gte(appointmentsTable.startsAt, rangeStart),
          lte(appointmentsTable.startsAt, rangeEnd),
          inArray(appointmentsTable.status, ["pending", "confirmed", "completed"]),
        ),
      )
      .orderBy(appointmentsTable.startsAt);

    const reviewed = await loadReviewedAppointmentIds(
      rows.map((row) => row.appointment.id),
    );

    const byDate = new Map<string, CalendarDay>();

    // Build every day in the range so the UI can render empty days too.
    let cursor = DateTime.fromISO(query.from, { zone }).startOf("day");
    const last = DateTime.fromISO(query.to, { zone }).startOf("day");
    while (cursor <= last) {
      const date = cursor.toISODate();
      if (date) byDate.set(date, { date, appointments: [] });
      cursor = cursor.plus({ days: 1 });
    }

    for (const row of rows) {
      const date =
        DateTime.fromJSDate(row.appointment.startsAt, { zone }).toISODate() ?? "";
      const day = byDate.get(date) ?? { date, appointments: [] };
      day.appointments.push(
        toAppointment({
          appointment: row.appointment,
          client: row.client,
          practitioner: auth.user,
          practitionerHeadline: profile.headline,
          viewerId: auth.user.id,
          hasReview: reviewed.has(row.appointment.id),
        }),
      );
      byDate.set(date, day);
    }

    const calendar: CalendarResponse = {
      timezone: zone,
      days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };

    res.json(calendar);
  }),
);

export async function loadReviewedAppointmentIds(
  appointmentIds: string[],
): Promise<Set<string>> {
  if (appointmentIds.length === 0) return new Set();

  const rows = await db
    .select({ appointmentId: reviewsTable.appointmentId })
    .from(reviewsTable)
    .where(inArray(reviewsTable.appointmentId, appointmentIds));

  return new Set(rows.map((row) => row.appointmentId));
}

export default router;
