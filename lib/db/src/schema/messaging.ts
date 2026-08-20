import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Exactly one thread per (client, practitioner) pair — the unique index is what
 * prevents duplicate conversations when both sides open a chat at once.
 */
export const conversationsTable = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    practitionerId: uuid("practitioner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessagePreview: text("last_message_preview"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("conversations_pair_unique").on(
      table.clientId,
      table.practitionerId,
    ),
    index("conversations_client_idx").on(table.clientId),
    index("conversations_practitioner_idx").on(table.practitionerId),
  ],
);

export type Conversation = typeof conversationsTable.$inferSelect;
export type InsertConversation = typeof conversationsTable.$inferInsert;

export const messagesTable = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_conversation_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = typeof messagesTable.$inferInsert;

export const userBlocksTable = pgTable(
  "user_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_blocks_unique").on(table.blockerId, table.blockedId),
  ],
);

export type UserBlock = typeof userBlocksTable.$inferSelect;
export type InsertUserBlock = typeof userBlocksTable.$inferInsert;

export const userReportsTable = pgTable(
  "user_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    reportedId: uuid("reported_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("user_reports_reported_idx").on(table.reportedId)],
);

export type UserReport = typeof userReportsTable.$inferSelect;
export type InsertUserReport = typeof userReportsTable.$inferInsert;
