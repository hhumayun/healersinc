/**
 * Development seed data.
 *
 * Wipes the marketplace tables and rebuilds a believable two-sided market:
 * six practitioners spread across five time zones, two clients, real weekly
 * schedules, and a mix of past, pending and confirmed appointments booked
 * through the same slot engine the API uses.
 *
 * Run with: pnpm --filter @workspace/api-server run seed
 */
import { randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { DateTime } from "luxon";
import { avg, count, eq, sql } from "drizzle-orm";
import {
  applyDatabaseConstraints,
  appointmentEventsTable,
  appointmentRemindersTable,
  appointmentsTable,
  availabilityExceptionsTable,
  availabilityRulesTable,
  clientProfilesTable,
  conversationsTable,
  db,
  emailOtpsTable,
  messagesTable,
  notificationsTable,
  practitionerProfilesTable,
  practitionerSignupProgressTable,
  reviewsTable,
  servicesTable,
  sessionsTable,
  userBlocksTable,
  userReportsTable,
  usersTable,
} from "@workspace/db";
import { blockRange, generateSlots } from "@workspace/scheduling";

const scryptAsync = promisify(scrypt);

/** Every seeded account uses this password. */
const SEED_PASSWORD = "Healers2026!";

async function hashPassword(password: string): Promise<string> {
  const salt = randomUUID().replace(/-/g, "");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

type Modality = "mind" | "body" | "spirit" | "psychology";
type Format = "online" | "phone" | "in_person";

interface SeedService {
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  format: Format;
}

interface SeedPractitioner {
  slug: string;
  fullName: string;
  email: string;
  timezone: string;
  country: string;
  location: string;
  modality: Modality;
  headline: string;
  bio: string;
  languages: string[];
  tags: string[];
  hourlyRateCents: number;
  currency: string;
  instantBooking: boolean;
  weekdays: number[];
  startMinute: number;
  endMinute: number;
  services: SeedService[];
}

const PRACTITIONERS: SeedPractitioner[] = [
  {
    slug: "amara-osei",
    fullName: "Amara Osei",
    email: "amara@healers.test",
    timezone: "America/Toronto",
    country: "CA",
    location: "Toronto, Canada",
    modality: "spirit",
    headline: "Reiki Master & Energy Healer",
    bio: "I have spent fifteen years helping people clear what they have been carrying. My sessions blend Reiki, guided visualisation and grounding breathwork, and they are always led by what you bring into the room rather than a fixed script. Most people arrive tired and leave lighter.",
    languages: ["English", "Twi", "French"],
    tags: ["reiki", "energy healing", "grief", "burnout"],
    hourlyRateCents: 12000,
    currency: "USD",
    instantBooking: true,
    weekdays: [1, 2, 3, 4, 5],
    startMinute: 10 * 60,
    endMinute: 18 * 60,
    services: [
      {
        name: "Reiki energy session",
        description:
          "A full hour of hands-off energy work, with time at the start to talk through what is going on and time at the end to land.",
        durationMinutes: 60,
        priceCents: 12000,
        format: "online",
      },
      {
        name: "Intro clarity call",
        description:
          "A short call to see whether we are a good fit before you book a full session.",
        durationMinutes: 30,
        priceCents: 4500,
        format: "phone",
      },
    ],
  },
  {
    slug: "daniel-whitfield",
    fullName: "Daniel Whitfield",
    email: "daniel@healers.test",
    timezone: "Europe/London",
    country: "GB",
    location: "London, United Kingdom",
    modality: "psychology",
    headline: "Clinical Psychologist, CBT & ACT",
    bio: "I am a HCPC-registered clinical psychologist working mainly with anxiety, low mood and the kind of long-running work stress that stops feeling like stress and starts feeling like who you are. I use cognitive behavioural and acceptance-based approaches, and I will always tell you plainly what I think is going on.",
    languages: ["English"],
    tags: ["anxiety", "cbt", "depression", "burnout"],
    hourlyRateCents: 18000,
    currency: "USD",
    instantBooking: false,
    weekdays: [1, 2, 3, 4],
    startMinute: 9 * 60,
    endMinute: 17 * 60,
    services: [
      {
        name: "Individual therapy session",
        description:
          "A standard fifty-minute therapy hour. We agree goals in the first two sessions and review them every six weeks.",
        durationMinutes: 50,
        priceCents: 18000,
        format: "online",
      },
      {
        name: "Initial assessment",
        description:
          "A longer first appointment to understand your history and agree whether therapy with me is the right next step.",
        durationMinutes: 80,
        priceCents: 24000,
        format: "online",
      },
    ],
  },
  {
    slug: "layla-haddad",
    fullName: "Layla Haddad",
    email: "layla@healers.test",
    timezone: "Asia/Dubai",
    country: "AE",
    location: "Dubai, United Arab Emirates",
    modality: "mind",
    headline: "Mindfulness Teacher & Meditation Coach",
    bio: "I teach mindfulness the unglamorous way: short daily practice, honest reflection, and no pressure to feel calm on demand. I work with people who think they cannot meditate, which is almost everyone at the start.",
    languages: ["Arabic", "English", "French"],
    tags: ["mindfulness", "meditation", "sleep", "stress"],
    hourlyRateCents: 9000,
    currency: "USD",
    instantBooking: true,
    weekdays: [7, 1, 2, 3, 4],
    startMinute: 8 * 60,
    endMinute: 15 * 60,
    services: [
      {
        name: "Guided meditation session",
        description:
          "A live guided practice tailored to what you are dealing with this week, plus a recording to keep.",
        durationMinutes: 45,
        priceCents: 7000,
        format: "online",
      },
      {
        name: "Mindfulness coaching",
        description:
          "A full hour of coaching to build a practice that survives contact with a real week.",
        durationMinutes: 60,
        priceCents: 9000,
        format: "online",
      },
    ],
  },
  {
    slug: "zain-abbasi",
    fullName: "Zain Abbasi",
    email: "zain@healers.test",
    timezone: "Asia/Karachi",
    country: "PK",
    location: "Karachi, Pakistan",
    modality: "body",
    headline: "Yoga Therapist & Breathwork Guide",
    bio: "Therapeutic yoga for people with real bodies and real injuries. I work a lot with lower back pain, desk-bound shoulders and the breathing patterns that come with chronic stress. Expect precise, unhurried instruction rather than a workout.",
    languages: ["Urdu", "English", "Punjabi"],
    tags: ["yoga", "breathwork", "back pain", "mobility"],
    hourlyRateCents: 6000,
    currency: "USD",
    instantBooking: true,
    weekdays: [1, 3, 5, 6],
    startMinute: 7 * 60,
    endMinute: 13 * 60,
    services: [
      {
        name: "Therapeutic yoga session",
        description:
          "One-to-one yoga built around your body, your injuries and the space you actually have at home.",
        durationMinutes: 60,
        priceCents: 6000,
        format: "online",
      },
      {
        name: "Breathwork intensive",
        description:
          "A ninety-minute session to reset a breathing pattern that stress has hijacked.",
        durationMinutes: 90,
        priceCents: 8500,
        format: "online",
      },
    ],
  },
  {
    slug: "sofia-reyes",
    fullName: "Sofia Reyes",
    email: "sofia@healers.test",
    timezone: "America/Los_Angeles",
    country: "US",
    location: "Los Angeles, United States",
    modality: "body",
    headline: "Somatic Bodywork & Movement Therapist",
    bio: "Somatic experiencing and movement work for people who know something is stuck but cannot talk their way out of it. Sessions are slow, body-led and completely at your pace. I also see clients in person in Silver Lake.",
    languages: ["English", "Spanish"],
    tags: ["somatic", "trauma", "movement", "nervous system"],
    hourlyRateCents: 15000,
    currency: "USD",
    instantBooking: false,
    weekdays: [2, 3, 4, 5],
    startMinute: 10 * 60,
    endMinute: 19 * 60,
    services: [
      {
        name: "Somatic experiencing session",
        description:
          "A gentle, body-led hour for regulating a nervous system that has been running hot for a long time.",
        durationMinutes: 60,
        priceCents: 15000,
        format: "online",
      },
      {
        name: "In-person bodywork",
        description:
          "Hands-on somatic bodywork at my studio in Silver Lake, Los Angeles.",
        durationMinutes: 75,
        priceCents: 19000,
        format: "in_person",
      },
    ],
  },
  {
    slug: "noor-rahman",
    fullName: "Noor Rahman",
    email: "noor@healers.test",
    timezone: "America/Toronto",
    country: "CA",
    location: "Toronto, Canada",
    modality: "mind",
    headline: "Clinical Hypnotherapist & Life Coach",
    bio: "I use hypnotherapy and practical coaching for habits that have outlived their usefulness: smoking, procrastination, the fear of speaking in front of people. Most clients see a shift inside four sessions, and I will say so early if I do not think I can help.",
    languages: ["English", "Bengali"],
    tags: ["hypnotherapy", "habits", "confidence", "public speaking"],
    hourlyRateCents: 11000,
    currency: "USD",
    instantBooking: true,
    weekdays: [1, 2, 4, 5, 6],
    startMinute: 11 * 60,
    endMinute: 20 * 60,
    services: [
      {
        name: "Hypnotherapy session",
        description:
          "A focused hypnotherapy hour targeting one specific habit or fear.",
        durationMinutes: 60,
        priceCents: 11000,
        format: "online",
      },
      {
        name: "Coaching call",
        description:
          "A shorter accountability call between hypnotherapy sessions.",
        durationMinutes: 30,
        priceCents: 5500,
        format: "phone",
      },
    ],
  },
];

interface SeedClient {
  fullName: string;
  email: string;
  timezone: string;
  country: string;
  location: string;
}

const CLIENTS: SeedClient[] = [
  {
    fullName: "Priya Sharma",
    email: "priya@healers.test",
    timezone: "America/Toronto",
    country: "CA",
    location: "Toronto, Canada",
  },
  {
    fullName: "Marcus Bell",
    email: "marcus@healers.test",
    timezone: "Europe/London",
    country: "GB",
    location: "London, United Kingdom",
  },
];

const AVATAR_BASE = "/api/media/practitioners";

async function wipe(): Promise<void> {
  // Order matters: children before parents.
  await db.delete(reviewsTable);
  await db.delete(appointmentRemindersTable);
  await db.delete(appointmentEventsTable);
  await db.delete(appointmentsTable);
  await db.delete(messagesTable);
  await db.delete(conversationsTable);
  await db.delete(userBlocksTable);
  await db.delete(userReportsTable);
  await db.delete(notificationsTable);
  await db.delete(servicesTable);
  await db.delete(availabilityExceptionsTable);
  await db.delete(availabilityRulesTable);
  await db.delete(practitionerSignupProgressTable);
  await db.delete(practitionerProfilesTable);
  await db.delete(clientProfilesTable);
  await db.delete(sessionsTable);
  await db.delete(emailOtpsTable);
  await db.delete(usersTable);
}

interface BuiltPractitioner {
  userId: string;
  seed: SeedPractitioner;
  serviceIds: string[];
}

async function main(): Promise<void> {
  await applyDatabaseConstraints();
  await wipe();

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const built: BuiltPractitioner[] = [];

  for (const seed of PRACTITIONERS) {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: seed.email,
        passwordHash,
        fullName: seed.fullName,
        country: seed.country,
        timezone: seed.timezone,
        avatarUrl: `${AVATAR_BASE}/${seed.slug}.jpg`,
        isPractitioner: true,
        emailVerified: true,
      })
      .returning();

    if (!user) throw new Error(`Could not create ${seed.fullName}`);

    await db.insert(practitionerProfilesTable).values({
      userId: user.id,
      modality: seed.modality,
      headline: seed.headline,
      bio: seed.bio,
      photos: [`${AVATAR_BASE}/${seed.slug}-cover.jpg`],
      languages: seed.languages,
      tags: seed.tags,
      hourlyRateCents: seed.hourlyRateCents,
      currency: seed.currency,
      location: seed.location,
      timezone: seed.timezone,
      isPublished: true,
      instantBooking: seed.instantBooking,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
    });

    await db.insert(practitionerSignupProgressTable).values({
      userId: user.id,
      currentStep: "complete",
      draft: {},
      completedAt: new Date(),
    });

    await db.insert(availabilityRulesTable).values(
      seed.weekdays.map((weekday) => ({
        practitionerId: user.id,
        weekday,
        startMinute: seed.startMinute,
        endMinute: seed.endMinute,
      })),
    );

    const services = await db
      .insert(servicesTable)
      .values(
        seed.services.map((service) => ({
          practitionerId: user.id,
          name: service.name,
          description: service.description,
          durationMinutes: service.durationMinutes,
          priceCents: service.priceCents,
          currency: seed.currency,
          format: service.format,
        })),
      )
      .returning({ id: servicesTable.id });

    built.push({
      userId: user.id,
      seed,
      serviceIds: services.map((service) => service.id),
    });
  }

  // One practitioner is away next week, so the calendar has a visible gap.
  const away = built[3];
  if (away) {
    const start = DateTime.now().setZone(away.seed.timezone).plus({ days: 6 });
    await db.insert(availabilityExceptionsTable).values({
      practitionerId: away.userId,
      kind: "vacation",
      startDate: start.toISODate() ?? "2026-01-01",
      endDate: start.plus({ days: 4 }).toISODate() ?? "2026-01-05",
      note: "Family trip",
    });
  }

  const clientIds: string[] = [];
  for (const seed of CLIENTS) {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: seed.email,
        passwordHash,
        fullName: seed.fullName,
        country: seed.country,
        timezone: seed.timezone,
        isClient: true,
        emailVerified: true,
      })
      .returning();

    if (!user) throw new Error(`Could not create ${seed.fullName}`);

    await db.insert(clientProfilesTable).values({
      userId: user.id,
      location: seed.location,
      onboardedAt: new Date(),
    });

    clientIds.push(user.id);
  }

  const [priya, marcus] = clientIds;
  if (!priya || !marcus) throw new Error("Clients were not created");

  await seedAppointments(built, priya, marcus);
  await seedConversations(built, priya, marcus);
  await refreshRatings(built.map((entry) => entry.userId));

  console.log(
    `Seeded ${built.length} practitioners and ${clientIds.length} clients. Password for every account: ${SEED_PASSWORD}`,
  );
}

