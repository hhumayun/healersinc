import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * Neon (and most hosted Postgres) require TLS. A local database usually does
 * not speak it, so TLS is only switched on when the URL asks for it or when
 * `DATABASE_SSL=true`. Neon's pooled endpoint also suspends when idle, so the
 * pool stays small and drops idle clients quickly.
 */
function poolConfig(connectionString: string): pg.PoolConfig {
  const wantsSsl =
    process.env.DATABASE_SSL === "true" ||
    /\bsslmode=(require|verify-full|verify-ca)\b/.test(connectionString);
  return {
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(wantsSsl ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}

export const pool = new Pool(poolConfig(process.env.DATABASE_URL));
export const db = drizzle(pool, { schema });

export * from "./schema";
export * from "./bootstrap";
