# syntax=docker/dockerfile:1
#
# Fastify API Gateway image for Campus Data Orchestrator.
#
# Build from the REPOSITORY ROOT:
#   docker build -f apps/api-gateway/Dockerfile -t campus-api-gateway .
#
# Run:
#   docker run --rm -p 3000:3000 --env-file .env campus-api-gateway

ARG NODE_IMAGE=node:24-alpine

# ---- 1. Install workspace dependencies needed for building shared + api-gateway ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/connectors/package.json packages/connectors/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/mcp-server/package.json apps/mcp-server/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @campus-orchestrator/shared --workspace @campus-orchestrator/api-gateway --no-audit --no-fund

# ---- 2. Build shared types and the Fastify gateway ----
FROM ${NODE_IMAGE} AS build
WORKDIR /repo
COPY --from=deps /repo ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api-gateway apps/api-gateway
RUN npm run build --workspace @campus-orchestrator/shared \
 && npm run build --workspace @campus-orchestrator/api-gateway

# ---- 3. Install production-only dependencies for runtime ----
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/connectors/package.json packages/connectors/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/mcp-server/package.json apps/mcp-server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @campus-orchestrator/shared --workspace @campus-orchestrator/api-gateway --no-audit --no-fund

# ---- 4. Minimal non-root runtime image ----
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    GATEWAY_PORT=3000 \
    HOST=0.0.0.0

COPY --from=prod-deps --chown=node:node /repo/package.json /repo/package-lock.json ./
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/shared/package.json ./packages/shared/
COPY --from=build --chown=node:node /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /repo/apps/api-gateway/package.json ./apps/api-gateway/
COPY --from=build --chown=node:node /repo/apps/api-gateway/dist ./apps/api-gateway/dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1

CMD ["node", "apps/api-gateway/dist/index.js"]
