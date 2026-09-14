import { Router, type IRouter } from "express";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { clerkUserToProfile, clerkWebhookSigningSecret } from "../lib/clerk";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Keeps the mirrored profile fields in step with Clerk. Account creation is
 * handled lazily on first API call, so `user.created` is only used to
 * pre-provision; `user.updated` refreshes email/name/avatar and
 * `user.deleted` cascades the local account away.
 */
router.post("/webhooks/clerk", async (req, res): Promise<void> => {
  if (!clerkWebhookSigningSecret) {
    res.status(404).json({ error: "not_found", message: "Webhook not configured." });
    return;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  const request = new Request(`http://localhost${req.originalUrl}`, {
    method: "POST",
    headers,
    body: req.body as Buffer,
  });

  let event;
  try {
    event = await verifyWebhook(request, { signingSecret: clerkWebhookSigningSecret });
  } catch (err) {
    req.log.warn({ err }, "Clerk webhook rejected");
    res.status(400).json({ error: "invalid_webhook", message: "Webhook rejected." });
    return;
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const data = event.data;
        const profile = clerkUserToProfile({
          id: data.id,
          emailAddresses: data.email_addresses.map((e) => ({
            id: e.id,
            emailAddress: e.email_address,
          })),
          primaryEmailAddressId: data.primary_email_address_id,
          firstName: data.first_name,
          lastName: data.last_name,
          imageUrl: data.image_url,
          hasImage: data.has_image,
        });
        await db
          .insert(usersTable)
          .values({
            clerkUserId: data.id,
            email: profile.email,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
          })
          .onConflictDoUpdate({
            target: usersTable.clerkUserId,
            set: { email: profile.email, fullName: profile.fullName },
          });
        break;
      }
      case "user.deleted": {
        if (event.data.id) {
          await db.delete(usersTable).where(eq(usersTable.clerkUserId, event.data.id));
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "Clerk webhook handling failed");
    res.status(500).json({ error: "webhook_failed", message: "Could not process event." });
    return;
  }

  res.json({ received: true });
});

export default router;
