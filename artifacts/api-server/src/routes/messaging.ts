import { Router, type IRouter } from "express";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  conversationsTable,
  db,
  messagesTable,
  practitionerProfilesTable,
  userBlocksTable,
  userReportsTable,
  usersTable,
  type Conversation,
  type User,
} from "@workspace/db";
import {
  ListMessagesQueryParams,
  OpenConversationBody,
  ReportUserBody,
  SendMessageBody,
  SetUserBlockBody,
  type Conversation as ConversationDto,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";
import { badRequest, forbidden, handler, notFound } from "../lib/errors";
import { optionalInstant } from "../lib/query.js";
import { toConversation, toMessage } from "../lib/serializers";
import { notify } from "../lib/notifications";
import { publishToUser } from "../lib/realtime";

const router: IRouter = Router();

const MESSAGE_PREVIEW_LENGTH = 120;

/** Which user ids the viewer has blocked, and who has blocked the viewer. */
async function loadBlocks(viewerId: string): Promise<{
  blockedByMe: Set<string>;
  blockedByThem: Set<string>;
}> {
  const rows = await db
    .select()
    .from(userBlocksTable)
    .where(
      or(
        eq(userBlocksTable.blockerId, viewerId),
        eq(userBlocksTable.blockedId, viewerId),
      ),
    );

  const blockedByMe = new Set<string>();
  const blockedByThem = new Set<string>();

  for (const row of rows) {
    if (row.blockerId === viewerId) blockedByMe.add(row.blockedId);
    else blockedByThem.add(row.blockerId);
  }

  return { blockedByMe, blockedByThem };
}

async function loadUnreadCounts(
  viewerId: string,
  conversationIds: string[],
): Promise<Map<string, number>> {
  if (conversationIds.length === 0) return new Map();

  const rows = await db
    .select({ conversationId: messagesTable.conversationId, value: count() })
    .from(messagesTable)
    .where(
      and(
        inArray(messagesTable.conversationId, conversationIds),
        ne(messagesTable.senderId, viewerId),
        isNull(messagesTable.readAt),
      ),
    )
    .groupBy(messagesTable.conversationId);

  return new Map(rows.map((row) => [row.conversationId, row.value]));
}

const otherUser = alias(usersTable, "conversation_other_user");

async function loadOwnConversation(
  conversationId: string,
  viewerId: string,
): Promise<{ conversation: Conversation; other: User; otherHeadline: string | null }> {
  const [row] = await db
    .select({
      conversation: conversationsTable,
      client: usersTable,
      practitioner: otherUser,
      practitionerHeadline: practitionerProfilesTable.headline,
    })
    .from(conversationsTable)
    .innerJoin(usersTable, eq(usersTable.id, conversationsTable.clientId))
    .innerJoin(otherUser, eq(otherUser.id, conversationsTable.practitionerId))
    .leftJoin(
      practitionerProfilesTable,
      eq(practitionerProfilesTable.userId, conversationsTable.practitionerId),
    )
    .where(eq(conversationsTable.id, conversationId))
    .limit(1);

  if (!row) throw notFound("We could not find that conversation.");

  if (
    row.conversation.clientId !== viewerId &&
    row.conversation.practitionerId !== viewerId
  ) {
    throw forbidden("This conversation is not yours.");
  }

  const viewerIsClient = row.conversation.clientId === viewerId;

  return {
    conversation: row.conversation,
    other: viewerIsClient ? row.practitioner : row.client,
    otherHeadline: viewerIsClient ? row.practitionerHeadline : null,
  };
}

router.get(
  "/conversations",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);

    const rows = await db
      .select({
        conversation: conversationsTable,
        client: usersTable,
        practitioner: otherUser,
        practitionerHeadline: practitionerProfilesTable.headline,
      })
      .from(conversationsTable)
      .innerJoin(usersTable, eq(usersTable.id, conversationsTable.clientId))
      .innerJoin(otherUser, eq(otherUser.id, conversationsTable.practitionerId))
      .leftJoin(
        practitionerProfilesTable,
        eq(practitionerProfilesTable.userId, conversationsTable.practitionerId),
      )
      .where(
        or(
          eq(conversationsTable.clientId, auth.user.id),
          eq(conversationsTable.practitionerId, auth.user.id),
        ),
      )
      .orderBy(
        sql`${conversationsTable.lastMessageAt} desc nulls last`,
        desc(conversationsTable.createdAt),
      );

    const unread = await loadUnreadCounts(
      auth.user.id,
      rows.map((row) => row.conversation.id),
    );
    const blocks = await loadBlocks(auth.user.id);

    const conversations: ConversationDto[] = rows.map((row) => {
      const viewerIsClient = row.conversation.clientId === auth.user.id;
      const other = viewerIsClient ? row.practitioner : row.client;

      return toConversation({
        id: row.conversation.id,
        otherParty: other,
        otherPartyHeadline: viewerIsClient ? row.practitionerHeadline : null,
        lastMessageAt: row.conversation.lastMessageAt,
        lastMessagePreview: row.conversation.lastMessagePreview,
        unreadCount: unread.get(row.conversation.id) ?? 0,
        blockedByMe: blocks.blockedByMe.has(other.id),
        blockedByThem: blocks.blockedByThem.has(other.id),
      });
    });

    res.json(conversations);
  }),
);

