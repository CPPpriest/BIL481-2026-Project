# syntax=docker/dockerfile:1
#
# MCP Server image for Campus Data Orchestrator (tools + connector runtime).
#
# Build from the REPOSITORY ROOT:
#   docker build -f apps/mcp-server/Dockerfile -t campus-mcp-server .
#
# Run (internal service, do NOT publish this port publicly - see apps/mcp-server/README.md):
#   docker run --rm -p 127.0.0.1:3001:3001 --env-file .env campus-mcp-server

ARG NODE_IMAGE=node:24-alpine

# ---- 1. Install workspace dependencies needed for building shared + connectors + mcp-server ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/connectors/package.json packages/connectors/
COPY apps/mcp-server/package.json apps/mcp-server/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @campus-orchestrator/shared --workspace @campus-orchestrator/connectors --workspace @campus-orchestrator/mcp-server --no-audit --no-fund

# ---- 2. Build shared types, connectors and the MCP server (order matters) ----
FROM ${NODE_IMAGE} AS build
WORKDIR /repo
COPY --from=deps /repo ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/connectors packages/connectors
COPY apps/mcp-server apps/mcp-server
RUN npm run build --workspace @campus-orchestrator/shared \
 && npm run build --workspace @campus-orchestrator/connectors \
 && npm run build --workspace @campus-orchestrator/mcp-server

# ---- 3. Install production-only dependencies for runtime ----
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/connectors/package.json packages/connectors/
COPY apps/mcp-server/package.json apps/mcp-server/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @campus-orchestrator/shared --workspace @campus-orchestrator/connectors --workspace @campus-orchestrator/mcp-server --no-audit --no-fund

# ---- 4. Minimal non-root runtime image ----
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    MCP_SERVER_PORT=3001

COPY --from=prod-deps --chown=node:node /repo/package.json /repo/package-lock.json ./
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/shared/package.json ./packages/shared/
COPY --from=build --chown=node:node /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /repo/packages/connectors/package.json ./packages/connectors/
COPY --from=build --chown=node:node /repo/packages/connectors/dist ./packages/connectors/dist
COPY --from=build --chown=node:node /repo/apps/mcp-server/package.json ./apps/mcp-server/
COPY --from=build --chown=node:node /repo/apps/mcp-server/dist ./apps/mcp-server/dist

USER node
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health > /dev/null || exit 1

CMD ["node", "apps/mcp-server/dist/index.js"]
