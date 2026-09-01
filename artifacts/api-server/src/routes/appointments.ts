import { Router, type IRouter } from "express";
import { and, desc, eq, gte, inArray, lt, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  appointmentEventsTable,
  appointmentsTable,
  db,
  practitionerProfilesTable,
  servicesTable,
  usersTable,
  type Appointment,
  type PractitionerProfile,
  type User,
} from "@workspace/db";
import {
  ActOnAppointmentBody,
  CreateAppointmentCheckoutBody,
  CreateAppointmentCheckoutParams,
  CreateAppointmentCheckoutResponse,
  CreateAppointmentRefundBody,
  CreateAppointmentRefundParams,
  CreateAppointmentRefundResponse,
  GetAppointmentPaymentParams,
  GetAppointmentPaymentResponse,
  CreateBookingBody,
  ListAppointmentsQueryParams,
  type Appointment as AppointmentDto,
  type CalendarFile,
} from "@workspace/api-zod";
import { isValidTimeZone } from "@workspace/scheduling";
import { requireAuth, requireRole } from "../lib/auth";
import { badRequest, conflict, forbidden, handler, notFound } from "../lib/errors";
import { toAppointment } from "../lib/serializers";
import { createBooking, rescheduleAppointment } from "../lib/booking";
import { cancelReminders, scheduleReminders } from "../lib/reminders";
import { notify } from "../lib/notifications";
import { publishToUser } from "../lib/realtime";
import { buildIcs, icsFilename } from "../lib/ics";
import { loadReviewedAppointmentIds } from "./practitioner";
import {
  accountReady,
  cancelPendingCheckout,
  classifyUnpaidPayment,
  createCheckout,
  loadPaymentAccount,
  loadPaymentForAppointment,
  refreshStripePaymentAccount,
  requestFullRefund,
  toPaymentSummary,
  toRefundSummary,
  unpaidPaymentSummary,
} from "../lib/payments";
import { countryIsEligible, paymentPolicy } from "../lib/paymentPolicy";
import {
  checkoutReturnUrls,
  paymentWebReturnBaseUrl,
} from "../lib/paymentReturnUrls";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();

const clientUser = alias(usersTable, "appointment_client");
const practitionerUser = alias(usersTable, "appointment_practitioner");

interface AppointmentRow {
  appointment: Appointment;
  client: User;
  practitioner: User;
  practitionerHeadline: string | null;
}

function appointmentQuery() {
  return db
    .select({
      appointment: appointmentsTable,
      client: clientUser,
      practitioner: practitionerUser,
      practitionerHeadline: practitionerProfilesTable.headline,
    })
    .from(appointmentsTable)
    .innerJoin(clientUser, eq(clientUser.id, appointmentsTable.clientId))
    .innerJoin(
      practitionerUser,
      eq(practitionerUser.id, appointmentsTable.practitionerId),
    )
    .leftJoin(
      practitionerProfilesTable,
      eq(practitionerProfilesTable.userId, appointmentsTable.practitionerId),
    );
}

async function serialise(
  rows: AppointmentRow[],
  viewerId: string,
): Promise<AppointmentDto[]> {
  const reviewed = await loadReviewedAppointmentIds(
    rows.map((row) => row.appointment.id),
  );

  return Promise.all(rows.map(async (row) => {
    const payment = await loadPaymentForAppointment(row.appointment.id);
    const account = payment
      ? null
      : await loadPaymentAccount(row.appointment.practitionerId);
    const availability = classifyUnpaidPayment({
      appointmentStatus: row.appointment.status,
      isFuture: row.appointment.endsAt.getTime() > Date.now(),
      priceCents: row.appointment.servicePriceCents,
      paymentsEnabled: paymentPolicy.enabled,
      countryEligible: countryIsEligible(row.practitioner.country),
      practitionerReady: Boolean(
        account && countryIsEligible(account.country) && accountReady(account),
      ),
    });
    return toAppointment({
      appointment: row.appointment,
      client: row.client,
      practitioner: row.practitioner,
      practitionerHeadline: row.practitionerHeadline,
      viewerId,
      hasReview: reviewed.has(row.appointment.id),
      payment: payment
        ? toPaymentSummary(payment)
        : unpaidPaymentSummary(row.appointment, availability),
    });
  }));
}

