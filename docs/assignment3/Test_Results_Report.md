# Test Results Report

**Campus Data Orchestrator — Model Context Protocol (MCP) Based Campus Data Orchestrator**

| Field | Detail |
| :--- | :--- |
| **Course** | BIL 481 Software Engineering, Fall 2026, TOBB University of Economics and Technology |
| **Assignment** | Project Assignment 3 — Deliverable 3: Test Results Report |
| **Group Name** | Group-ASYM |
| **Document Lead & Primary Author** | **Ahmet Sefa Efendioğlu** (241101066) — `@Sefa-Efendioglu` |
| **Document Version / Date** | **Version 0.3 (Draft Template + 230 Vitest + 3-Service Compose Smoke Verified), 20 November 2026** |
| **Repository Filepath** | `docs/assignment3/Test_Results_Report.md` |
| **Tested Base Commit SHA** | `dev` @ `440efd088c2c2ea6a3523b7d02d7c4d14eca06a2` (working tree: `feat/pa3-gateway-release` @ `2f8d5ba` + updates) |
| **API Contract Version** | API Contract v1.1 (19 November 2026) |
| **Related Documents** | `docs/assignment3/Acceptance_Tests_and_Criteria.md`, `docs/assignment3/Deployment_Plan.md`, `docs/QA_Plan.md` |

> **Honest Reporting Principle:** Per Project Assignment 3 and the Team Guide, **none of the four end-to-end acceptance tests (`AT-01`..`AT-04`) have been executed yet**. All four are recorded below as **`NOT RUN (BLOCKED)`** with their exact upstream blockers. Automated Vitest unit/contract tests and the gateway `--mode=stub-self-test` run are reported separately in Section 2 as **supporting verification only** — never as acceptance PASS.

---

## List of Contributors

| Member Name | Student ID | GitHub Account | Project Role | Contribution to this Document | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ahmet Sefa Efendioğlu** | 241101066 | `@Sefa-Efendioglu` | QA, Security & Release Lead | **Lead Author:** Created report structure, `AT-01`..`AT-04` results matrix (honestly marking `NOT RUN (BLOCKED)`), executed and recorded gateway unit/contract/stub verification results, and authored blocker root-cause analysis. | Drafted (v0.1) |
| **Yunus Emre Biçer** | 241101009 | `@YunusEmre113` | Web Client & AT Lead | Defined `AT-01`..`AT-04` criteria (`Acceptance_Tests_and_Criteria.md` v0.1); UI E2E screenshots and network captures pending integration. | Pending E2E evidence |
| **Murat Can Işık** | 241101013 | `@cmuratt` | MCP Server & Agent Lead | MCP tool execution logs, Gemini outbound PII-scrubbing interception, and `AT-04` tool-call trace pending. | Pending E2E evidence |
| **Arda Çelik** | 241101065 | `@ardacelik11` | Connectors & Data Lead | Live Redis cache hit/stale/fault injection evidence for `AT-01`..`AT-03` pending. | Pending E2E evidence |

---

## Table of Contents

