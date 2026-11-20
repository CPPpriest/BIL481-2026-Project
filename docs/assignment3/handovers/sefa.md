# Handover — API Gateway, Perimeter Security & Release Orchestration (Ahmet Sefa Efendioğlu)

| Field | Detail |
| :--- | :--- |
| **Author** | Ahmet Sefa Efendioğlu (241101066) — `@Sefa-Efendioglu` |
| **Component** | `apps/api-gateway/**`, `compose.yaml`, `tests/contracts/fixtures/query-{invalid-params,unauthorized}.json`, `docs/assignment3/{Deployment_Plan,Test_Results_Report}.md`, `docs/QA_Plan.md` |
| **For** | Murat Can Işık (`mcp-server` / `shared` / `Design_Document` / `traceability`), Arda Çelik (`connectors` / `redis`), Yunus Emre Biçer (`web` / `Acceptance_Tests_and_Criteria`) |
| **Version / Date** | 1.0, 20 November 2026 |
| **Branch / Base SHA** | `feat/pa3-gateway-release` over `dev` @ `6ae34efe458605cb5b92567b72389b77dfef3274` |

---

## 1. API Contract v1.1 §8 Confirmations (Owner: Sefa)

All three open items assigned to Sefa in API Contract v1.1 §8 are implemented as specified:

- **Q4 (`AGENT_STREAM_URL`):** Gateway `POST /api/v1/chat/stream` proxies `{ "message": "<trimmed>" }` to `POST ${AGENT_STREAM_URL}` (default `http://localhost:3001/internal/agent/stream`, Compose `http://mcp-server:3001/internal/agent/stream`), passes verified `X-Authenticated-Student-Id` and `X-Authenticated-User-Role` headers (never raw `Authorization`), and streams Contract §3.3 SSE frames (`tool`, `token`, `done`, `error`).
- **Q5 (Browser origin / no CORS):** No CORS headers are added to `apps/api-gateway` because `apps/web/next.config.ts` rewrites `/api/v1/*` server-side to `GATEWAY_URL`.
- **Q6 (`GATEWAY_PORT=3000`):** `apps/api-gateway/src/index.ts` now reads `process.env.GATEWAY_PORT || process.env.PORT || 3000`, resolving the previous `PORT=4000` mismatch with `.env.example`.

---

## 2. Implemented Gateway Endpoints & Behavior

| Endpoint | Behavior Implemented | Error Format |
| :--- | :--- | :--- |
| `GET /health` | Returns `{ status: "UP", service: "api-gateway", timestamp }`; exempt from rate limiting | — |
| `POST /api/v1/auth/mock-login` | Validates `{ studentId, name, email, role? }`, issues HS256 JWT (`MOCK_SSO_ISSUER` default `campus-mock-sso`, matching `.env.example`), returns `{ token, user, expiresIn: 3600 }` | Contract §3.4 `400 INVALID_PARAMS` |
| `GET /api/v1/auth/me` | Returns verified `authContext` or rejects guest | Contract §3.4 `401 AUTHENTICATION_REQUIRED` |
| `POST /api/v1/query` | **Real HTTP JSON-RPC 2.0 proxy** to `POST ${MCP_URL}` (`tools/call`). Rejects `studentId`/`student_id`/`userId` in `parameters` with `400 INVALID_PARAMS` even when authenticated; rejects guest `get_course_schedule` with `401` before calling MCP; rejects empty `{}` domain payloads (allows empty `[]` for `get_course_schedule`); preserves `meta.source`, `meta.isSimulated`, `meta.isStale`, `meta.timestamp`, `meta.durationMs`. | Contract §3.4 (`400`, `401`, `429`, `502`, `503`, `504`, `500`) |
| `POST /api/v1/chat/stream` | Requires verified student JWT on every request; validates `message` (`1..1000` chars) and forbids identity fields in body; hijacks reply and streams SSE from `AGENT_STREAM_URL`; emits safe `event: error` (`AGENT_ERROR`) on post-header failure without token/PII/stack traces; never auto-retries. | Contract §3.4 pre-header; SSE `error` post-header |