/** Load an appointment the signed-in person is actually part of. */
async function loadOwnAppointment(
  appointmentId: string,
  viewerId: string,
): Promise<AppointmentRow> {
  const [row] = await appointmentQuery()
    .where(eq(appointmentsTable.id, appointmentId))
    .limit(1);

  if (!row) throw notFound("We could not find that appointment.");

  if (
    row.appointment.clientId !== viewerId &&
    row.appointment.practitionerId !== viewerId
  ) {
    throw forbidden("This appointment is not yours.");
  }

  return row;
}

async function loadPractitionerProfile(
  practitionerId: string,
): Promise<PractitionerProfile> {
  const [profile] = await db
    .select()
    .from(practitionerProfilesTable)
    .where(eq(practitionerProfilesTable.userId, practitionerId))
    .limit(1);

  if (!profile) throw notFound("That practitioner is no longer available.");
  return profile;
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

router.get(
  "/appointments",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const query = ListAppointmentsQueryParams.parse(req.query);
    const scope = query.scope ?? "upcoming";
    const now = new Date();

    const mine =
      auth.role === "practitioner"
        ? eq(appointmentsTable.practitionerId, auth.user.id)
        : eq(appointmentsTable.clientId, auth.user.id);

    const scopeFilters: Record<typeof scope, SQL | undefined> = {
      upcoming: and(
        inArray(appointmentsTable.status, ["pending", "confirmed"]),
        gte(appointmentsTable.endsAt, now),
      ),
      pending: eq(appointmentsTable.status, "pending"),
      past: or(
        lt(appointmentsTable.endsAt, now),
        inArray(appointmentsTable.status, ["completed", "cancelled", "declined"]),
      ),
      all: undefined,
    };

    const rows = await appointmentQuery()
      .where(and(mine, scopeFilters[scope]))
      .orderBy(
        scope === "past"
          ? desc(appointmentsTable.startsAt)
          : appointmentsTable.startsAt,
      );

    res.json(await serialise(rows, auth.user.id));
  }),
);

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

router.post(
  "/appointments",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "client");
    const body = CreateBookingBody.parse(req.body);

    if (!isValidTimeZone(body.clientTimezone)) {
      throw badRequest(`"${body.clientTimezone}" is not a time zone we recognise.`);
    }

    if (body.practitionerId === auth.user.id) {
      throw badRequest("You cannot book a session with yourself.");
    }

    const [practitioner] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, body.practitionerId))
      .limit(1);

    if (!practitioner) throw notFound("We could not find that practitioner.");

    const profile = await loadPractitionerProfile(body.practitionerId);
    if (!profile.isPublished) {
      throw conflict("That practitioner is not taking bookings right now.");
    }

    const [service] = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, body.serviceId),
          eq(servicesTable.practitionerId, body.practitionerId),
          eq(servicesTable.isActive, true),
        ),
      )
      .limit(1);

    if (!service) throw notFound("We could not find that service.");

    const { appointment, reused } = await createBooking({
      client: auth.user,
      practitioner,
      profile,
      service,
      startsAt: body.startsAt,
      clientTimezone: body.clientTimezone,
      notes: body.notes ?? null,
      idempotencyKey: body.idempotencyKey,
    });

    const [dto] = await serialise(
      [
        {
          appointment,
          client: auth.user,
          practitioner,
          practitionerHeadline: profile.headline,
        },
      ],
      auth.user.id,
    );

    if (!reused) {
      const confirmed = appointment.status === "confirmed";

      await notify({
        userId: practitioner.id,
        type: confirmed ? "booking_confirmed" : "booking_requested",
        title: confirmed ? "New booking" : "New booking request",
        body: `${auth.user.fullName} — ${appointment.serviceName}`,
        appointmentId: appointment.id,
      });

      await notify({
        userId: auth.user.id,
        type: confirmed ? "booking_confirmed" : "booking_requested",
        title: confirmed ? "Session confirmed" : "Request sent",
        body: confirmed
          ? `Your ${appointment.serviceName} with ${practitioner.fullName} is booked.`
          : `${practitioner.fullName} will confirm your ${appointment.serviceName} shortly.`,
        appointmentId: appointment.id,
      });

      publishToUser(practitioner.id, {
        type: "appointment.updated",
        appointmentId: appointment.id,
      });
    }

    res.status(reused ? 200 : 201).json(dto);
  }),
);

