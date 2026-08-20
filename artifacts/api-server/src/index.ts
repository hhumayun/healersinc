import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { applyDatabaseConstraints } from "@workspace/db";
import { attachRealtime } from "./lib/realtime";
import { startReminderScheduler } from "./lib/reminders";
import { emailProviderConfigured } from "./lib/email";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main(): Promise<void> {
  // The double-booking guarantee lives in the database, so it has to exist
  // before the server accepts a single request.
  await applyDatabaseConstraints();

  const server = createServer(app);
  attachRealtime(server);

  server.listen(port, () => {
    logger.info({ port }, "Server listening");
    if (!emailProviderConfigured) {
      logger.warn(
        "No email provider is configured — verification codes and reminders will be written to this log instead of being sent.",
      );
    }
    startReminderScheduler();
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
