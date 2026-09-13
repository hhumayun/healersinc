import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { MarkNotificationsReadBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { handler } from "../lib/errors";
import { toNotification } from "../lib/serializers";

const router: IRouter = Router();

router.get(
  "/notifications",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, auth.user.id))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(100);

    res.json(rows.map(toNotification));
  }),
);

router.post(
  "/notifications/read",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const body = MarkNotificationsReadBody.parse(req.body ?? {});

    // No ids means "mark everything read", which is what the bell icon does.
    const scope = body.ids?.length
      ? and(
          eq(notificationsTable.userId, auth.user.id),
          inArray(notificationsTable.id, body.ids),
          isNull(notificationsTable.readAt),
        )
      : and(
          eq(notificationsTable.userId, auth.user.id),
          isNull(notificationsTable.readAt),
        );

    await db.update(notificationsTable).set({ readAt: new Date() }).where(scope);
    res.status(204).end();
  }),
);

export default router;
