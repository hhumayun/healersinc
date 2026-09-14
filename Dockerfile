# syntax=docker/dockerfile:1.7
#
# API server image for Railway (or any container host).
#
# The whole pnpm workspace is installed so the bundler can resolve the shared
# `lib/*` packages; only the compiled API bundle is executed at runtime.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json tsconfig.json ./
# Every workspace package manifest must be present for the frozen lockfile to
# validate, even though only the API server and its dependencies are installed.
COPY artifacts/healers-app/package.json ./artifacts/healers-app/
COPY artifacts/healers-inc/package.json ./artifacts/healers-inc/
COPY artifacts/healers-inc-web/package.json ./artifacts/healers-inc-web/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib ./lib
COPY scripts ./scripts
COPY artifacts/api-server ./artifacts/api-server
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile \
      --filter @workspace/api-server... \
      --filter @workspace/db \
      --filter ./scripts
RUN pnpm --filter @workspace/api-server run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/lib ./lib
COPY --from=build /app/artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY --from=build /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/api-server/public ./artifacts/api-server/public

# Railway injects PORT; the server refuses to start without it.
EXPOSE 8080
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