router.get(
  "/appointments/:appointmentId",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const row = await loadOwnAppointment(
      req.params["appointmentId"] as string,
      auth.user.id,
    );

    const [dto] = await serialise([row], auth.user.id);
    res.json(dto);
  }),
);

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

async function recordEvent(input: {
  appointmentId: string;
  actorId: string;
  fromStatus: Appointment["status"];
  toStatus: Appointment["status"];
  reason?: string | null;
}): Promise<void> {
  await db.insert(appointmentEventsTable).values({
    appointmentId: input.appointmentId,
    actorId: input.actorId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    reason: input.reason ?? null,
  });
}

router.post(
  "/appointments/:appointmentId/actions",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const body = ActOnAppointmentBody.parse(req.body);
    const row = await loadOwnAppointment(
      req.params["appointmentId"] as string,
      auth.user.id,
    );

    const { appointment } = row;
    const isPractitioner = appointment.practitionerId === auth.user.id;
    const counterpartId = isPractitioner
      ? appointment.clientId
      : appointment.practitionerId;
    const actorName = auth.user.fullName;

    let updated: Appointment = appointment;

    switch (body.action) {
      case "accept": {
        if (!isPractitioner) {
          throw forbidden("Only the practitioner can accept a request.");
        }
        if (appointment.status !== "pending") {
          throw conflict("That request is no longer pending.");
        }

        updated = await setStatus(appointment, "confirmed");
        await scheduleReminders({
          appointmentId: updated.id,
          startsAt: updated.startsAt,
        });
        await recordEvent({
          appointmentId: updated.id,
          actorId: auth.user.id,
          fromStatus: "pending",
          toStatus: "confirmed",
        });
        await notify({
          userId: counterpartId,
          type: "booking_confirmed",
          title: "Session confirmed",
          body: `${actorName} confirmed your ${appointment.serviceName}.`,
          appointmentId: updated.id,
        });
        break;
      }

      case "decline": {
        if (!isPractitioner) {
          throw forbidden("Only the practitioner can decline a request.");
        }
        if (appointment.status !== "pending") {
          throw conflict("That request is no longer pending.");
        }

        updated = await setStatus(appointment, "declined", {
          cancellationReason: body.reason ?? null,
          cancelledById: auth.user.id,
        });
        await cancelReminders(updated.id);
        await recordEvent({
          appointmentId: updated.id,
          actorId: auth.user.id,
          fromStatus: "pending",
          toStatus: "declined",
          reason: body.reason,
        });
        await notify({
          userId: counterpartId,
          type: "booking_declined",
          title: "Request declined",
          body: body.reason
            ? `${actorName} could not take this one: ${body.reason}`
            : `${actorName} could not take your ${appointment.serviceName}.`,
          appointmentId: updated.id,
        });
        break;
      }

      case "cancel": {
        if (
          appointment.status !== "pending" &&
          appointment.status !== "confirmed"
        ) {
          throw conflict("That session can no longer be cancelled.");
        }
        if (appointment.endsAt.getTime() <= Date.now()) {
          throw conflict(
            "That session has already finished, so it cannot be cancelled.",
          );
        }

        const profile = await loadPractitionerProfile(appointment.practitionerId);
        const noticeMs = profile.cancellationNoticeHours * 3_600_000;
        const late = Date.now() > appointment.startsAt.getTime() - noticeMs;

        updated = await setStatus(appointment, "cancelled", {
          cancellationReason: body.reason ?? null,
          cancelledById: auth.user.id,
          cancelledLate: late,
        });
        await cancelReminders(updated.id);
        await recordEvent({
          appointmentId: updated.id,
          actorId: auth.user.id,
          fromStatus: appointment.status,
          toStatus: "cancelled",
          reason: body.reason,
        });
        await notify({
          userId: counterpartId,
          type: "booking_cancelled",
          title: "Session cancelled",
          body: body.reason
            ? `${actorName} cancelled: ${body.reason}`
            : `${actorName} cancelled the ${appointment.serviceName}.`,
          appointmentId: updated.id,
        });
        if (!late) {
          const payment = await loadPaymentForAppointment(updated.id);
          if (payment && ["paid", "partially_refunded"].includes(payment.status)) {
            try {
              await requestFullRefund({
                payment,
                requestedById: auth.user.id,
                reason: "Automatic refund for timely cancellation",
              });
            } catch (err) {
              req.log.error(
                { err },
                "Automatic cancellation refund could not be requested",
              );
            }
          }
        }
        const checkoutPayment = await loadPaymentForAppointment(updated.id);
        if (checkoutPayment?.status === "checkout_pending") {
          try {
            await cancelPendingCheckout(checkoutPayment);
          } catch (err) {
            req.log.warn(
              { err },
              "Cancelled checkout could not be expired at Stripe",
            );
          }
        }
        break;
      }

      case "complete": {
        if (!isPractitioner) {
          throw forbidden("Only the practitioner can mark a session complete.");
        }
        if (appointment.status !== "confirmed") {
          throw conflict("Only a confirmed session can be completed.");
        }
        if (appointment.endsAt.getTime() > Date.now()) {
          throw conflict("That session has not finished yet.");
        }

        updated = await setStatus(appointment, "completed");
        await cancelReminders(updated.id);
        await recordEvent({
          appointmentId: updated.id,
          actorId: auth.user.id,
          fromStatus: "confirmed",
          toStatus: "completed",
        });
        await notify({
          userId: counterpartId,
          type: "booking_completed",
          title: "How was your session?",
          body: `Leave ${actorName} a review for your ${appointment.serviceName}.`,
          appointmentId: updated.id,
        });
        break;
      }

      case "reschedule": {
        if (
          appointment.status !== "pending" &&
          appointment.status !== "confirmed"
        ) {
          throw conflict("That session can no longer be moved.");
        }
        if (appointment.endsAt.getTime() <= Date.now()) {
          throw conflict(
            "That session has already finished, so it cannot be moved.",
          );
        }
        if (!body.startsAt) {
          throw badRequest("Pick a new time to reschedule to.");
        }

        const profile = await loadPractitionerProfile(appointment.practitionerId);
        updated = await rescheduleAppointment({
          appointment,
          profile,
          actorId: auth.user.id,
          startsAt: body.startsAt,
          reason: body.reason ?? null,
        });

        await notify({
          userId: counterpartId,
          type: "booking_rescheduled",
          title: "Session moved",
          body: `${actorName} moved your ${appointment.serviceName} to a new time.`,
          appointmentId: updated.id,
        });
        break;
      }
    }

    publishToUser(counterpartId, {
      type: "appointment.updated",
      appointmentId: updated.id,
    });

    const [dto] = await serialise([{ ...row, appointment: updated }], auth.user.id);
    res.json(dto);
  }),
);