### Security & Rate Limiting Guarantees
- Client-supplied `x-authenticated-*` headers are stripped unconditionally on every request.
- Raw `Authorization: Bearer <JWT>` is verified (`alg === 'HS256'`, `timingSafeEqual`, valid `sub`, `role`, `exp > now`, `iss === getMockIssuer()`) and deleted before any internal forwarding.
- `getJwtSecret()` throws if `NODE_ENV=production` and `JWT_SECRET` is unset.
- Rate limiter (`30 req / 60s` per `studentId` or guest `clientIp`) uses `RedisRateLimiterStore` + dependency-free `RespTcpRedisClient` whenever `REDIS_URL` is set (with safe in-memory fallback on Redis outage), returning `429 RATE_LIMITED` + `Retry-After`.

---

## 3. Verified vs. Blocked Status

- **Verified locally (`dev` @ `6ae34ef` + Sefa branch edits):**
  - `npm run clean --workspace @campus-orchestrator/web && npm run build` → 5/5 workspaces built.
  - `npx vitest run` → 19 files / 217 tests passed (`25` new/updated tests across `apps/api-gateway/tests/`).
  - `node apps/api-gateway/scripts/run-acceptance-harness.mjs --mode=stub-self-test` → 12/12 gateway checks passed against in-process stubs.
  - **Docker (`29.9.3`) & Compose (`v5.7.0`):** `docker compose -f compose.yaml config --quiet` passed; `apps/api-gateway/Dockerfile` built `campus-api-gateway:local` (non-root `USER node`); live `api-gateway` + `redis:7-alpine` smoke passed (`HEALTHCHECK=healthy`, internal-only Redis with zero host ports, 30 allowed / 31st `429 RATE_LIMITED`, Redis `ZCARD=30`). Evidence: `docs/assignment3/evidence/deployment/gateway-docker-redis-smoke.txt`.
- **Not verified / Blocked:**
  - Full 4-service `docker compose up --build` is still blocked on missing `apps/mcp-server/Dockerfile` (`M-13`) and unmerged `PR #18` (`apps/web/Dockerfile`).
  - `AT-01`..`AT-04` are all `NOT RUN (BLOCKED)`.

---

## 4. What Sefa Needs from Each Teammate to Unblock E2E & Compose

1. **From Murat (`M-02`, `M-04`..`M-08`, `M-13`):**
   - Replace `registerSampleMockHandlers` in `apps/mcp-server/src/index.ts` with Arda's real connector runtime.
   - Implement `AgentOrchestrator.executePlan()`, Gemini adapter (`GEMINI_API_KEY` from env), PII scrubber, and `POST /internal/agent/stream` returning Contract §3.3 SSE frames (`tool`, `token`, `done`, `error`) and trusting gateway-injected `X-Authenticated-Student-Id` / `X-Authenticated-User-Role`.
   - Deliver `apps/mcp-server/Dockerfile` listening on `MCP_SERVER_PORT=3001` with `GET /health`.
2. **From Arda (`A-02`, `A-12`, `Q3`):**
   - Wire `RedisCacheStore` to a real Redis client driven by `REDIS_URL` in `packages/connectors` runtime bootstrap.
   - Confirm `CONNECTOR_FIXED_NOW` support (Contract §8 Q3) and provide Redis verification/seed handover notes for `Deployment_Plan.md`.
3. **From Yunus (`PR #18`, `PR #20`, `Y-07`):**
   - Merge `PR #18` (`feat/pa3-web-docker`: `apps/web/Dockerfile` & `/healthz`) and `PR #20` (`feat/pa3-web-auth`) to `dev`.
   - Complete `Y-07` chat UI wiring against `POST /api/v1/chat/stream`.
   - Review `docs/assignment3/Deployment_Plan.md` and `docs/assignment3/Test_Results_Report.md` (and note Sefa's gateway `MOCK_SSO_ISSUER` default is `campus-mock-sso` matching `.env.example`).
