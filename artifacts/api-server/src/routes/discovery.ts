import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import {
  appointmentsTable,
  db,
  practitionerProfilesTable,
  reviewsTable,
  servicesTable,
  usersTable,
  type PractitionerProfile,
  type Service,
  type User,
} from "@workspace/db";
import {
  GetPractitionerAvailabilityQueryParams,
  SearchPractitionersQueryParams,
  type BookingPolicy,
  type PractitionerCard,
  type PractitionerPublicProfile,
  type PractitionerSearchPage,
  type Review,
} from "@workspace/api-zod";
import { safeZone } from "@workspace/scheduling";
import { badRequest, handler, notFound } from "../lib/errors";
import { requireCalendarRange } from "../lib/query";
import { toPractitionerCard, toReview, toService } from "../lib/serializers";
import { buildAvailabilityCalendar, findNextAvailable } from "../lib/availability";

const router: IRouter = Router();

/** Cap on how many rows an in-memory sort will consider. */
const SOONEST_SORT_CAP = 100;

function viewerZone(
  requested: string | undefined,
  signedIn: User | undefined,
  fallback: string,
): string {
  return safeZone(requested ?? signedIn?.timezone ?? fallback);
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

async function loadServicesFor(
  practitionerIds: string[],
): Promise<Map<string, Service[]>> {
  if (practitionerIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(servicesTable)
    .where(inArray(servicesTable.practitionerId, practitionerIds));

  const byPractitioner = new Map<string, Service[]>();
  for (const row of rows) {
    const list = byPractitioner.get(row.practitionerId) ?? [];
    list.push(row);
    byPractitioner.set(row.practitionerId, list);
  }
  return byPractitioner;
}

/** Shortest active session is the fairest "can I get in soon?" signal. */
function shortestDuration(services: Service[]): number | null {
  const active = services.filter((service) => service.isActive);
  if (active.length === 0) return null;
  return Math.min(...active.map((service) => service.durationMinutes));
}

async function buildCards(
  rows: { user: User; profile: PractitionerProfile }[],
  viewerTimezone: string,
): Promise<PractitionerCard[]> {
  const services = await loadServicesFor(rows.map((row) => row.user.id));

  return Promise.all(
    rows.map(async (row) => {
      const list = services.get(row.user.id) ?? [];
      const duration = shortestDuration(list);

      const nextAvailableAt = duration
        ? await findNextAvailable({
            practitionerId: row.user.id,
            durationMinutes: duration,
          })
        : null;

      return toPractitionerCard({
        user: row.user,
        profile: row.profile,
        services: list,
        nextAvailableAt,
        viewerTimezone,
      });
    }),
  );
}

router.get(
  "/practitioners",
  handler(async (req, res) => {
    const query = SearchPractitionersQueryParams.parse(req.query);

    const minPrice = sql<number | null>`min(${servicesTable.priceCents})`;
    const priceAgg = db
      .select({
        practitionerId: servicesTable.practitionerId,
        minPrice: minPrice.as("min_price"),
      })
      .from(servicesTable)
      .where(eq(servicesTable.isActive, true))
      .groupBy(servicesTable.practitionerId)
      .as("price_agg");

    const conditions = [
      eq(practitionerProfilesTable.isPublished, true),
      isNotNull(practitionerProfilesTable.modality),
    ];

    if (query.query) {
      const pattern = `%${query.query.trim()}%`;
      conditions.push(
        sql`(
          ${usersTable.fullName} ilike ${pattern}
          or coalesce(${practitionerProfilesTable.headline}, '') ilike ${pattern}
          or coalesce(${practitionerProfilesTable.bio}, '') ilike ${pattern}
          or array_to_string(${practitionerProfilesTable.tags}, ' ') ilike ${pattern}
        )`,
      );
    }

    if (query.modality) {
      conditions.push(eq(practitionerProfilesTable.modality, query.modality));
    }

    if (query.language) {
      conditions.push(
        sql`${practitionerProfilesTable.languages} && ARRAY[${query.language}]::text[]`,
      );
    }

    if (query.tag) {
      conditions.push(
        sql`${practitionerProfilesTable.tags} && ARRAY[${query.tag}]::text[]`,
      );
    }

    if (query.country) {
      conditions.push(eq(usersTable.country, query.country));
    }

    if (query.format) {
      conditions.push(
        sql`exists (
          select 1 from ${servicesTable} svc
          where svc.practitioner_id = ${practitionerProfilesTable.userId}
            and svc.is_active
            and svc.format = ${query.format}
        )`,
      );
    }

    if (query.minPriceCents !== undefined) {
      conditions.push(gte(priceAgg.minPrice, query.minPriceCents));
    }
    if (query.maxPriceCents !== undefined) {
      conditions.push(lte(priceAgg.minPrice, query.maxPriceCents));
    }

    const where = and(...conditions);

    const [totals] = await db
      .select({ value: count() })
      .from(practitionerProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, practitionerProfilesTable.userId))
      .leftJoin(priceAgg, eq(priceAgg.practitionerId, practitionerProfilesTable.userId))
      .where(where);

    const total = totals?.value ?? 0;

    const base = db
      .select({ user: usersTable, profile: practitionerProfilesTable })
      .from(practitionerProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, practitionerProfilesTable.userId))
      .leftJoin(priceAgg, eq(priceAgg.practitionerId, practitionerProfilesTable.userId))
      .where(where)
      .$dynamic();

    const sort = query.sort ?? "recommended";
    const offset = (query.page - 1) * query.pageSize;

    // "Soonest" depends on generated slots rather than a column, so it is
    // ranked in memory over a capped candidate set.
    if (sort === "soonest") {
      const candidates = await base.limit(SOONEST_SORT_CAP);
      const cards = await buildCards(
        candidates,
        viewerZone(query.timezone, req.auth?.user, "UTC"),
      );

      cards.sort((a, b) => {
        const left = a.nextAvailableAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const right = b.nextAvailableAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return left - right;
      });

      const page: PractitionerSearchPage = {
        items: cards.slice(offset, offset + query.pageSize),
        total,
        page: query.page,
        pageSize: query.pageSize,
        hasMore: offset + query.pageSize < cards.length,
      };
      res.json(page);
      return;
    }

    const ordered =
      sort === "price_asc"
        ? base.orderBy(sql`${priceAgg.minPrice} asc nulls last`)
        : sort === "price_desc"
          ? base.orderBy(sql`${priceAgg.minPrice} desc nulls last`)
          : base.orderBy(
              sql`${practitionerProfilesTable.ratingAverage} desc nulls last`,
              desc(practitionerProfilesTable.ratingCount),
              usersTable.fullName,
            );

    const rows = await ordered.limit(query.pageSize).offset(offset);

    const page: PractitionerSearchPage = {
      items: await buildCards(
        rows,
        viewerZone(query.timezone, req.auth?.user, "UTC"),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: offset + rows.length < total,
    };

    res.json(page);
  }),
);

router.get(
  "/practitioners/:practitionerId",
  handler(async (req, res) => {
    const practitionerId = req.params["practitionerId"] as string;

    const [row] = await db
      .select({ user: usersTable, profile: practitionerProfilesTable })
      .from(practitionerProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, practitionerProfilesTable.userId))
      .where(
        and(
          eq(practitionerProfilesTable.userId, practitionerId),
          eq(practitionerProfilesTable.isPublished, true),
        ),
      )
      .limit(1);

    if (!row) throw notFound("We could not find that practitioner.");

    const services = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.practitionerId, practitionerId),
          eq(servicesTable.isActive, true),
        ),
      );

    const reviews = await loadReviews(practitionerId, 10);
    const viewerTimezone = viewerZone(
      undefined,
      req.auth?.user,
      row.profile.timezone,
    );

    const duration = shortestDuration(services);
    const nextAvailableAt = duration
      ? await findNextAvailable({ practitionerId, durationMinutes: duration })
      : null;

    const profile: PractitionerPublicProfile = {
      practitioner: toPractitionerCard({
        user: row.user,
        profile: row.profile,
        services,
        nextAvailableAt,
        viewerTimezone,
      }),
      bio: row.profile.bio,
      photos: row.profile.photos,
      services: services.map(toService),
      reviews,
      policy: toBookingPolicy(row.profile),
    };

    res.json(profile);
  }),
);

