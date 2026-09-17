import { defineRailway, github, preserve, project, service } from "railway/iac";

/**
 * Railway infrastructure for Healers Inc: one project, two services built
 * from this repository. Preview with `railway config plan`, apply with
 * `railway config apply`. Secrets are `preserve()`d so they are managed in
 * Railway, never in source.
 */
const repo = "hhumayun/SquigglyCautiousCalculator";
const branch = "claude/jolly-heisenberg-jjxcqh";

export default defineRailway(() => {
  // Express API. Builds from the root Dockerfile; migrations run before each
  // deploy. One replica only: realtime sockets and schedulers are in-process.
  const api = service("api", {
    source: github(repo, { branch }),
    preDeploy: "pnpm --filter @workspace/db run migrate",
    healthcheck: "/api/healthz",
    healthcheckTimeout: 120,
    replicas: 1,
    env: {
      RAILWAY_DOCKERFILE_PATH: "Dockerfile",
      PORT: "8080",
      PUBLIC_API_URL: "https://${{RAILWAY_PUBLIC_DOMAIN}}",
      PAYMENTS_ENABLED: "false",
      PAYMENT_PLATFORM_FEE_BPS: "1000",
      PAYMENT_SUPPORTED_COUNTRIES: "CA,US,GB,AU",
      LOG_LEVEL: "info",
      EMAIL_FROM: "Healers Inc <hello@example.com>",
      DATABASE_URL: preserve(),
      DIRECT_DATABASE_URL: preserve(),
      CLERK_SECRET_KEY: preserve(),
      CLERK_PUBLISHABLE_KEY: preserve(),
    },
  });

  // Expo web export served statically. EXPO_PUBLIC_* are build-time values
  // (see artifacts/healers-app/Dockerfile) and point at the API's public domain.
  const app = service("app", {
    source: github(repo, { branch }),
    healthcheck: "/",
    replicas: 1,
    env: {
      RAILWAY_DOCKERFILE_PATH: "artifacts/healers-app/Dockerfile",
      PORT: "3000",
      EXPO_PUBLIC_API_URL: "https://${{api.RAILWAY_PUBLIC_DOMAIN}}",
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "${{api.CLERK_PUBLISHABLE_KEY}}",
    },
  });

  return project("healers-inc", {
    resources: [api, app],
  });
});