router.post(
  "/appointments/:appointmentId/checkout",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "client");
    const params = CreateAppointmentCheckoutParams.parse(req.params);
    const body = CreateAppointmentCheckoutBody.parse(req.body);
    const row = await loadOwnAppointment(params.appointmentId, auth.user.id);
    const appointment = row.appointment;
    if (appointment.clientId !== auth.user.id) throw forbidden("Only the client can pay.");
    if (!paymentPolicy.enabled) throw conflict("In-app payments are currently disabled.");
    if (appointment.status !== "confirmed") {
      throw conflict("Checkout is available only after the appointment is confirmed.");
    }
    if (appointment.endsAt.getTime() <= Date.now()) throw conflict("This appointment has passed.");
    if (appointment.servicePriceCents <= 0) throw conflict("This appointment does not require payment.");
    if (!countryIsEligible(row.practitioner.country)) {
      throw conflict("This practitioner uses the existing unpaid booking flow.");
    }
    let account = await loadPaymentAccount(appointment.practitionerId);
    if (!account) throw conflict("This practitioner is not ready to accept payments.");
    const stripe = await getUncachableStripeClient();
    account = await refreshStripePaymentAccount(
      appointment.practitionerId,
      account,
      stripe,
    );
    if (!countryIsEligible(account.country) || !accountReady(account)) {
      throw conflict("This practitioner is not ready to accept payments.");
    }
    const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
    if (!domain) throw new Error("REPLIT_DOMAINS is required for checkout.");
    const returnUrls = checkoutReturnUrls({
      appointmentId: appointment.id,
      returnTarget: body.returnTarget,
      apiBaseUrl: `https://${domain}`,
      webBaseUrl:
        body.returnTarget === "web" ? paymentWebReturnBaseUrl() : undefined,
    });
    const checkout = await createCheckout({
      appointment,
      account,
      clientEmail: auth.user.email,
      ...returnUrls,
    });
    res.json(
      CreateAppointmentCheckoutResponse.parse({
        payment: toPaymentSummary(checkout.payment),
        checkoutUrl: checkout.checkoutUrl,
        expiresAt: checkout.expiresAt,
      }),
    );
  }),
);

