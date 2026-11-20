# syntax=docker/dockerfile:1
#
# Web client (Next.js) image for the Campus Data Orchestrator demo stack.
#
# Build from the REPOSITORY ROOT (the image needs the root lockfile and
# packages/shared):
#
#   docker build -f apps/web/Dockerfile -t campus-web \
#     --build-arg GATEWAY_URL=http://api-gateway:3000 .
#
# Run:
#
#   docker run --rm -p 3002:3002 campus-web
#
# Build arguments (both are baked into the build by Next.js, so changing them
# requires a rebuild, not just a different runtime environment):
#   GATEWAY_URL                  where /api/v1/* is forwarded (API Contract v1.1 §7)
#   NEXT_PUBLIC_WEB_DATA_SOURCE  "gateway" (default) or "fixtures" (local example data, banner shown)

ARG NODE_IMAGE=node:24-alpine

# ---- 1. Install dependencies (only the workspaces the web app needs) ----
FROM ${NODE_IMAGE} AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /repo
# npm needs every workspace manifest that the lockfile lists.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/connectors/package.json packages/connectors/
COPY apps/web/package.json apps/web/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/mcp-server/package.json apps/mcp-server/
RUN npm ci --workspace @campus-orchestrator/shared --workspace @campus-orchestrator/web --no-audit --no-fund

# ---- 2. Build shared types, then the Next.js standalone server ----
FROM ${NODE_IMAGE} AS build
WORKDIR /repo
ARG GATEWAY_URL=http://api-gateway:3000
ARG NEXT_PUBLIC_WEB_DATA_SOURCE=gateway
ENV GATEWAY_URL=${GATEWAY_URL} \
    NEXT_PUBLIC_WEB_DATA_SOURCE=${NEXT_PUBLIC_WEB_DATA_SOURCE} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @campus-orchestrator/shared \
 && npm run build --workspace @campus-orchestrator/web

# ---- 3. Minimal runtime image ----
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 web && adduser -S -u 1001 -G web web
# The standalone output mirrors the monorepo layout: the server lives in apps/web/.
COPY --from=build --chown=web:web /repo/apps/web/.next/standalone ./
COPY --from=build --chown=web:web /repo/apps/web/.next/static ./apps/web/.next/static
USER web
EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3002/healthz > /dev/null || exit 1
CMD ["node", "apps/web/server.js"]
