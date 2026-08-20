import { db, notificationsTable } from "@workspace/db";
import type { NotificationType } from "./notification-types";
import { toNotification } from "./serializers";
import { publishToUser } from "./realtime";
import { logger } from "./logger";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  appointmentId?: string;
  conversationId?: string;
}

/**
 * Writes a notification-centre entry and pushes it down any open socket, so
 * the badge updates without the app having to poll.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const data: Record<string, string> = {};
  if (input.appointmentId) data["appointmentId"] = input.appointmentId;
  if (input.conversationId) data["conversationId"] = input.conversationId;

  try {
    const [row] = await db
      .insert(notificationsTable)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data,
      })
      .returning();

    if (row) {
      publishToUser(input.userId, {
        type: "notification.created",
        notification: toNotification(row),
      });
    }
  } catch (err) {
    // A missing notification must never fail the action that triggered it.
    logger.error({ err, userId: input.userId }, "Failed to record notification");
  }
}
