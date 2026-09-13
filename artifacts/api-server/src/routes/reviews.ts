import { Router, type IRouter } from "express";
import { avg, count, eq } from "drizzle-orm";
import {
  appointmentsTable,
  db,
  practitionerProfilesTable,
  reviewsTable,
} from "@workspace/db";
import { CreateReviewBody } from "@workspace/api-zod";
import { requireRole } from "../lib/auth";
import { conflict, forbidden, handler, notFound } from "../lib/errors";
import { toReview } from "../lib/serializers";
import { notify } from "../lib/notifications";

const router: IRouter = Router();

/** Recompute the denormalised rating the search screen sorts on. */
async function refreshRatingAggregate(practitionerId: string): Promise<void> {
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

router.post(
  "/reviews",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "client");
    const body = CreateReviewBody.parse(req.body);

    const [appointment] = await db
      .select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, body.appointmentId))
      .limit(1);

    if (!appointment) throw notFound("We could not find that session.");
    if (appointment.clientId !== auth.user.id) {
      throw forbidden("You can only review your own sessions.");
    }
    if (appointment.status !== "completed") {
      throw conflict("You can leave a review once the session is complete.");
    }

    const existing = await db
      .select({ id: reviewsTable.id })
      .from(reviewsTable)
      .where(eq(reviewsTable.appointmentId, appointment.id))
      .limit(1);

    if (existing.length > 0) {
      throw conflict("You have already reviewed this session.");
    }

    const [review] = await db
      .insert(reviewsTable)
      .values({
        appointmentId: appointment.id,
        clientId: auth.user.id,
        practitionerId: appointment.practitionerId,
        rating: body.rating,
        comment: body.comment ?? null,
      })
      .returning();

    if (!review) throw conflict("We could not save that review.");

    await refreshRatingAggregate(appointment.practitionerId);

    await notify({
      userId: appointment.practitionerId,
      type: "review_received",
      title: `${body.rating}-star review`,
      body: `${auth.user.fullName} reviewed your ${appointment.serviceName}.`,
      appointmentId: appointment.id,
    });

    res.status(201).json(
      toReview({
        review,
        client: auth.user,
        serviceName: appointment.serviceName,
      }),
    );
  }),
);

export default router;
