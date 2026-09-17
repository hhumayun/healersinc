# Healers Inc

A two-sided marketplace where clients discover and book practitioners across
mind, body, spirit and psychology. Expo mobile app + Express API, deployed on
Neon (Postgres), Railway (servers) and Clerk (auth).

## Run & Operate

- `pnpm install` — install the workspace (pnpm 10, Node 24)
- `pnpm --filter @workspace/db run migrate` — apply committed SQL migrations
- `pnpm --filter @workspace/db run generate` — write a new migration after a schema change
- `pnpm --filter @workspace/api-server run dev` — build and run the API server
- `pnpm --filter @workspace/api-server run seed` — load demo practitioners (demo rows only; they cannot sign in)
- `pnpm --filter @workspace/healers-app run dev` — Expo dev server for the mobile app
- `pnpm --filter @workspace/healers-app run build:web` — static web export of the app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Copy `.env.example` to `.env` for the full list of environment variables.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, WebSocket realtime at `/api/ws`
- DB: Neon Postgres + Drizzle ORM, migrations in `lib/db/migrations`
- Auth: Clerk (`@clerk/clerk-expo` on the device, `@clerk/backend` on the API)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle), Docker image for Railway

## Where things live

- `artifacts/api-server` — Express API. Entry `src/index.ts`, routes in `src/routes`.
- `artifacts/healers-app` — Expo Router mobile app (iOS, Android, web).
- `artifacts/healers-inc-web` — marketing site (Vite). No API calls.
- `artifacts/healers-inc`, `artifacts/mockup-sandbox` — design-system previews, dev only.
- `lib/db/src/schema` — Drizzle schema, the source of truth for the database.
- `lib/api-spec/openapi.yaml` — API contract; generated client in `lib/api-client-react`, Zod in `lib/api-zod`.
- `lib/scheduling` — timezone-aware slot generation.
- `.railway/railway.ts` — Railway infrastructure as code: both services, their build/deploy settings and non-secret variables.
- `Dockerfile` — API service image. `artifacts/healers-app/Dockerfile`, `server/serve-web.js` — Expo web image.

## Deployment

### Neon

1. Create a project and a database. Copy both connection strings.
2. `DATABASE_URL` = the **pooled** string (host contains `-pooler`), used by the API.
3. `DIRECT_DATABASE_URL` = the direct string, used only by migrations.
4. Both must include `?sslmode=require`. The `btree_gist` extension is created by the migration runner.

### Clerk

1. Create an application with email + password enabled and email verification by code.
2. API service env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`.
3. Expo build env: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
4. Webhooks → add endpoint `https://<api-domain>/api/webhooks/clerk` subscribed to
   `user.created`, `user.updated`, `user.deleted`; set its signing secret as
   `CLERK_WEBHOOK_SIGNING_SECRET`.

How it fits together: the device signs in with Clerk and sends the Clerk
session JWT as a bearer token. The API verifies it, then looks up (or creates
on first call) the matching row in `users` by `clerk_user_id`. Roles, the
practitioner onboarding wizard and profiles stay in this database; passwords,
sessions and email verification live in Clerk.

### Railway

Both services are declared in `.railway/railway.ts` (Railway's
infrastructure-as-code) and build from this repository with the root as the
build context; `RAILWAY_DOCKERFILE_PATH` picks the Dockerfile per service.

1. `railway login`, then `railway init --name healers-inc` (or `railway link`
   to an existing project).
2. Set the secrets once, on the `api` service (they are `preserve()`d in code,
   never committed): `DATABASE_URL`, `DIRECT_DATABASE_URL`, `CLERK_SECRET_KEY`,
   `CLERK_PUBLISHABLE_KEY`, and later `CLERK_WEBHOOK_SIGNING_SECRET`.
   `echo "<value>" | railway variable set KEY --stdin --service api --skip-deploys`
3. `railway config plan`, then `railway config apply`.
4. `railway domain --service api --port 8080` and
   `railway domain --service app --port 3000` create the public domains.
   `PUBLIC_API_URL` and `EXPO_PUBLIC_API_URL` derive from the API's domain via
   Railway variable references, so nothing else needs editing.

Services:

1. **api** — root `Dockerfile`. The pre-deploy command runs migrations and the
   health check is `/api/healthz`. Keep it at **one replica**: realtime
   sockets and the reminder/refund schedulers are in-process.
2. **app** — `artifacts/healers-app/Dockerfile` exports the Expo web build
   with `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` as build
   args and serves it with `server/serve-web.js`.

Native builds (iOS/Android) use EAS or `expo run:*` with the same
`EXPO_PUBLIC_*` variables.

## Architecture decisions

- `lib/db/src/schema/` is the schema source of truth. Changes are shipped as
  committed migrations (`pnpm --filter @workspace/db run generate`) and applied
  by `lib/db/src/migrate.ts` before the API starts. `drizzle-kit push` remains
  available for throwaway local databases only. Do not mix application
  migrations with StripeSync's separate managed `stripe`-schema migrations.
- Authorization is derived server-side from `users.active_role`; the client
  never declares its role. Switching portals is `POST /api/auth/switch-role`.
- Native Stripe Checkout returns through fixed API handlers into the
  `healers-app://` scheme. Expo web Checkout uses `PAYMENT_WEB_RETURN_BASE_URL`.

## Gotchas

- The API refuses to start without `CLERK_SECRET_KEY`, `DATABASE_URL` and `PORT`.
- Clerk session tokens are short-lived; the WebSocket client fetches a fresh
  one on every reconnect, and the fetch layer asks Clerk for one per request.
- Seeded accounts have synthetic Clerk ids and cannot be signed into. Create
  real accounts through the app.