/** Ask the real slot engine for a bookable time so seeds obey the schedule. */
async function nextSlot(
  practitionerId: string,
  durationMinutes: number,
  skip: number,
): Promise<Date | null> {
  const now = new Date();
  const rangeEnd = new Date(now.getTime() + 21 * 86_400_000);

  const [profile] = await db
    .select()
    .from(practitionerProfilesTable)
    .where(eq(practitionerProfilesTable.userId, practitionerId))
    .limit(1);
  if (!profile) return null;

  const rules = await db
    .select()
    .from(availabilityRulesTable)
    .where(eq(availabilityRulesTable.practitionerId, practitionerId));

  const busy = await db
    .select({
      start: appointmentsTable.blockStartsAt,
      end: appointmentsTable.blockEndsAt,
    })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.practitionerId, practitionerId));

  const slots = generateSlots({
    timezone: profile.timezone,
    windows: rules.map((rule) => ({
      weekday: rule.weekday,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
    })),
    exceptions: [],
    busy,
    durationMinutes,
    policy: {
      bufferBeforeMinutes: profile.bufferBeforeMinutes,
      bufferAfterMinutes: profile.bufferAfterMinutes,
      minNoticeMinutes: profile.minNoticeMinutes,
      maxAdvanceDays: profile.maxAdvanceDays,
    },
    slotIntervalMinutes: 60,
    rangeStart: now,
    rangeEnd,
    now,
  });

  return slots[skip]?.startsAt ?? null;
}

