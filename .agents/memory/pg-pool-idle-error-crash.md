---
name: Postgres pool idle-client crash
description: The shared pg Pool has no 'error' listener, so a dropped idle connection (such as a Neon compute restart) crashes the API process.
---

`lib/db/src/index.ts` creates the shared `pool` without a `pool.on("error", …)` handler. When the database drops a connection that is sitting idle in the pool, pg-pool re-emits that error on the Pool. With no listener, Node treats it as an unhandled `'error'` event and the whole API process exits. Idle clients are kept for up to 30 s (`idleTimeoutMillis: 30_000`), so a compute restart, maintenance restart or network drop inside that window can take the server down.

**Why:** On 2026-10-17 at 09:59:58 UTC Neon restarted the production compute, and the Railway `api` service crashed with `Error: Connection terminated unexpectedly`, followed by `Emitted 'error' event on BoundPool instance at: Client.idleListener` (pg 8.22.0, pg-pool 3.14.0). The process came straight back up after a restart, so the only trace was the stack dump in the deploy log.

**How to apply:** Attach an error listener right after the pool is created, for example `pool.on("error", (err) => console.warn("Idle Postgres client error", err))`, or register one with the API logger on the exported `pool`. pg-pool has already removed the broken client by the time it emits, so logging is enough and the next query opens a fresh connection. Do the same for any other long-lived `pg.Pool` or standalone `pg.Client`.

Related: while the `api` service runs, the appointment reminder scheduler (`TICK_INTERVAL_MS = 60_000` in `artifacts/api-server/src/lib/reminders.ts`) queries the database every minute, so the Neon compute never reaches its 5-minute autosuspend. It ran nonstop from 2026-09-17 to 2026-10-17 this way. The refund worker also polls every 60 s when payments are enabled. Gate or slow both before redeploying.
