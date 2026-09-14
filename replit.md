# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/healers-inc-web run dev` — run the marketing site
  and client web app. It calls the API at same-origin `/api/...`; set
  `VITE_API_BASE_URL` only to point it at an API on another origin.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- `lib/db/src/schema/` is the application schema source of truth. Development
  and post-merge setup use Drizzle `push`; production schema diffs are applied
  by Replit Publish before the new application starts. Do not run application
  schema pushes at API startup or mix them with StripeSync's separate managed
  `stripe`-schema migrations.
- Native Stripe Checkout returns through fixed API handlers into the
  `healers-app://` scheme. Expo web Checkout uses the server-allowlisted
  `PAYMENT_WEB_RETURN_BASE_URL`; development automatically uses
  `REPLIT_EXPO_DEV_DOMAIN`. Checkout started from the website
  (`returnTarget: "site"`) returns to `PAYMENT_SITE_RETURN_BASE_URL`, or to
  `REPLIT_DOMAINS` plus `PAYMENT_SITE_RETURN_BASE_PATH` (default
  `/healers-inc-web/`) when that is unset. Every browser destination is
  composed server-side in `paymentReturnUrls.ts`; callers only name which
  target they want, never a URL.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