async function insertAppointment(input: {
  clientId: string;
  practitionerId: string;
  serviceId: string;
  startsAt: Date;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  clientTimezone: string;
  practitionerTimezone: string;
  clientNotes?: string;
}): Promise<string | null> {
  const [service] = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.id, input.serviceId))
    .limit(1);
  if (!service) return null;

  const range = blockRange(input.startsAt, service.durationMinutes, 0, 15);

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      clientId: input.clientId,
      practitionerId: input.practitionerId,
      serviceId: service.id,
      serviceName: service.name,
      serviceDurationMinutes: service.durationMinutes,
      servicePriceCents: service.priceCents,
      serviceCurrency: service.currency,
      serviceFormat: service.format,
      startsAt: range.startsAt,
      endsAt: range.endsAt,
      blockStartsAt: range.blockStartsAt,
      blockEndsAt: range.blockEndsAt,
      clientTimezone: input.clientTimezone,
      practitionerTimezone: input.practitionerTimezone,
      status: input.status,
      clientNotes: input.clientNotes ?? null,
      idempotencyKey: randomUUID(),
    })
    .returning({ id: appointmentsTable.id });

  return appointment?.id ?? null;
}

async function seedAppointments(
  built: BuiltPractitioner[],
  priya: string,
  marcus: string,
): Promise<void> {
  const [amara, daniel, layla, zain, sofia, noor] = built;
  if (!amara || !daniel || !layla || !zain || !sofia || !noor) return;

  const upcoming: {
    practitioner: BuiltPractitioner;
    clientId: string;
    clientTimezone: string;
    status: "pending" | "confirmed";
    skip: number;
    notes?: string;
  }[] = [
    {
      practitioner: amara,
      clientId: priya,
      clientTimezone: "America/Toronto",
      status: "confirmed",
      skip: 1,
      notes: "Coming off a hard few months at work. Mostly want to feel grounded again.",
    },
    {
      practitioner: layla,
      clientId: priya,
      clientTimezone: "America/Toronto",
      status: "confirmed",
      skip: 2,
      notes: "I cannot sleep past 4am. Hoping for something I can actually keep up.",
    },
    {
      practitioner: daniel,
      clientId: marcus,
      clientTimezone: "Europe/London",
      status: "pending",
      skip: 1,
      notes: "First time in therapy. Not sure where to start.",
    },
    {
      practitioner: sofia,
      clientId: marcus,
      clientTimezone: "Europe/London",
      status: "pending",
      skip: 3,
    },
    {
      practitioner: zain,
      clientId: marcus,
      clientTimezone: "Europe/London",
      status: "confirmed",
      skip: 2,
      notes: "Lower back seizes up after long flights.",
    },
    {
      practitioner: noor,
      clientId: priya,
      clientTimezone: "America/Toronto",
      status: "confirmed",
      skip: 4,
    },
  ];

  for (const entry of upcoming) {
    const serviceId = entry.practitioner.serviceIds[0];
    if (!serviceId) continue;

    const [service] = await db
      .select({ durationMinutes: servicesTable.durationMinutes })
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .limit(1);
    if (!service) continue;

    const startsAt = await nextSlot(
      entry.practitioner.userId,
      service.durationMinutes,
      entry.skip,
    );
    if (!startsAt) continue;

    const appointmentId = await insertAppointment({
      clientId: entry.clientId,
      practitionerId: entry.practitioner.userId,
      serviceId,
      startsAt,
      status: entry.status,
      clientTimezone: entry.clientTimezone,
      practitionerTimezone: entry.practitioner.seed.timezone,
      ...(entry.notes ? { clientNotes: entry.notes } : {}),
    });

    if (appointmentId && entry.status === "confirmed") {
      await db.insert(appointmentRemindersTable).values([
        {
          appointmentId,
          kind: "24h" as const,
          sendAt: new Date(startsAt.getTime() - 24 * 3_600_000),
        },
        {
          appointmentId,
          kind: "1h" as const,
          sendAt: new Date(startsAt.getTime() - 3_600_000),
        },
      ]);
    }

    if (appointmentId) {
      await db.insert(notificationsTable).values({
        userId: entry.practitioner.userId,
        type: entry.status === "confirmed" ? "booking_confirmed" : "booking_requested",
        title: entry.status === "confirmed" ? "New booking" : "New booking request",
        body: `${entry.clientId === priya ? "Priya Sharma" : "Marcus Bell"} booked a session with you.`,
        data: { appointmentId },
      });
    }
  }

  // Completed history, which is what makes reviews and earnings believable.
  const history: {
    practitioner: BuiltPractitioner;
    clientId: string;
    clientTimezone: string;
    daysAgo: number;
    localHour: number;
    rating: number;
    comment: string;
  }[] = [
    {
      practitioner: amara,
      clientId: priya,
      clientTimezone: "America/Toronto",
      daysAgo: 12,
      localHour: 14,
      rating: 5,
      comment:
        "I was sceptical and said so. Amara did not try to convince me of anything, she just worked. I slept properly for the first time in weeks.",
    },
    {
      practitioner: amara,
      clientId: marcus,
      clientTimezone: "Europe/London",
      daysAgo: 26,
      localHour: 16,
      rating: 5,
      comment: "Calm, unhurried, and she remembered everything from our first call.",
    },
    {
      practitioner: layla,
      clientId: priya,
      clientTimezone: "America/Toronto",
      daysAgo: 9,
      localHour: 11,
      rating: 4,
      comment:
        "Practical rather than mystical, which is exactly what I needed. The recordings are genuinely useful.",
    },
    {
      practitioner: daniel,
      clientId: marcus,
      clientTimezone: "Europe/London",
      daysAgo: 20,
      localHour: 10,
      rating: 5,
      comment:
        "Direct without being blunt. He named something in session two that I had been circling for a year.",
    },
    {
      practitioner: zain,
      clientId: marcus,
      clientTimezone: "Europe/London",
      daysAgo: 15,
      localHour: 9,
      rating: 4,
      comment: "My back is noticeably better. The cueing is very precise.",
    },
    {
      practitioner: noor,
      clientId: priya,
      clientTimezone: "America/Toronto",
      daysAgo: 30,
      localHour: 13,
      rating: 5,
      comment: "Four sessions and I have not touched a cigarette since. Still slightly stunned.",
    },
  ];

  for (const entry of history) {
    const serviceId = entry.practitioner.serviceIds[0];
    if (!serviceId) continue;

    const startsAt = DateTime.now()
      .setZone(entry.practitioner.seed.timezone)
      .minus({ days: entry.daysAgo })
      .set({ hour: entry.localHour, minute: 0, second: 0, millisecond: 0 })
      .toJSDate();

    const appointmentId = await insertAppointment({
      clientId: entry.clientId,
      practitionerId: entry.practitioner.userId,
      serviceId,
      startsAt,
      status: "completed",
      clientTimezone: entry.clientTimezone,
      practitionerTimezone: entry.practitioner.seed.timezone,
    });

    if (!appointmentId) continue;

    await db.insert(reviewsTable).values({
      appointmentId,
      clientId: entry.clientId,
      practitionerId: entry.practitioner.userId,
      rating: entry.rating,
      comment: entry.comment,
    });
  }
}

