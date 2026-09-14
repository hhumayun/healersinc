import { defineConfig } from "drizzle-kit";
import path from "path";

/**
 * Schema tooling talks to the database directly. On Neon, `DIRECT_DATABASE_URL`
 * should be the non-pooled endpoint (DDL and advisory locks do not go through
 * PgBouncer well); the application itself uses the pooled `DATABASE_URL`.
 */
const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL (or DIRECT_DATABASE_URL) must be set.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: { url },
});