async function loadReviews(
  practitionerId: string,
  limit: number,
): Promise<Review[]> {
  const rows = await db
    .select({
      review: reviewsTable,
      client: usersTable,
      serviceName: appointmentsTable.serviceName,
    })
    .from(reviewsTable)
    .innerJoin(usersTable, eq(usersTable.id, reviewsTable.clientId))
    .innerJoin(appointmentsTable, eq(appointmentsTable.id, reviewsTable.appointmentId))
    .where(eq(reviewsTable.practitionerId, practitionerId))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(limit);

  return rows.map((row) =>
    toReview({
      review: row.review,
      client: row.client,
      serviceName: row.serviceName,
    }),
  );
}

router.get(
  "/practitioners/:practitionerId/reviews",
  handler(async (req, res) => {
    const practitionerId = req.params["practitionerId"] as string;
    res.json(await loadReviews(practitionerId, 50));
  }),
);

router.get(
  "/availability",
  handler(async (req, res) => {
    const query = GetPractitionerAvailabilityQueryParams.parse(req.query);
    const range = requireCalendarRange(req.query["from"], req.query["to"]);

    const [service] = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, query.serviceId),
          eq(servicesTable.practitionerId, query.practitionerId),
        ),
      )
      .limit(1);

    if (!service) throw notFound("We could not find that service.");
    if (!service.isActive) {
      throw badRequest("That service is no longer being offered.");
    }

    res.json(
      await buildAvailabilityCalendar({
        practitionerId: query.practitionerId,
        service,
        from: range.from,
        to: range.to,
        viewerTimezone: viewerZone(query.timezone, req.auth?.user, "UTC"),
      }),
    );
  }),
);

export default router;