async function seedConversations(
  built: BuiltPractitioner[],
  priya: string,
  marcus: string,
): Promise<void> {
  const [amara, daniel] = built;
  if (!amara || !daniel) return;

  const threads: {
    clientId: string;
    practitionerId: string;
    messages: { fromClient: boolean; body: string; minutesAgo: number }[];
  }[] = [
    {
      clientId: priya,
      practitionerId: amara.userId,
      messages: [
        {
          fromClient: true,
          body: "Hi Amara — is it alright if we start the next session with a bit of talking? Last time I felt like I needed longer to arrive.",
          minutesAgo: 180,
        },
        {
          fromClient: false,
          body: "Of course. Let's take the first fifteen minutes for that and I'll adjust the rest around it.",
          minutesAgo: 120,
        },
        {
          fromClient: true,
          body: "Thank you. That takes the pressure off.",
          minutesAgo: 90,
        },
      ],
    },
    {
      clientId: marcus,
      practitionerId: daniel.userId,
      messages: [
        {
          fromClient: true,
          body: "Hello — I've requested an assessment slot. Is there anything I should prepare beforehand?",
          minutesAgo: 60,
        },
        {
          fromClient: false,
          body: "Nothing formal. If you can jot down when things feel worst during a normal week, that gives us a useful starting point.",
          minutesAgo: 30,
        },
      ],
    },
  ];

  for (const thread of threads) {
    const [conversation] = await db
      .insert(conversationsTable)
      .values({
        clientId: thread.clientId,
        practitionerId: thread.practitionerId,
      })
      .returning();

    if (!conversation) continue;

    let last: { body: string; createdAt: Date } | null = null;

    for (const message of thread.messages) {
      const createdAt = new Date(Date.now() - message.minutesAgo * 60_000);
      await db.insert(messagesTable).values({
        conversationId: conversation.id,
        senderId: message.fromClient ? thread.clientId : thread.practitionerId,
        body: message.body,
        createdAt,
        readAt: message.fromClient ? createdAt : null,
      });
      last = { body: message.body, createdAt };
    }

    if (last) {
      await db
        .update(conversationsTable)
        .set({
          lastMessageAt: last.createdAt,
          lastMessagePreview: last.body.slice(0, 120),
        })
        .where(eq(conversationsTable.id, conversation.id));
    }
  }
}

async function refreshRatings(practitionerIds: string[]): Promise<void> {
  for (const practitionerId of practitionerIds) {
    const [aggregate] = await db
      .select({ average: avg(reviewsTable.rating), total: count() })
      .from(reviewsTable)
      .where(eq(reviewsTable.practitionerId, practitionerId));

    await db
      .update(practitionerProfilesTable)
      .set({
        ratingAverage: aggregate?.average ?? null,
        ratingCount: aggregate?.total ?? 0,
      })
      .where(eq(practitionerProfilesTable.userId, practitionerId));
  }
}

main()
  .then(async () => {
    await db.execute(sql`select 1`);
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
