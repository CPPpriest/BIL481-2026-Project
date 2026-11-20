# Deployment Plan

**Campus Data Orchestrator — Model Context Protocol (MCP) Based Campus Data Orchestrator**

| Field | Detail |
| :--- | :--- |
| **Course** | BIL 481 Software Engineering, Fall 2026, TOBB University of Economics and Technology |
| **Assignment** | Project Assignment 3 — Deliverable 1: Deployment Plan |
| **Group Name** | Group-ASYM |
| **Document Lead & Primary Author** | **Ahmet Sefa Efendioğlu** (241101066) — `@Sefa-Efendioglu` |
| **Document Version / Date** | **Version 0.3 (3-Service Compose Stack Verified: `web` + `api-gateway` + `redis`; `mcp-server` Blocked), 20 November 2026** |
| **Repository Filepath** | `docs/assignment3/Deployment_Plan.md` |
| **Inspected Branch & Base SHA** | `feat/pa3-gateway-release` synced with `dev` @ `440efd088c2c2ea6a3523b7d02d7c4d14eca06a2` (`PR #18` & `PR #20` merged) |
| **Related Documents** | `docs/assignment3/contracts/API_CONTRACT.md` (team draft v1.1), `docs/assignment3/Acceptance_Tests_and_Criteria.md`, `docs/assignment3/Test_Results_Report.md`, `docs/QA_Plan.md` |

