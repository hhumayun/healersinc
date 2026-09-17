#
# Expo web build for Railway (or any container host).
#
# Select this file for the app service with RAILWAY_DOCKERFILE_PATH; the
# build context is still the repository root so the workspace packages the
# app imports (`lib/*`, `artifacts/healers-inc`) can be installed.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS build
# EXPO_PUBLIC_* values are baked into the bundle, so they must be present at
# build time. Railway passes service variables as build args when declared.
ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV CI=1
ENV EXPO_NO_TELEMETRY=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json tsconfig.json ./
# Every workspace package manifest must be present for the frozen lockfile to
# validate, even though only the app and its dependencies are installed.
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/healers-inc-web/package.json ./artifacts/healers-inc-web/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY scripts/package.json ./scripts/
COPY lib ./lib
COPY artifacts/healers-inc ./artifacts/healers-inc
COPY artifacts/healers-app ./artifacts/healers-app
RUN pnpm install --frozen-lockfile --filter @workspace/healers-app...
RUN test -n "$EXPO_PUBLIC_API_URL" || (echo "EXPO_PUBLIC_API_URL is required at build time" && exit 1)
RUN test -n "$EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY" || (echo "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required at build time" && exit 1)
RUN pnpm --filter @workspace/healers-app run build:web

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/artifacts/healers-app/web-build ./artifacts/healers-app/web-build
COPY --from=build /app/artifacts/healers-app/server/serve-web.js ./artifacts/healers-app/server/serve-web.js

# serve-web.js honours PORT (Railway injects it) and falls back to 3000.
EXPOSE 3000
CMD ["node", "artifacts/healers-app/server/serve-web.js"]
