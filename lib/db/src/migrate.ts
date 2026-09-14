import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Applies the committed SQL migrations in `lib/db/migrations`, then the
 * constraints Drizzle cannot express. Run as Railway's pre-deploy command so
 * the schema is ready before the new server starts.
 */
async function main(): Promise<void> {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (or DIRECT_DATABASE_URL) must be set.");

  const ssl =
    process.env.DATABASE_SSL === "true" || /\bsslmode=/.test(url)
      ? { rejectUnauthorized: true }
      : undefined;
  const pool = new pg.Pool({ connectionString: url, max: 1, ssl });
  const db = drizzle(pool);

  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "migrations",
  );
  await migrate(db, { migrationsFolder });

  const { applyDatabaseConstraintsWith } = await import("./bootstrap");
  await applyDatabaseConstraintsWith(db);

  await pool.end();
  console.log("Database migrations applied");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