> **Honest Verification Status (v0.3):** `npm run typecheck --workspace @campus-orchestrator/web`, `tsc` across `shared`/`connectors`/`mcp-server`/`api-gateway`, 230 automated Vitest tests (20 files), the gateway `--mode=stub-self-test` harness, and **real 3-service Docker Compose orchestration (`docker compose -f compose.yaml up --build -d --no-deps redis api-gateway web`)** have all been executed and verified (Docker `29.9.3`, Compose `v5.7.0`). *(Note: Local `next build` on Windows sandbox hit `EPERM: mkdir` during Next.js `output: 'standalone'` file-copy tracing after PR #18, whereas the Linux `node:24-alpine` container build inside `apps/web/Dockerfile` compiled `output: 'standalone'` cleanly.)* **Full 4-service `docker compose up --build` remains BLOCKED** until Murat delivers `apps/mcp-server/Dockerfile` and connector/agent wiring (`M-02`..`M-08`, `M-13`) and Arda confirms `A-02` (see §2.2 and §3.5).

---

## List of Contributors

In compliance with the Project Assignment 3 deliverables specification, contributors and their verified current status for this document are listed on the first page:

| Member Name | Student ID | GitHub Account | Project Role | Contribution to this Document | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ahmet Sefa Efendioğlu** | 241101066 | `@Sefa-Efendioglu` | Gateway, Security & Release Lead | **Lead Author:** Drafted Deployment Overview, Deployment Process, Configuration Plan, `apps/api-gateway/Dockerfile`, `.dockerignore`, `compose.yaml`; verified local tests/stub baseline, live `api-gateway` + `redis:7-alpine` smoke, and 3-service Compose (`web` + `api-gateway` + `redis`) integration & network isolation. | Drafted (v0.3) |
| **Yunus Emre Biçer** | 241101009 | `@YunusEmre113` | Web Client Lead | Delivered `apps/web/Dockerfile`, `/healthz`, standalone build, `apps/web/README.md` (`PR #18`, `dc2da33`), and `/giris` login (`PR #20`, `440efd0`) merged on `dev`. | Handover merged (`PR #18`, `PR #20`) |
| **Murat Can Işık** | 241101013 | `@cmuratt` | MCP Server & Agent Lead | MCP Server & Agent `Dockerfile`, `/internal/agent/stream` endpoint, and Gemini/connector wiring handover (`M-02`, `M-08`, `M-13`). | Pending handover |
| **Arda Çelik** | 241101065 | `@ardacelik11` | Connectors & Data Lead | Live Redis connector runtime wiring (`A-02`), `CONNECTOR_FIXED_NOW` (`Q3`), and Redis service handover (`A-12`). | Pending handover |

---

## Table of Contents

1. [Document-Specific Task Matrix](#document-specific-task-matrix)
2. [Deployment Overview](#1-deployment-overview)
   - 2.1 [Target Architecture & Service Topology](#11-target-architecture--service-topology)
   - 2.2 [Tools, Runtime & Observed Local Environment](#12-tools-runtime--observed-local-environment)
   - 2.3 [Mock vs. Live Data Source Boundary](#13-mock-vs-live-data-source-boundary)
3. [Deployment Process](#2-deployment-process)
   - 3.1 [Verified Local Build, Test & Standalone Gateway Runbook](#21-verified-local-build-test--standalone-gateway-runbook)
   - 3.2 [Verified 3-Service Docker Compose Stack (`web` + `api-gateway` + `redis`, `S-04`, `S-05`, `S-06`)](#22-verified-3-service-docker-compose-stack-web--api-gateway--redis-s-04-s-05-s-06)
   - 3.3 [Target 4-Service Deployment via Docker Compose (Not Yet Executed — Blocked)](#23-target-4-service-deployment-via-docker-compose-not-yet-executed--blocked)
   - 3.4 [Smoke Verification & Shutdown / Rollback](#24-smoke-verification--shutdown--rollback)
4. [Configuration Plan](#3-configuration-plan)
   - 4.1 [Environment Variables & Port Allocation](#31-environment-variables--port-allocation)
   - 4.2 [Authentication, Secret Handling & Dev-Only Mock SSO Notice](#32-authentication-secret-handling--dev-only-mock-sso-notice)
   - 4.3 [Network Security Boundary & Healthchecks](#33-network-security-boundary--healthchecks)
   - 4.4 [Cache TTLs, Rate Limits & Timezone Defaults](#34-cache-ttls-rate-limits--timezone-defaults)
   - 4.5 [Known Limitations & Open Deployment Blockers](#35-known-limitations--open-deployment-blockers)
5. [Change Record](#change-record)

---

## Document-Specific Task Matrix

| Task ID | Work Package Description | Assignee | Reviewer | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TSK-DEP-01** | Draft Deployment Overview, topology, runtime inventory, and mock boundary (§1) | Ahmet Sefa Efendioğlu | Entire Team | Completed (v0.1) |
| **TSK-DEP-02** | Author `apps/api-gateway/Dockerfile`, `.dockerignore`, and `compose.yaml` skeleton (`S-05`, `S-06`) | Ahmet Sefa Efendioğlu | Murat Can Işık, Yunus Emre Biçer | **Completed & Verified** (`compose config`, gateway `docker build`, live Redis + Gateway container smoke passed) |
| **TSK-DEP-03** | Document verified local build/test/stub runbook & pending Compose procedure (§2) | Ahmet Sefa Efendioğlu | Entire Team | Completed (v0.1) |
| **TSK-DEP-04** | Finalize Configuration Plan, env matrix, secret handling, and network boundaries (§3) | Ahmet Sefa Efendioğlu | Arda Çelik, Murat Can Işık | Completed (v0.1) |
| **TSK-DEP-05** | Integrate `apps/web/Dockerfile` handover (`PR #18`) into `dev` and verify web container build | Yunus Emre Biçer (merge) / Ahmet Sefa Efendioğlu (verify) | Ahmet Sefa Efendioğlu | **Completed & Verified** (`PR #18` merged on `dev`; 3-service Compose `web` + `gateway` + `redis` passed) |
| **TSK-DEP-06** | Deliver `apps/mcp-server/Dockerfile`, real connector registration, and `/internal/agent/stream` (`M-02`, `M-08`, `M-13`) | Murat Can Işık | Ahmet Sefa Efendioğlu | **Blocked — Pending Murat** |
| **TSK-DEP-07** | Confirm live Redis connector config, `CONNECTOR_FIXED_NOW`, and Redis handover (`A-02`, `A-12`) | Arda Çelik | Ahmet Sefa Efendioğlu | **Blocked — Pending Arda** |
| **TSK-DEP-08** | Execute fresh-clone 4-service `docker compose up --build` and end-to-end health verification (`S-05`, `S-07`) | Ahmet Sefa Efendioğlu | Entire Team | **Blocked** (awaiting TSK-DEP-06 & TSK-DEP-07) |

---

## 1. Deployment Overview

### 1.1 Target Architecture & Service Topology

The Campus Data Orchestrator demo stack is organized as a multi-service architecture behind a single Next.js web origin and a Fastify security perimeter (`API Contract v1.1 §1`):

```text
Browser (User)
   │  HTTP :3002 (/ , /asistan , /giris , /api/v1/*)
   ▼
[web] Next.js 16 Standalone (:3002, network: edge)
   │  Server-side rewrite /api/v1/* -> http://api-gateway:3000
   ▼
[api-gateway] Fastify 4.28 (:3000, networks: edge + internal)
   │  1. Verify mock-SSO JWT; strip Authorization & client X-Authenticated-* headers
   │  2. Sliding-window rate limit (30 req/60s via Redis sorted set or in-memory fallback)
   │  3. Inject trusted X-Authenticated-Student-Id & X-Authenticated-User-Role
   │
   ├── POST http://mcp-server:3001/mcp (JSON-RPC 2.0 tools/call) ──┐
   └── POST http://mcp-server:3001/internal/agent/stream (SSE)  ──┼──► [mcp-server] (:3001, network: internal ONLY)
                                                                            │
                                                                            ▼
                                                                   [redis] (redis:7-alpine :6379, network: internal ONLY)
```

### 1.2 Tools, Runtime & Observed Local Environment

| Component / Tool | Target / Observed Version | Notes |
| :--- | :--- | :--- |
| **Operating System** | Local dev/verification: **Windows**; Container runtime target: **`node:24-alpine`** | Verified locally on Windows; Linux containers targeted in `compose.yaml` |
| **Node.js / npm** | Observed locally: **Node.js `v26.4.0`**, **npm `11.17.0`** | Monorepo npm workspaces (`shared`, `connectors`, `mcp-server`, `api-gateway`, `web`) |
| **TypeScript / Build** | TypeScript `^5.4.5` (`strict`, `NodeNext`), Next.js `16.4.6` (Turbopack, `output: 'standalone'`) | `tsc` passes across TS workspaces & `web` typecheck; `next build` standalone trace compiles cleanly inside Docker (`node:24-alpine`); local Windows sandbox hits `EPERM: mkdir` on `.next/standalone` tracing |
| **Test Runner** | Vitest `^5.1.0` | **20 test files / 230 tests** passing locally |
| **Container Engine** | Observed locally: **Docker `29.9.3`**, **Docker Compose `v5.7.0`** (Linux containers via WSL 2) | `compose.yaml config --quiet`, `api-gateway` + `redis`, and 3-service Compose (`web` + `api-gateway` + `redis`) verified |
| **Cache Store** | Verified container: `redis:7-alpine` (`internal` network only) | Live sorted-set sliding-window rate limiting (`ZCARD=30`, 31st → `429 RATE_LIMITED`) verified against `redis:7-alpine`; connector `RedisCacheStore` runtime wiring (`A-02`) pending Arda |

### 1.3 Mock vs. Live Data Source Boundary

Official TOBB ETÜ production campus APIs (dining portal, shuttle GPS, library turnstiles, SIS timetable) are not accessible to the team. All four connectors run in **deterministic synthetic mock mode** (`*_CONNECTOR_MODE=mock`). Every API response carries `meta.source` (`LIVE | CACHE_HIT | STALE | ERROR`, representing execution path) separately from `meta.isSimulated: boolean` (`true` for synthetic data). Mock data is never represented as live university production data.

---

## 2. Deployment Process

### 2.1 Verified Local Build, Test & Standalone Gateway Runbook

The following steps were **actually executed and verified** on `feat/pa3-gateway-release` (base SHA `6ae34efe458605cb5b92567b72389b77dfef3274`):

1. **Install dependencies from repository root:**
   ```bash
   npm install
   ```
2. **Clean web cache and build all 5 monorepo workspaces (in dependency order):**
   *(Note: On Windows, use `npm.cmd` / `npx.cmd` if PowerShell execution policy restricts `.ps1` shims; cleaning `.next` prior to `next build` avoids stale directory `EPERM` errors in sandboxed Windows runs.)*
   ```bash
   npm run clean --workspace @campus-orchestrator/web
   npm run build
   ```
   **Observed result:** `@campus-orchestrator/shared`, `@campus-orchestrator/connectors`, `@campus-orchestrator/mcp-server`, `@campus-orchestrator/api-gateway`, and `@campus-orchestrator/web` compiled with exit code `0`.
3. **Run the automated verification test suite:**
   ```bash
   npx vitest run
   ```
   **Observed result:** `19` test files, `217` tests passed (`25` gateway tests across 5 files, `98` web tests, `76` connector tests, `18` MCP dispatcher tests).
4. **Run the gateway contract & security stub self-test harness (gateway-only verification):**
   ```bash
   node apps/api-gateway/scripts/run-acceptance-harness.mjs --mode=stub-self-test
   ```
   **Observed result:** `12/12` checks passed (`STUB_SELF_TEST_PASSED`) against an in-process fake MCP + Agent SSE server.
5. **Run standalone API Gateway locally (for development/smoke testing against a local MCP server):**
   ```bash
   cp .env.example .env
   # Set GATEWAY_PORT=3000, MCP_URL=http://localhost:3001/mcp, AGENT_STREAM_URL=http://localhost:3001/internal/agent/stream
   npm run start --workspace @campus-orchestrator/api-gateway
   ```
   Verify health endpoint:
   ```bash
   curl -s http://localhost:3000/health
   # Expected: {"status":"UP","service":"api-gateway","timestamp":"..."}
   ```

### 2.2 Verified 3-Service Docker Compose Stack (`web` + `api-gateway` + `redis`, `S-04`, `S-05`, `S-06`)

The following Docker & Compose verifications were **actually executed and passed** on `2026-11-20T10:11:05Z` (gateway + Redis smoke, [`gateway-docker-redis-smoke.txt`](evidence/deployment/gateway-docker-redis-smoke.txt)) and `2026-11-20T10:53:07Z` (3-service Compose smoke after merging `PR #18` & `PR #20`, [`compose-3service-smoke.txt`](evidence/deployment/compose-3service-smoke.txt)) using Docker `29.9.3` and Docker Compose `v5.7.0`:

1. **Validate `compose.yaml` syntax and variable schema:**
   ```bash
   JWT_SECRET=compose-validation-placeholder docker compose -f compose.yaml config --quiet
   ```
   **Observed result:** Exit code `0`.
2. **Build and launch `redis`, `api-gateway`, and `web` together via `compose.yaml` (`--no-deps` while `mcp-server` is blocked):**
   ```bash
   docker compose -f compose.yaml up --build -d --no-deps redis api-gateway web
   ```
   **Observed result:**
   - Both `bil481-2026-project-api-gateway` (`USER node`) and `bil481-2026-project-web` (`USER web`, Next.js `output: 'standalone'`) built cleanly in Linux `node:24-alpine` containers.
   - All three Compose healthchecks reached **`healthy`** (`redis=healthy`, `api-gateway=healthy`, `web=healthy`).
   - Web routes `GET http://127.0.0.1:3002/healthz` (`{"status":"ok","service":"web"}`), `/`, `/giris`, `/asistan`, and gateway `GET http://127.0.0.1:3000/health` all returned HTTP `200`.
   - Next.js server-side rewrite (`http://127.0.0.1:3002/api/v1/*` → `http://api-gateway:3000/api/v1/*`) passed `POST /api/v1/auth/mock-login` (`200`), `GET /api/v1/auth/me` (guest `401`, JWT `200`), `POST /api/v1/query` (guest `get_course_schedule` `401`, `studentId` parameter injection `400 INVALID_PARAMS`), and **live Redis rate limiting** (30 requests `200`, 31st `429 RATE_LIMITED` with `Retry-After=60s`, `redis-cli ZCARD rate:student:compose-rate-student` = `30`).
   - **Network isolation (`S-06`):** `redis` published zero host ports (`{"6379/tcp":null}`), and an active TCP probe from inside the `web` container to `redis:6379` returned `BLOCKED:TIMEOUT`.

### 2.3 Target 4-Service Deployment via Docker Compose (Not Yet Executed — Blocked)

> **Important Honesty Notice:** While 3-service Compose (`web` + `api-gateway` + `redis`) is verified (§2.2), **full 4-service `docker compose up --build` (including `mcp-server`) has NOT been executed yet** due to open Murat (`M-02`..`M-08`, `M-13`) and Arda (`A-02`) dependencies. The commands below document the full target runbook once those blockers land on `dev`.

1. **Create runtime `.env` file from template (never commit `.env`):**
   ```bash
   cp .env.example .env
   ```
   Generate a non-default `JWT_SECRET` for containerized demo execution and set `GEMINI_API_KEY` locally in `.env` (managed by Murat per Contract §8 Q2).
2. **Build and start the Compose stack (once `mcp-server/Dockerfile` and `web/Dockerfile` are on `dev`):**
   ```bash
   docker compose up --build -d
   ```
3. **Verify container health status:**
   ```bash
   docker compose ps
   curl -s http://localhost:3000/health    # api-gateway
   curl -s http://localhost:3002/healthz   # web (from PR #18)
   ```
   Confirm `mcp-server` and `redis` are **not** reachable on `localhost:3001` or `localhost:6379`.

### 2.4 Smoke Verification & Shutdown / Rollback

- **Live smoke check (once full stack is up):**
  ```bash
  GATEWAY_URL=http://localhost:3000 node apps/api-gateway/scripts/run-acceptance-harness.mjs --mode=smoke
  ```
- **Graceful shutdown & clean reset:**
  - Standalone gateway handles `SIGINT` and `SIGTERM`, closing Fastify and any open Redis TCP socket cleanly.
  - Containerized stack reset:
    ```bash
    docker compose down --remove-orphans
    ```
  - Rollback: check out the previous known-good release tag/SHA (`git checkout <sha>`), rebuild workspaces (`npm run build`), and restart services.

---

## 3. Configuration Plan

### 3.1 Environment Variables & Port Allocation

Aligned with `API Contract v1.1 §7` and `.env.example`:

| Variable | Owner | Local Default | Compose Value | Required / Sensitive | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Sefa | `development` | `production` | No | Switches strict `JWT_SECRET` enforcement |
| `GATEWAY_PORT` | Sefa | `3000` | `3000` | No | Gateway listen port (resolves previous `PORT=4000` mismatch; `PORT` supported as fallback) |
| `HOST` | Sefa | `0.0.0.0` | `0.0.0.0` | No | Gateway bind interface |
| `MCP_SERVER_PORT` | Murat | `3001` | `3001` (internal only) | No | Internal MCP server port |
| `WEB_PORT` / `PORT` | Yunus | `3002` | `3002` | No | Next.js web server listen port |
| `GATEWAY_URL` | Yunus | `http://localhost:3000` | `http://api-gateway:3000` | No (build-time arg) | Server-side `/api/v1/*` rewrite target in `apps/web/next.config.ts` (never `NEXT_PUBLIC_`) |
| `MCP_URL` | Sefa | `http://localhost:3001/mcp` | `http://mcp-server:3001/mcp` | No | Internal JSON-RPC 2.0 `tools/call` endpoint |
| `AGENT_STREAM_URL` | Murat / Sefa | `http://localhost:3001/internal/agent/stream` | `http://mcp-server:3001/internal/agent/stream` | No | Internal SSE stream endpoint for `POST /api/v1/chat/stream` (Contract §8 Q4) |
| `REDIS_URL` | Arda / Sefa | `redis://localhost:6379` | `redis://redis:6379` | Optional locally; required in Compose | Redis store for connector cache & gateway rate limiter |
| `JWT_SECRET` | Sefa | Dev fallback in non-prod | From `.env` (required in prod) | **Yes (Secret)** | HS256 signing/verification secret for mock-SSO tokens; throws on startup if unset in `NODE_ENV=production` |
| `MOCK_SSO_ISSUER` | Sefa | `campus-mock-sso` | `${MOCK_SSO_ISSUER:-campus-mock-sso}` | No | Expected JWT `iss` claim (aligned with `.env.example`) |
| `GEMINI_API_KEY` | Murat | From `.env` | From `.env` | **Yes (Secret)** | Google Gemini API key (consumed by agent inside `mcp-server` only; never sent to gateway or browser) |
| `*_CONNECTOR_MODE` | Arda | `mock` | `mock` | No | `CAFETERIA_`, `SHUTTLE_`, `LIBRARY_`, `SCHEDULE_CONNECTOR_MODE` |
| `UPSTREAM_TIMEOUT_MS` | Arda | `800` | `800` | No | Connector upstream request timeout bound |
| `CACHE_TTL_*` | Arda | `3600` / `120` / `60` / `300` | Same | No | Cafeteria / Shuttle / Library / Course Schedule TTLs in seconds |
| `CONNECTOR_MOCK_SEED` | Arda | `481-FALL-2026` | `481-FALL-2026` | No | Deterministic synthetic generator seed |
| `CONNECTOR_FIXED_NOW` | Arda | Unset (real UTC+3 clock) | Set during acceptance runs | No | Pins campus local clock for reproducible `AT-01..AT-04` (Contract §8 Q3) |

### 3.2 Authentication, Secret Handling & Dev-Only Mock SSO Notice

- **Dev-Only Mock SSO:** `POST /api/v1/auth/mock-login` generates HS256 JWTs for synthetic personas (`demo-student-01`, etc.) strictly for development and academic demonstration. It is **not** connected to real TOBB ETÜ SSO.
- **Secret Isolation:**
  - `.env` and `.env.*` (except `.env.example`) are excluded via `.gitignore` and `apps/api-gateway/Dockerfile.dockerignore`.
  - `compose.yaml` references `${JWT_SECRET:?Set JWT_SECRET in .env before starting}` and `${GEMINI_API_KEY:-}` with zero hardcoded secret literals.
  - `apps/api-gateway/src/auth/jwtVerifier.ts` refuses to fall back to the test key when `NODE_ENV=production`.
  - Gateway strips all client-supplied `X-Authenticated-*` headers and terminates raw `Authorization: Bearer` tokens before forwarding any internal request.

### 3.3 Network Security Boundary & Healthchecks

- **`edge` network:** Connects host-exposed `web` (`3002:3002`) and `api-gateway` (`3000:3000`). No CORS is enabled in `api-gateway` because `web` rewrites `/api/v1/*` server-side (Contract §8 Q5).
- **`internal` network (`internal: true`):** Connects `api-gateway`, `mcp-server`, and `redis`. Neither `mcp-server` nor `redis` defines `ports:` in `compose.yaml`, preventing unauthenticated external access or `X-Authenticated-Student-Id` spoofing directly against `/mcp`.
- **Healthchecks:**
  - `api-gateway`: `GET http://127.0.0.1:3000/health` (exempt from rate limiting)
  - `web`: `GET http://127.0.0.1:3002/healthz` (independent of gateway availability, per PR #18)
  - `mcp-server`: `GET http://127.0.0.1:3001/health` (expected from Murat `M-13`)
  - `redis`: `redis-cli ping`

### 3.4 Cache TTLs, Rate Limits & Timezone Defaults

- **Rate Limit Policy (FR-08):** `30` requests per `60`-second sliding window per verified `studentId` (or per client IP for guests). Uses Redis sorted sets (`ZREMRANGEBYSCORE`, `ZCARD`, `ZRANGE`, `ZADD`, `PEXPIRE`) via `RespTcpRedisClient` when `REDIS_URL` is configured, with automatic `InMemoryRateLimiterStore` fallback if Redis is temporarily unreachable.
- **Gateway Timeouts:** `10,000 ms` on `POST /api/v1/query` (`504 UPSTREAM_TIMEOUT`), `20,000 ms` on `POST /api/v1/chat/stream` aligned with UI idle timeout.
- **Timezone:** Campus operations use Türkiye Time (`UTC+3`) and ISO-8601 dates (`YYYY-MM-DD`).

### 3.5 Known Limitations & Open Deployment Blockers

1. **Full 4-Service `docker compose up` Blocked (3-Service `web` + `api-gateway` + `redis` Verified):** Docker `29.9.3` & Compose `v5.7.0` verified `web` + `api-gateway` + `redis` end-to-end, while `mcp-server` cannot build or run yet.
2. **BLOCKED on Murat (`M-02`, `M-04`, `M-05`, `M-08`, `M-13`):**
   - `apps/mcp-server/Dockerfile` does not exist yet (`compose.yaml` `mcp-server` build fails without it).
   - `apps/mcp-server/src/index.ts` still calls `registerSampleMockHandlers` instead of Arda's `createConnectorRuntime` / `registerConnectorHandlers`.
   - `POST /internal/agent/stream` and `AgentOrchestrator.executePlan()` (`NOT_IMPLEMENTED`) are not implemented yet.
3. **Remaining Web Task (`Y-07` — Yunus):**
   - `PR #18` (`Dockerfile` + `/healthz`) and `PR #20` (`/giris` + session) are now **merged on `dev`** (`440efd0`) and verified in Compose; only `Y-07` chat UI composer wiring remains before `AT-04`.
4. **BLOCKED on Arda (`A-02`, `A-12`, `Q3`):**
   - `RedisCacheStore` runtime bootstrap (`createConnectorRuntime` with real `REDIS_URL`) and `CONNECTOR_FIXED_NOW` wiring need confirmation before live Compose acceptance runs.
5. **Local Windows Sandbox Caveat & PostgreSQL (FR-20):** Local `next build` on Windows sandbox hit `EPERM: mkdir` on `.next/standalone` tracing (works cleanly inside Linux Docker build). PostgreSQL / Prisma (FR-20) is deferred from the Assignment 3 `compose.yaml` baseline.

---

## Change Record

| Version | Date | Updated Section | Description of Changes | Updated By |
| :--- | :--- | :--- | :--- | :--- |
| **0.1** | 20 Nov 2026 | All | Initial Deployment Plan draft; added `compose.yaml`, gateway `Dockerfile`/`.dockerignore`, verified local build/test baseline, and recorded container/teammate blockers honestly. | Ahmet Sefa Efendioğlu |
| **0.2** | 20 Nov 2026 | Overview, §1.2, §2.2–2.4, §3.5 | Installed Docker Desktop `29.9.3` + Compose `v5.7.0`; fixed `.dockerignore` workspace manifest preservation; verified `compose.yaml config --quiet`, `apps/api-gateway/Dockerfile` build, and live `api-gateway` + `redis:7-alpine` container smoke test (`gateway-docker-redis-smoke.txt`). Full 4-service Compose remains blocked on `M-13` and `PR #18`. | Ahmet Sefa Efendioğlu |
| **0.3** | 20 Nov 2026 | Overview, Contributors, Task Matrix, §1.2, §2.2, §3.5 | Synced `feat/pa3-gateway-release` with `dev` @ `440efd0` (`PR #18` + `PR #20` merged); verified real 3-service Compose (`web` + `api-gateway` + `redis`), cross-container rewrite, live Redis rate limit, and `web -> redis` network isolation (`compose-3service-smoke.txt`); updated Vitest count to 230/230. | Ahmet Sefa Efendioğlu |