router.post(
  "/conversations",
  handler(async (req, res) => {
    const auth = requireRole(req.auth, "client");
    const body = OpenConversationBody.parse(req.body);

    if (body.practitionerId === auth.user.id) {
      throw badRequest("You cannot message yourself.");
    }

    const [practitioner] = await db
      .select({ user: usersTable, headline: practitionerProfilesTable.headline })
      .from(usersTable)
      .leftJoin(
        practitionerProfilesTable,
        eq(practitionerProfilesTable.userId, usersTable.id),
      )
      .where(eq(usersTable.id, body.practitionerId))
      .limit(1);

    if (!practitioner?.user.isPractitioner) {
      throw notFound("We could not find that practitioner.");
    }

    // The unique (client, practitioner) pair means reopening a thread is
    // idempotent — clients never end up with duplicates of the same chat.
    const [conversation] = await db
      .insert(conversationsTable)
      .values({ clientId: auth.user.id, practitionerId: body.practitionerId })
      .onConflictDoUpdate({
        target: [conversationsTable.clientId, conversationsTable.practitionerId],
        set: { clientId: auth.user.id },
      })
      .returning();

    if (!conversation) throw badRequest("We could not open that conversation.");

    const blocks = await loadBlocks(auth.user.id);
    const unread = await loadUnreadCounts(auth.user.id, [conversation.id]);

    res.status(201).json(
      toConversation({
        id: conversation.id,
        otherParty: practitioner.user,
        otherPartyHeadline: practitioner.headline,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        unreadCount: unread.get(conversation.id) ?? 0,
        blockedByMe: blocks.blockedByMe.has(practitioner.user.id),
        blockedByThem: blocks.blockedByThem.has(practitioner.user.id),
      }),
    );
  }),
);

router.get(
  "/messages",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const before = optionalInstant(req.query["before"], "before");
    const query = ListMessagesQueryParams.parse({
      ...req.query,
      before: undefined,
    });
    await loadOwnConversation(query.conversationId, auth.user.id);

    // Read the newest page first, then hand it back oldest-first so the client
    // can render it directly. `before` walks backwards through history; `id`
    // breaks ties because several messages can share a timestamp.

    const rows = await db
      .select()
      .from(messagesTable)
      .where(
        before
          ? and(
              eq(messagesTable.conversationId, query.conversationId),
              lt(messagesTable.createdAt, before),
            )
          : eq(messagesTable.conversationId, query.conversationId),
      )
      .orderBy(desc(messagesTable.createdAt), desc(messagesTable.id))
      .limit(query.limit ?? 50);

    res.json(rows.reverse().map((row) => toMessage(row, auth.user.id)));
  }),
);

router.post(
  "/conversations/:conversationId/messages",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const conversationId = req.params["conversationId"] as string;
    const { other } = await loadOwnConversation(conversationId, auth.user.id);

    const body = SendMessageBody.parse(req.body);

    const blocks = await loadBlocks(auth.user.id);
    if (blocks.blockedByMe.has(other.id)) {
      throw forbidden("Unblock this person before sending a message.");
    }
    if (blocks.blockedByThem.has(other.id)) {
      throw forbidden("You can no longer send messages in this conversation.");
    }

    const text = body.body.trim();
    if (!text) throw badRequest("Write something before sending.");

    const [message] = await db
      .insert(messagesTable)
      .values({ conversationId, senderId: auth.user.id, body: text })
      .returning();

    if (!message) throw badRequest("We could not send that message.");

    await db
      .update(conversationsTable)
      .set({
        lastMessageAt: message.createdAt,
        lastMessagePreview: text.slice(0, MESSAGE_PREVIEW_LENGTH),
      })
      .where(eq(conversationsTable.id, conversationId));

    publishToUser(other.id, {
      type: "message.created",
      conversationId,
      message: toMessage(message, other.id),
    });
    publishToUser(auth.user.id, {
      type: "message.created",
      conversationId,
      message: toMessage(message, auth.user.id),
    });

    await notify({
      userId: other.id,
      type: "message_received",
      title: `Message from ${auth.user.fullName}`,
      body: text.slice(0, MESSAGE_PREVIEW_LENGTH),
      conversationId,
    });

    res.status(201).json(toMessage(message, auth.user.id));
  }),
);

router.post(
  "/conversations/:conversationId/read",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const conversationId = req.params["conversationId"] as string;
    const { other } = await loadOwnConversation(conversationId, auth.user.id);

    await db
      .update(messagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messagesTable.conversationId, conversationId),
          ne(messagesTable.senderId, auth.user.id),
          isNull(messagesTable.readAt),
        ),
      );

    publishToUser(other.id, {
      type: "message.read",
      conversationId,
      readerId: auth.user.id,
    });

    res.status(204).end();
  }),
);

router.post(
  "/users/:userId/block",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const userId = req.params["userId"] as string;
    const body = SetUserBlockBody.parse(req.body);

    if (userId === auth.user.id) throw badRequest("You cannot block yourself.");

    if (body.blocked) {
      await db
        .insert(userBlocksTable)
        .values({ blockerId: auth.user.id, blockedId: userId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(userBlocksTable)
        .where(
          and(
            eq(userBlocksTable.blockerId, auth.user.id),
            eq(userBlocksTable.blockedId, userId),
          ),
        );
    }

    res.status(204).end();
  }),
);

router.post(
  "/users/:userId/report",
  handler(async (req, res) => {
    const auth = requireAuth(req.auth);
    const userId = req.params["userId"] as string;
    const body = ReportUserBody.parse(req.body);

    if (userId === auth.user.id) throw badRequest("You cannot report yourself.");

    await db.insert(userReportsTable).values({
      reporterId: auth.user.id,
      reportedId: userId,
      reason: body.reason,
      details: body.details ?? null,
    });

    req.log.warn(
      { reporterId: auth.user.id, reportedId: userId, reason: body.reason },
      "User reported",
    );

    res.status(204).end();
  }),
);

export default router;
