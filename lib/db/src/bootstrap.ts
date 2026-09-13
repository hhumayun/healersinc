import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Database guarantees that Drizzle's schema DSL cannot express.
 *
 * The exclusion constraint is the real defence against double-booking: two
 * concurrent transactions can both pass an application-level availability
 * check, but only one of them can commit an overlapping range for the same
 * practitioner. It is defined over the buffered block range, so a
 * practitioner's before/after buffers are enforced by Postgres too.
 *
 * Safe to run repeatedly; `drizzle-kit push` does not drop it.
 */
export async function applyDatabaseConstraints(): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS btree_gist`);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap'
      ) THEN
        ALTER TABLE appointments
          ADD CONSTRAINT appointments_no_overlap
          EXCLUDE USING gist (
            practitioner_id WITH =,
            tstzrange(block_starts_at, block_ends_at) WITH &&
          )
          WHERE (status IN ('pending', 'confirmed'));
      END IF;
    END
    $$;
  `);
}

/** Postgres error code raised when the exclusion constraint rejects a write. */
export const EXCLUSION_VIOLATION = "23P01";