router.get(
  "/appointments/:appointmentId/payment",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const params = GetAppointmentPaymentParams.parse(req.params);
    const row = await loadOwnAppointment(params.appointmentId, auth.user.id);
    const payment = await loadPaymentForAppointment(params.appointmentId);
    if (payment) {
      res.json(GetAppointmentPaymentResponse.parse(toPaymentSummary(payment)));
      return;
    }
    const account = await loadPaymentAccount(row.appointment.practitionerId);
    const availability = classifyUnpaidPayment({
      appointmentStatus: row.appointment.status,
      isFuture: row.appointment.endsAt.getTime() > Date.now(),
      priceCents: row.appointment.servicePriceCents,
      paymentsEnabled: paymentPolicy.enabled,
      countryEligible: countryIsEligible(row.practitioner.country),
      practitionerReady: Boolean(
        account && countryIsEligible(account.country) && accountReady(account),
      ),
    });
    res.json(
      GetAppointmentPaymentResponse.parse(
        unpaidPaymentSummary(row.appointment, availability),
      ),
    );
  }),
);

router.post(
  "/appointments/:appointmentId/refunds",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "practitioner");
    const params = CreateAppointmentRefundParams.parse(req.params);
    const body = CreateAppointmentRefundBody.parse(req.body);
    const row = await loadOwnAppointment(params.appointmentId, auth.user.id);
    if (row.appointment.practitionerId !== auth.user.id) {
      throw forbidden("Only the practitioner can issue this refund.");
    }
    if (!paymentPolicy.enabled) throw conflict("In-app payments are currently disabled.");
    const payment = await loadPaymentForAppointment(params.appointmentId);
    if (!payment) throw conflict("There is no captured payment to refund.");
    const refund = await requestFullRefund({
      payment,
      requestedById: auth.user.id,
      reason: body.reason,
    });
    res.status(201).json(
      CreateAppointmentRefundResponse.parse(toRefundSummary(refund)),
    );
  }),
);

/**
 * Status transitions are guarded by the status we read, so two people acting
 * on the same request at once cannot both win.
 */
async function setStatus(
  appointment: Appointment,
  status: Appointment["status"],
  extra: Partial<{
    cancellationReason: string | null;
    cancelledById: string | null;
    cancelledLate: boolean;
  }> = {},
): Promise<Appointment> {
  const [updated] = await db
    .update(appointmentsTable)
    .set({ status, ...extra })
    .where(
      and(
        eq(appointmentsTable.id, appointment.id),
        eq(appointmentsTable.status, appointment.status),
      ),
    )
    .returning();

  if (!updated) {
    throw conflict("This session was just updated. Reopen it and try again.");
  }

  return updated;
}

router.get(
  "/appointments/:appointmentId/ics",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const row = await loadOwnAppointment(
      req.params["appointmentId"] as string,
      auth.user.id,
    );

    const viewerRole =
      row.appointment.clientId === auth.user.id ? "client" : "practitioner";

    const file: CalendarFile = {
      filename: icsFilename(row.appointment),
      contentType: "text/calendar",
      content: buildIcs({
        appointment: row.appointment,
        clientName: row.client.fullName,
        practitionerName: row.practitioner.fullName,
        viewerRole,
      }),
    };

    res.json(file);
  }),
);

export default router;