1. [Document-Specific Task Matrix](#document-specific-task-matrix)
2. [Test Results Overview (`AT-01`..`AT-04`)](#1-test-results-overview-at-01at-04)
   - 2.1 [Acceptance Test Execution Metadata](#11-acceptance-test-execution-metadata)
   - 2.2 [Acceptance Test Matrix (`AT-01`..`AT-04`)](#12-acceptance-test-matrix-at-01at-04)
   - 2.3 [Per-Test Execution Notes](#13-per-test-execution-notes)
3. [Supporting Verification Results (Non-Acceptance)](#2-supporting-verification-results-non-acceptance)
   - 3.1 [Monorepo Workspace Build & Automated Test Suite (Vitest)](#21-monorepo-workspace-build--automated-test-suite-vitest)
   - 3.2 [Gateway Stub Self-Test Harness (`--mode=stub-self-test`)](#22-gateway-stub-self-test-harness---modestub-self-test)
   - 3.3 [Live Containerized `api-gateway` + `redis:7-alpine` & 3-Service Compose Smoke Tests](#23-live-containerized-api-gateway--redis7-alpine--3-service-compose-smoke-tests)
4. [Test Results Analysis](#3-test-results-analysis)
   - 4.1 [Root Cause Analysis for `AT-01`..`AT-04` (`NOT RUN / BLOCKED`)](#31-root-cause-analysis-for-at-01at-04-not-run--blocked)
   - 4.2 [Proposed Corrective Actions & Unblocking Sequence](#32-proposed-corrective-actions--unblocking-sequence)
5. [Logs and Outputs](#4-logs-and-outputs)
6. [Change Record](#change-record)

---

## Document-Specific Task Matrix

| Task ID | Work Package Description | Assignee | Reviewer | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TSK-TRR-01** | Establish Test Results Report structure and `AT-01`..`AT-04` status matrix (`S-09`) | Ahmet Sefa Efendioğlu | Yunus Emre Biçer | Completed (v0.1 template) |
| **TSK-TRR-02** | Execute gateway unit, contract, Redis RESP, SSE proxy, and stub self-test verification (`S-10`, `S-11`) | Ahmet Sefa Efendioğlu | Entire Team | Completed (logged in evidence) |
| **TSK-TRR-03** | Analyze blocking dependencies across MCP, Connectors, Web, and Docker Compose (§3) | Ahmet Sefa Efendioğlu | Entire Team | Completed (v0.1) |
| **TSK-TRR-04** | Collect UC-01..UC-03 data/cache evidence from deployed Redis/MCP stack | Arda Çelik | Ahmet Sefa Efendioğlu | **Blocked — Pending `M-02`, `A-02`** |
| **TSK-TRR-05** | Collect UC-04 agent tool trace, Gemini synthesis, and PII interception evidence | Murat Can Işık | Ahmet Sefa Efendioğlu | **Blocked — Pending `M-04`..`M-08`** |
| **TSK-TRR-06** | Collect browser screenshots, HAR captures, and mobile/desktop checks for `AT-01`..`AT-04` | Yunus Emre Biçer | Ahmet Sefa Efendioğlu | **Blocked — Pending E2E stack & `Y-07`** |
| **TSK-TRR-07** | Execute live E2E acceptance suite (`AT-01`..`AT-04`) and publish final v1.0 report (`S-07`, `S-09`) | Ahmet Sefa Efendioğlu | Entire Team | **Blocked** (awaiting TSK-TRR-04..06) |

---

## 1. Test Results Overview (`AT-01`..`AT-04`)

### 1.1 Acceptance Test Execution Metadata

| Field | Value (Current Baseline) |
| :--- | :--- |
| **Contract Version** | `API Contract v1.1` |
| **Repository Branch / Base SHA** | `feat/pa3-gateway-release` synced with `dev` @ `440efd088c2c2ea6a3523b7d02d7c4d14eca06a2` |
| **Environment** | Windows, Node.js `v26.4.0`, npm `11.17.0`, Docker `29.9.3`, Docker Compose `v5.7.0` |
| **Data Mode** | `MOCK` (connectors not yet wired into live MCP runtime on `dev`) |
| **Overall Acceptance Status** | **0 / 4 Passed — 4 / 4 `NOT RUN (BLOCKED)`** |

### 1.2 Acceptance Test Matrix (`AT-01`..`AT-04`)

| Test ID | Use Case | Run Date | Tested SHA | Expected Criteria | Actual Observed Result | Status | Evidence Path | Blocking Issue / Owner |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`AT-01`** | UC-01: View Cafeteria Menu | *Pending E2E* | *Pending* | `AC-01.1`..`AC-01.8` | Not executed end-to-end. Web/gateway/Redis Compose layer works, but MCP server does not yet wire Arda's connectors or Redis runtime (`M-02`, `M-13`). | **`NOT RUN (BLOCKED)`** | *Pending (`docs/assignment3/evidence/AT-01/`)* | Murat `M-02`/`M-13`, Arda `A-02`/`Q3` |
| **`AT-02`** | UC-02: View Shuttle Schedule | *Pending E2E* | *Pending* | `AC-02.1`..`AC-02.7` | Not executed end-to-end. Same upstream MCP/connector blockers as `AT-01`. | **`NOT RUN (BLOCKED)`** | *Pending (`docs/assignment3/evidence/AT-02/`)* | Murat `M-02`/`M-13`, Arda `A-02`/`Q3` |
| **`AT-03`** | UC-03: View Library Occupancy | *Pending E2E* | *Pending* | `AC-03.1`..`AC-03.7` | Not executed end-to-end. Same upstream MCP/connector blockers as `AT-01`, plus live stale-fallback fault injection requires real connector runtime + Redis. | **`NOT RUN (BLOCKED)`** | *Pending (`docs/assignment3/evidence/AT-03/`)* | Murat `M-02`/`M-13`, Arda `A-02`/`A-04` |
| **`AT-04`** | UC-04: Combined Course + Shuttle + Menu Query | *Pending E2E* | *Pending* | `AC-04.1`..`AC-04.12` | Not executed end-to-end. Web login (`PR #20`) + gateway SSE proxy + Redis Compose work, but `AgentOrchestrator.executePlan()` throws `NOT_IMPLEMENTED`, `/internal/agent/stream` does not exist yet, and chat UI (`Y-07`) is not wired. | **`NOT RUN (BLOCKED)`** | *Pending (`docs/assignment3/evidence/AT-04/`)* | Murat `M-04`..`M-08`/`M-13`, Yunus `Y-07` |

### 1.3 Per-Test Execution Notes

- **`AT-01` (UC-01):** Gateway contract behavior for `get_cafeteria_menu` (guest access, `meta.isSimulated` / `meta.source` preservation, `-32602` → `400 INVALID_PARAMS`) was checked only against an in-process stub in `queryProxy.test.ts` and `run-acceptance-harness.mjs --mode=stub-self-test`. Full browser → gateway → MCP → connector → Redis flow remains `NOT RUN (BLOCKED)`.
- **`AT-02` (UC-02):** Same as `AT-01` for `get_shuttle_schedule`; invalid route rejection (`400 INVALID_PARAMS`) verified in gateway proxy tests and stub harness only.
- **`AT-03` (UC-03):** Same as `AT-01` for `get_library_occupancy`; `STALE` flag and original timestamp preservation verified in `queryProxy.test.ts` and stub harness only.
- **`AT-04` (UC-04):** Gateway auth (`401 AUTHENTICATION_REQUIRED` for guest), `studentId` parameter injection block (`400 INVALID_PARAMS`), token stripping (`0` `Authorization` headers forwarded), and real HTTP SSE passthrough (`tool`, `token`, `done`, post-header `error`) verified against a fake agent server in `chatStreamProxy.test.ts` and stub harness. No real Gemini invocation or PII-scrubbing run occurred.

---

## 2. Supporting Verification Results (Non-Acceptance)

These automated checks verify **isolated gateway and module contracts only**. Per `Acceptance_Tests_and_Criteria.md §2.5` and `API Contract v1.1 §3.3`, they are **supporting evidence** and **must not be counted as passing any acceptance test (`AT-01`..`AT-04`)**.

### 2.1 Monorepo Workspace Build & Automated Test Suite (Vitest)

- **Recorded Timestamps:** `2026-11-20T12:29:59+03:00` (initial gateway log) & `2026-11-20T13:52:17+03:00` (after merging `origin/dev` `440efd0`)
- **Base Commit SHA:** `440efd088c2c2ea6a3523b7d02d7c4d14eca06a2` (`dev`) merged into `feat/pa3-gateway-release` (`2f8d5ba`)
- **Build & Typecheck:** `tsc` passed across `shared`, `connectors`, `mcp-server`, `api-gateway`, and `npm run typecheck --workspace @campus-orchestrator/web` passed locally. Next.js `output: 'standalone'` compiled cleanly inside the Linux Docker build (`node:24-alpine`); local Windows sandbox standalone trace hit `EPERM: mkdir`.
- **Test Command:** `npx vitest run` → **20 test files, 230 tests passed** (0 skipped, 0 failed):

| Workspace / Suite | Files | Passed Tests | Verification Scope (Non-Acceptance) |
| :--- | :---: | :---: | :--- |
| `apps/api-gateway/tests/jwtAuth.test.ts` | 1 | 8 | Mock-login, `/auth/me`, token termination, expired/tampered/`alg=none`/wrong-issuer 401, spoofed header strip, prod `JWT_SECRET` guard |
| `apps/api-gateway/tests/queryProxy.test.ts` | 1 | 6 | Real HTTP `POST /api/v1/query` proxy against local fake MCP: 3 public tools, guest 401 before dispatch, empty `[]` vs empty `{}`, `studentId` injection 400, `-32602`/503/502/504 mapping, `STALE` preservation, fixture schema match |
| `apps/api-gateway/tests/chatStreamProxy.test.ts` | 1 | 5 | Real HTTP `POST /api/v1/chat/stream` SSE proxy: guest 401, validation 400, SSE frame passthrough with 0 forwarded `Authorization`, pre-stream 503/429/504, mid-stream `event: error` without PII/token leak |
| `apps/api-gateway/tests/rateLimiter.test.ts` | 1 | 3 | 30 req/60s window (`31st -> 429`), key isolation, `/health` exemption, mock `RedisRateLimitClient`, `RespTcpRedisClient` over mock TCP RESP2 server, fail-open fallback |
| `apps/api-gateway/tests/deploymentConfig.test.ts` | 1 | 3 | Static audit of `compose.yaml` network isolation, `Dockerfile`/`.dockerignore` security, and contract JSON error fixtures |
| `apps/web/tests/` (incl. `auth.test.ts` from `PR #20`) | 7 | 111 | Bilingual router, gateway client, SSE parser, chat stream client, auth client/session store, formatting |
| `tests/connectors/` (existing on `dev`) | 7 | 76 | Seeded connectors, in-memory cache stores, circuit breaker, resilient executor |
| `tests/mcp-server/` (existing on `dev`) | 1 | 18 | `ToolDispatcher` schema validation and sample mock handlers |
| **Total** | **20** | **230** | **100% offline/stub verification only** |

### 2.2 Gateway Stub Self-Test Harness (`--mode=stub-self-test`)

- **Command:** `node apps/api-gateway/scripts/run-acceptance-harness.mjs --mode=stub-self-test`
- **Outcome:** **12 / 12 assertions passed (`STUB_SELF_TEST_PASSED`)** against in-process fake MCP & fake Agent SSE endpoints, confirming `0` raw `Authorization` headers forwarded across `6` downstream requests and redacted token logging (`eyJhbGci...<redacted>`).

### 2.3 Live Containerized `api-gateway` + `redis:7-alpine` & 3-Service Compose Smoke Tests

- **Gateway + Redis Container Smoke (`2026-11-20T10:11:05Z`):** Verified `campus-api-gateway:local` wired to `redis:7-alpine` over an `--internal` network (`gateway-docker-redis-smoke.txt`).
- **3-Service Compose Smoke (`2026-11-20T10:53:07Z`, `compose-3service-smoke.txt`):** Executed `docker compose -f compose.yaml up --build -d --no-deps redis api-gateway web` (with `PR #18` and `PR #20` merged on `dev` @ `440efd0`):
  - `redis`, `api-gateway`, and `web` all reached Docker `healthy`.
  - Web routes `/healthz` (`{"status":"ok","service":"web"}`), `/`, `/giris`, `/asistan`, and gateway `/health` all returned `200`.
  - Next.js server-side rewrite (`:3002/api/v1/*` → `http://api-gateway:3000/api/v1/*`) passed `mock-login` (`200`), `/auth/me` (guest `401`, JWT `200`), guest `get_course_schedule` (`401`), `studentId` parameter injection (`400 INVALID_PARAMS`), and **live Redis rate limiting** (30 requests `200`, 31st `429 RATE_LIMITED` with `Retry-After=60s`, `redis-cli ZCARD rate:student:compose-rate-student` = `30`).
  - **Network isolation (`S-06`):** `redis` exposed zero host ports (`{"6379/tcp":null}`) and a TCP probe from inside `web` to `redis:6379` returned `BLOCKED:TIMEOUT`.
  - **Does NOT test `mcp-server`** (still blocked on `M-13`).

---

## 3. Test Results Analysis

### 3.1 Root Cause Analysis for `AT-01`..`AT-04` (`NOT RUN / BLOCKED`)

| Blocker ID | Affected Tests | Root Cause | Impact |
| :--- | :--- | :--- | :--- |
| **`BLK-MCP-RUNTIME`** | `AT-01`..`AT-03` | `apps/mcp-server/src/index.ts` still registers `sampleMockHandlers` instead of `packages/connectors` (`createConnectorRuntime` / `registerConnectorHandlers`, Murat `M-02`). | Gateway proxy calls cannot exercise Arda's seeded connectors, TTL caching, or stale fallback. |
| **`BLK-REDIS-WIRING`** | `AT-01`..`AT-03` | `RedisCacheStore` is not yet wired to a live Redis client bootstrap in `packages/connectors` (`A-02`) and `CONNECTOR_FIXED_NOW` (`Q3`) is unconfirmed. | `FR-09` live Redis cache hit and `AT-01`..`AT-03` repeatable clock assertions cannot run end-to-end. |
| **`BLK-AGENT-STREAM`** | `AT-04` | `AgentOrchestrator.executePlan()` throws `NOT_IMPLEMENTED` (`M-04`), Gemini adapter/PII scrubber (`M-05`, `M-06`) and internal endpoint `/internal/agent/stream` (`M-08`) do not exist yet. | Gateway `/api/v1/chat/stream` cannot forward compound queries to a real agent or Gemini provider. |
| **`BLK-WEB-CHAT-UI`** | `AT-04` | `PR #18` (`Dockerfile`) and `PR #20` (login) are now **merged on `dev`** (`440efd0`) and verified in Compose, while `Y-07` chat UI composer wiring is still pending. | Compound assistant UI step in `AT-04` cannot run end-to-end yet (`AT-01..03` web UI is unblocked once MCP lands). |
| **`BLK-MCP-DOCKER`** | `AT-01`..`AT-04` | `apps/mcp-server/Dockerfile` (`M-13`) is missing on `dev` (3-service Compose `web`+`gateway`+`redis` passes, `mcp-server` cannot build). | Full 4-service `docker compose up --build` cannot build or verify `mcp-server` yet. |

### 3.2 Proposed Corrective Actions & Unblocking Sequence

1. **Murat (`M-02`, `M-04`..`M-08`, `M-13`):** Wire `packages/connectors` into `apps/mcp-server`; implement `AgentOrchestrator` + Gemini adapter + PII scrubber + `POST /internal/agent/stream` (matching API Contract v1.1 §3.3 & §8 Q4); provide `apps/mcp-server/Dockerfile` listening on `MCP_SERVER_PORT=3001` with `GET /health`.
2. **Arda (`A-02`, `A-12`, `Q3`):** Wire live Redis client into `RedisCacheStore` runtime factory using `REDIS_URL`, confirm `CONNECTOR_FIXED_NOW` support, and share Redis health/seed verification steps.
3. **Yunus (`Y-07`):** Complete `Y-07` chat composer wiring against `/api/v1/chat/stream` (building on merged `PR #18` and `PR #20`) and confirm review on `Test_Results_Report.md` / `Acceptance_Tests_and_Criteria.md`.
4. **Sefa (`S-05`, `S-07`, `S-09`):** Once teammates' PRs land on `dev`, run full 4-service `docker compose up --build`, execute `AT-01`..`AT-04` end-to-end (plus `--mode=smoke`), collect redacted screenshots/HAR/logs into `docs/assignment3/evidence/AT-01..04/`, and publish `Test_Results_Report.md` v1.0.

---

## 4. Logs and Outputs

- **Gateway unit, contract, Redis RESP2, SSE proxy & stub harness stdout log (redacted):**
  - [`docs/assignment3/evidence/security/gateway-unit-contract-tests.txt`](evidence/security/gateway-unit-contract-tests.txt)
- **Live containerized `api-gateway` + `redis:7-alpine` smoke log (redacted):**
  - [`docs/assignment3/evidence/deployment/gateway-docker-redis-smoke.txt`](evidence/deployment/gateway-docker-redis-smoke.txt)
- **Live 3-service Compose (`web` + `api-gateway` + `redis`) smoke & network isolation log (redacted):**
  - [`docs/assignment3/evidence/deployment/compose-3service-smoke.txt`](evidence/deployment/compose-3service-smoke.txt)
- **Live acceptance execution logs (`AT-01`..`AT-04`):**
  - *Pending* — directories `docs/assignment3/evidence/AT-01/` through `AT-04/` will be populated once E2E blockers are resolved and tests are executed.

---

## Change Record

| Version | Date | Updated Section | Description of Changes | Updated By |
| :--- | :--- | :--- | :--- | :--- |
| **0.1** | 20 Nov 2026 | All | Created initial Test Results Report with honest `NOT RUN (BLOCKED)` matrix for `AT-01`..`AT-04`, recorded real Vitest (217/217) & stub self-test (12/12) gateway verification outputs, and documented teammate blockers. | Ahmet Sefa Efendioğlu |
| **0.2** | 20 Nov 2026 | §1.1, §2.3, §3.1, §4 | Added live containerized `api-gateway` + `redis:7-alpine` smoke results (`gateway-docker-redis-smoke.txt`: `HEALTHCHECK=healthy`, live Redis `ZCARD=30`, 31st request `429`); updated `BLK-MCP-DOCKER` now that local Docker `29.9.3` is active; kept `AT-01`..`AT-04` honestly marked `NOT RUN (BLOCKED)`. | Ahmet Sefa Efendioğlu |
| **0.3** | 20 Nov 2026 | §1.1, §1.2, §2.1, §2.3, §3, §4 | Merged `origin/dev` (`440efd0`, `PR #18` + `PR #20`) into branch; updated Vitest baseline to 230/230 (20 files); added 3-service Compose smoke (`compose-3service-smoke.txt`: `web -> gateway -> redis` + `web -> redis` isolation); kept `AT-01`..`AT-04` honestly `NOT RUN (BLOCKED)`. | Ahmet Sefa Efendioğlu |
