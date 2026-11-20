# Requirements Traceability — Assignment 3

**Campus Data Orchestrator — Group-ASYM**

| Field | Detail |
| :--- | :--- |
| **Course** | BIL 481 Software Engineering, Fall 2026, TOBB University of Economics and Technology |
| **Assignment** | Project Assignment 3 (Implementation, Deployment & Acceptance) |
| **Document Version / Date** | Version 0.1 (draft), 20 November 2026 |
| **Repository Filepath** | `docs/assignment3/traceability.md` |
| **State described** | `dev` at `6cc1d07` (20 November 2026) |
| **Owner** | Murat Can Işık (team guide task M-12); every module owner verifies their own rows |
| **Related documents** | [`Requirements_Document.md`](../Requirements_Document.md), [`Design_Document.md`](../Design_Document.md), [`QA_Plan.md`](../QA_Plan.md), `Acceptance_Tests_and_Criteria.md` (PR #17), [`contracts/API_CONTRACT.md`](contracts/API_CONTRACT.md) (API Contract v1.1) |

## Contributors

| Member | Student ID | GitHub | Contribution to this document |
| :--- | :--- | :--- | :--- |
| **Murat Can Işık** | 241101013 | `@cmuratt` | Document owner; compiled both matrices; MCP server, shared contract and agent rows |
| **Yunus Emre Biçer** | 241101009 | `@YunusEmre113` | Web client rows (FR-15..FR-19, NFR-07, NFR-09 web part), from [`handovers/yunus.md`](handovers/yunus.md) §3 |
| **Ahmet Sefa Efendioğlu** | 241101066 | `@Sefa-Efendioglu` | Gateway, security and deployment facts (FR-07, FR-08, NFR-05, NFR-09), from [`handovers/sefa.md`](handovers/sefa.md) |
| **Arda Çelik** | 241101065 | `@ardacelik11` | Connector rows (FR-03..FR-06, FR-09..FR-12, NFR-03): **verification pending** — no connector handover yet; rows were compiled by Murat from the code |

## Table of Contents

- [Change Record](#change-record)
- [1. Purpose, Scope and Status Legend](#1-purpose-scope-and-status-legend)
- [2. Matrix A — Requirement → Design Component → Code](#2-matrix-a--requirement--design-component--code)
- [3. Matrix B — Requirement → Test](#3-matrix-b--requirement--test)
- [4. Use Case Summary](#4-use-case-summary)
- [5. Open Items and Pending Verification](#5-open-items-and-pending-verification)
- [6. Document-Specific Task Matrix](#6-document-specific-task-matrix)

## Change Record

| Version | Date | Updated Sections | Description of Changes | Updated By |
| :--- | :--- | :--- | :--- | :--- |
| 0.1 | 20 Nov 2026 | All | Initial draft: both matrices for FR-01..FR-20 and NFR-01..NFR-09; web rows from the web handover, gateway rows from the gateway handover, MCP and connector rows from the code on `dev` at `6cc1d07` | Murat Can Işık |

---

## 1. Purpose, Scope and Status Legend

This document links every requirement of the [Requirements Document](../Requirements_Document.md) to the design component that realises it, the code that implements it and the tests that verify it. It uses the official requirement IDs `FR-01`..`FR-20` and `NFR-01`..`NFR-09` unchanged; no requirement is added or renamed. PA3 focuses on the four selected use cases UC-01..UC-04; requirements outside them are still listed, with their real status.

Two matrices are kept, as requested by the course (Piazza):

- **Matrix A** — Requirement → Design component → Code path → Implementation status.
- **Matrix B** — Requirement → Test: PA2 QA test cases `TC-01`..`TC-08`, automated test suites, and PA3 acceptance tests `AT-01`..`AT-04` with their acceptance criteria `AC-xx.y`.

**Status legend (implementation, Matrix A):**

| Status | Meaning |
| :--- | :--- |
| **Implemented** | Code exists on `dev` and is covered by at least one automated test that was run |
| **Partial** | Some of the requirement exists on `dev`; the missing part is named |
| **Planned (PA3)** | Scheduled for PA3; not on `dev` yet. The team guide task ID is given |
| **Not in PA3** | Not scheduled for PA3; stays in the backlog and is reported as a gap |

**Test status (Matrix B)** is taken only from actual runs. `NOT RUN` means the test has not been executed yet. The acceptance tests `AT-01`..`AT-04` have **not been run** at the time of this version; their results will be recorded in [`Test_Results_Report.md`](Test_Results_Report.md).

---

## 2. Matrix A — Requirement → Design Component → Code

Design sections refer to [`Design_Document.md`](../Design_Document.md). Code paths are relative to the repository root.

### 2.1 Functional requirements

| Req. | Requirement (short) | Design component (section) | Code | Owner | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| FR-01 | MCP tool registry with strict schemas | Tool registry & ToolDispatcher (§2.2.1, §2.3.2, §2.3.6) | `apps/mcp-server/src/registry/toolDefinitions.ts`, `apps/mcp-server/src/dispatcher/ToolDispatcher.ts`, `packages/shared/src/types/tools.ts` | Murat | **Implemented** (PA2); connection to real connector handlers planned (M-02) |
| FR-02 | MCP transports (stdio, HTTP) | MCP transports (§2.2.1) | `apps/mcp-server/src/index.ts`, `apps/mcp-server/src/server.ts` | Murat | **Partial**: stdio, legacy HTTP+SSE and JSON-RPC `POST /mcp` exist; official Streamable HTTP conformance not checked (M-09) |
| FR-03 | Cafeteria menu connector | Connector tier — cafeteria (§2.2.3, §2.3.4) | `packages/connectors/src/connectors/` (mock cafeteria), `packages/connectors/src/handlers.ts` | Arda | **Partial**: connector implemented in `packages/connectors`; the MCP server still uses its sample handlers (M-02) |
| FR-04 | Shuttle schedule connector | Connector tier — shuttle (§2.2.3, §2.3.4) | `packages/connectors/src/connectors/` (mock shuttle), `packages/connectors/src/handlers.ts` | Arda | **Partial**: as FR-03 |
| FR-05 | Library occupancy connector | Connector tier — library (§2.2.3, §2.3.4) | `packages/connectors/src/connectors/` (mock library), `packages/connectors/src/handlers.ts` | Arda | **Partial**: as FR-03 |
| FR-06 | Course schedule from verified identity only | SIS adapter + dispatcher auth guard (§2.2.1, §2.3.6); gateway rejects identity parameters (§2.2.4) | `packages/connectors/src/connectors/` (mock course schedule), `apps/mcp-server/src/dispatcher/ToolDispatcher.ts`, `apps/api-gateway/src/proxy/mcpProxy.ts` | Arda, Murat, Sefa | **Partial**: auth guard and gateway checks implemented; real connector wiring planned (M-02) |
| FR-07 | JWT verification and token termination at the gateway | Gateway identity perimeter (§2.2.4, §2.3.5) | `apps/api-gateway/src/auth/jwtVerifier.ts`, `apps/api-gateway/src/auth/tokenTermination.ts` | Sefa | **Implemented** |
| FR-08 | Rate limiting 30 req / 60 s | Sliding-window rate limiter (§2.2.4) | `apps/api-gateway/src/rate-limiter/slidingWindowRateLimiter.ts`, `apps/api-gateway/src/rate-limiter/redisRateLimiterStore.ts` | Sefa | **Implemented** (Redis-backed when `REDIS_URL` is set; verified in the 3-service Compose stack) |
| FR-09 | TTL cache (3600/120/60/300 s) | Cache store (§2.2.3, §4.1) | `packages/connectors/src/cache/` (`InMemoryCacheStore`, `RedisCacheStore`, `cacheKeys`) | Arda | **Partial**: cache stores exist; Redis runtime wiring to be confirmed (A-02) |
| FR-10 | Stale-if-error fallback | Resilient connector executor (§2.2.3) | `packages/connectors/src/resilience/ResilientConnectorExecutor.ts` | Arda | **Implemented** in the connector package; reaches the demo flow only after M-02 |
| FR-11 | Circuit breaker | Circuit breaker (§2.2.3) | `packages/connectors/src/resilience/CircuitBreaker.ts` | Arda | **Implemented** in the connector package; reaches the demo flow only after M-02 |
| FR-12 | Mock/live connector mode, synthetic labelling | Connector interface & factory (§2.2.3) | `packages/connectors/src/factory.ts`, `packages/connectors/src/config.ts`; UI badge `apps/web/src/components/cards/CardParts.tsx` | Arda, Yunus | **Implemented** (mock mode; live sources unavailable, reported as synthetic) |
| FR-13 | AI agent multi-tool orchestration | Agent orchestrator (§2.2.1) | `apps/mcp-server/src/agent/AgentOrchestrator.ts` | Murat | **Planned (PA3)**: skeleton only (`NOT_IMPLEMENTED`); M-04, M-05, M-08 |
| FR-14 | PII scrubbing before the LLM | Agent PII scrubber (§2.2.1) | — | Murat | **Planned (PA3)**: M-06 |
| FR-15 | Login state / sign-out | Session provider, login page, header (§2.2.2, §2.4) | `apps/web/src/lib/auth/`, `apps/web/src/components/SessionProvider.tsx`, `LoginForm.tsx`, `SiteHeader.tsx`; gateway `POST /api/v1/auth/mock-login`, `GET /api/v1/auth/me` | Yunus, Sefa | **Implemented** (mock SSO, synthetic personas) |
| FR-16 | Bilingual deterministic intent router | Intent router, query box (§2.2.2, §2.3.3) | `apps/web/src/router/routeStudentQuery.ts`, `apps/web/src/components/QueryBox.tsx` | Yunus | **Implemented** |
| FR-17 | SSE streamed assistant with tool badges | Chat stream client (§2.2.2, §2.3.3, §3.5); gateway chat proxy (§2.2.4) | `apps/web/src/lib/chat/`, `apps/api-gateway/src/proxy/chatStreamProxy.ts`; agent stream endpoint `POST /internal/agent/stream` (planned) | Yunus, Sefa, Murat | **Partial**: web client and gateway proxy implemented; chat screen (Y-07) and agent stream (M-08) planned |
| FR-18 | Campus-at-a-glance dashboard | Dashboard, three cards, gateway client (§2.2.2, §2.4) | `apps/web/src/components/Dashboard.tsx`, `apps/web/src/components/cards/`, `apps/web/src/lib/gateway/` | Yunus | **Implemented**, except the connector-health card and card-click prefill (not in PA3) |
| FR-19 | UI error / stale / empty / latency states | Card states, chat latency flags (§3.6) | `apps/web/src/components/cards/CardParts.tsx`, `apps/web/src/lib/chat/chatStreamClient.ts` | Yunus | **Partial**: card states implemented; chat states in the client, chat UI planned (Y-07, Y-08) |
| FR-20 | PostgreSQL telemetry store (Should) | Persistence & telemetry (§1.3) | — | — | **Not in PA3** |

### 2.2 Non-functional requirements

| Req. | Requirement (short) | Design component (section) | Code / configuration | Owner | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| NFR-01 | Cached P95 < 250 ms; 800 ms upstream timeout | Cache + gateway path (§1.2, §4.1) | `packages/connectors/src/resilience/` (timeout), `UPSTREAM_TIMEOUT_MS` | Arda, Sefa | **Partial**: timeout implemented; P95 not measured |
| NFR-02 | Cache hit ratio ≥ 90 % (Should) | Cache store (§4.1) | `packages/connectors/src/cache/` | Arda | **Not measured** |
| NFR-03 | Fault isolation per connector | Circuit breaker per connector (§2.2.3) | `packages/connectors/src/resilience/CircuitBreaker.ts` | Arda | **Implemented** in the connector package (see FR-11) |
| NFR-04 | Scalability, 100 users / 2 instances (Should) | Stateless services + Redis (§4.1) | — | Sefa | **Not in PA3** (not measured) |
| NFR-05 | Perimeter security, no token/PII leakage | Gateway perimeter, internal network, PII scrubber (§2.2.4, §2.3.6) | `apps/api-gateway/src/auth/`, `compose.yaml` (`internal` network, no host port for `mcp-server`/`redis`); PII scrubber planned (M-06) | Sefa, Murat | **Partial**: gateway side implemented and Compose isolation verified for 3 services; agent side planned |
| NFR-06 | Usability (SUS ≥ 70) | Dashboard and assistant layout (§2.4) | `apps/web/src/` | Yunus | **Not evaluated** (no usability session yet) |
| NFR-07 | Responsive layout 375 px – desktop | Responsive layout (§2.4.3) | `apps/web/src/app/globals.css`, `apps/web/src/**/*.module.css` | Yunus | **Partial**: checked at 375 px and desktop in Chrome; 768 / 1440 px and other browsers not yet (Y-10) |
| NFR-08 | Offline automated tests | Vitest suites (§5) | `vitest.config.mts`, `tests/`, `apps/*/tests/` | All | **Implemented**: 230 tests in 20 files, all passing on `dev` at `6cc1d07` (run 20 Nov 2026) |
| NFR-09 | Docker Compose deployment | Compose topology (Deployment Plan) | `compose.yaml`, `apps/api-gateway/Dockerfile`, `apps/web/Dockerfile`; `apps/mcp-server/Dockerfile` planned (M-13) | Sefa, Yunus, Murat | **Partial**: web + gateway + Redis verified in Compose; MCP server image missing |

---

## 3. Matrix B — Requirement → Test

**Test columns:**

- **QA Plan TC** — PA2 test cases from [`QA_Plan.md`](../QA_Plan.md) §3.1, with their status as recorded there.
- **Automated suites** — Vitest files that exercise the requirement; all were run on `dev` at `6cc1d07` (230/230 passed).
- **Acceptance** — PA3 acceptance tests and criteria from `Acceptance_Tests_and_Criteria.md` (PR #17, draft v0.2). **All four ATs: NOT RUN.**

| Req. | QA Plan TC (recorded status) | Automated suites | Acceptance test / criteria |
| :--- | :--- | :--- | :--- |
| FR-01 | TC-01, TC-02, TC-03 (Pass), TC-04 (Not run) | `tests/mcp-server/dispatcher.test.ts` | AT-01 (AC-01.5), AT-02 (AC-02.4) |
| FR-02 | — | `tests/mcp-server/dispatcher.test.ts` (transport not covered) | — (MCP Inspector check planned, M-09) |
| FR-03 | TC-01 (Pass) | `tests/connectors/mockConnectors.test.ts` | AT-01 (AC-01.2, AC-01.4) |
| FR-04 | TC-02 (Pass) | `tests/connectors/mockConnectors.test.ts` | AT-02 (AC-02.2, AC-02.3, AC-02.4) |
| FR-05 | TC-03 (Pass) | `tests/connectors/mockConnectors.test.ts` | AT-03 (AC-03.2 – AC-03.5) |
| FR-06 | TC-04 (Not run) | `tests/mcp-server/dispatcher.test.ts`, `apps/api-gateway/tests/queryProxy.test.ts` | AT-04 (AC-04.1, AC-04.5) |
| FR-07 | TC-04 (Not run), TC-07 (gateway + Redis pass; full E2E not run) | `apps/api-gateway/tests/jwtAuth.test.ts`, `queryProxy.test.ts`, `chatStreamProxy.test.ts` | AT-04 (AC-04.8, AC-04.9) |
| FR-08 | TC-07 (gateway + Redis pass) | `apps/api-gateway/tests/rateLimiter.test.ts` | — (not an acceptance criterion; QA evidence only) |
| FR-09 | TC-06 (Not run) | `tests/connectors/cacheStores.test.ts`, `tests/connectors/redisVsMemory.demo.test.ts` | AT-01 (AC-01.7), AT-02 (AC-02.7), AT-03 (AC-03.6) |
| FR-10 | TC-06 (Not run) | `tests/connectors/resilientExecutor.test.ts` | AT-03 (AC-03.7, conditional) |
| FR-11 | TC-06 (Not run) | `tests/connectors/circuitBreaker.test.ts` | — (QA evidence only) |
| FR-12 | TC-03 (Pass) | `tests/connectors/configAndFactory.test.ts`, `tests/connectors/mockConnectors.test.ts` | AT-01 (AC-01.6), AT-02 (AC-02.6), AT-03 (AC-03.5) |
| FR-13 | TC-08 (Not run) | — (agent tests planned, M-10) | AT-04 (AC-04.4, AC-04.6, AC-04.11) |
| FR-14 | TC-08 (Not run) | — (PII scrubber tests planned, M-10) | AT-04 (AC-04.7) |
| FR-15 | — | `apps/web/tests/auth.test.ts` | AT-01 (AC-01.8), AT-04 (AC-04.1, AC-04.2) |
| FR-16 | TC-05 (Pass) | `apps/web/tests/routeStudentQuery.test.ts`, `routeStudentQuery.heldout.test.ts` | AT-01..AT-04 (AC-01.1, AC-02.1, AC-03.1, AC-04.3) |
| FR-17 | — | `apps/web/tests/sseParser.test.ts`, `chatStreamClient.test.ts`, `apps/api-gateway/tests/chatStreamProxy.test.ts` | AT-04 (AC-04.4, AC-04.10) |
| FR-18 | — | `apps/web/tests/gatewayClient.test.ts`, `format.test.ts` | AT-01 (AC-01.1, AC-01.3), AT-02 (AC-02.1), AT-03 (AC-03.1) |
| FR-19 | — | `apps/web/tests/gatewayClient.test.ts`, `chatStreamClient.test.ts` | AT-02 (AC-02.5), AT-03 (AC-03.7), AT-04 (AC-04.12) — all conditional |
| FR-20 | — | — | — (not in PA3) |
| NFR-01 | TC-01, TC-02 (Pass), TC-05 (Pass) | — (no load test) | — (reported separately if measured; Acceptance doc §3.5) |
| NFR-02 | — | — | — (reported separately if measured) |
| NFR-03 | TC-06 (Not run) | `tests/connectors/circuitBreaker.test.ts` | — |
| NFR-04 | — | — | — (not in PA3) |
| NFR-05 | TC-04, TC-08 (Not run), TC-07 (gateway pass) | `apps/api-gateway/tests/jwtAuth.test.ts`, `deploymentConfig.test.ts` | AT-04 (AC-04.7, AC-04.8) |
| NFR-06 | — | — | AT-01 (AC-01.8, part 3); SUS not evaluated |
| NFR-07 | — | — (manual check) | AT-01 (AC-01.8) |
| NFR-08 | all TC | all suites (230 tests) | — |
| NFR-09 | — | `apps/api-gateway/tests/deploymentConfig.test.ts`; Compose smoke evidence `docs/assignment3/evidence/deployment/` | — (Deployment Plan) |

---

## 4. Use Case Summary

| Use case | Requirements (Design Document §3.1) | Acceptance test | Main components on the path | Blocking items for an end-to-end run |
| :--- | :--- | :--- | :--- | :--- |
| UC-01 Cafeteria menu | FR-01, FR-03, FR-09, FR-12, FR-16, FR-18 | AT-01 | web → Next.js rewrite → gateway → MCP → cafeteria connector | M-02 (real connector handlers in MCP), M-13 (MCP image) |
| UC-02 Shuttle schedule | FR-01, FR-04, FR-09, FR-12, FR-16, FR-18 | AT-02 | as UC-01, shuttle connector | M-02, M-13; `CONNECTOR_FIXED_NOW` (Arda, contract §8 Q3) |
| UC-03 Library occupancy | FR-01, FR-05, FR-09, FR-12, FR-16, FR-18 | AT-03 | as UC-01, library connector | M-02, M-13 |
| UC-04 Combined question | FR-01, FR-06, FR-07, FR-13, FR-14, FR-16, FR-17, FR-19 | AT-04 | web chat → gateway chat proxy → agent → 3 MCP tools → Gemini | M-02..M-08, M-13 (Murat); Y-07 chat screen (Yunus); Gemini API key |

---

## 5. Open Items and Pending Verification

| Item | Owner | Effect on this document |
| :--- | :--- | :--- |
| Connector handover (`handovers/arda.md`): confirm connector code paths, Redis runtime wiring (A-02) and `CONNECTOR_FIXED_NOW` (Q3) | Arda | FR-03..FR-06, FR-09..FR-12, NFR-01..NFR-03 rows stay "owner verification pending" until then |
| Real connector handlers in the MCP server (M-02), MCP Docker image (M-13) | Murat | FR-01, FR-03..FR-06, FR-10, FR-11 and NFR-09 statuses change after merge |
| Agent, PII scrubber and agent stream (M-04..M-08), agent tests (M-10) | Murat | FR-13, FR-14, FR-17, NFR-05 statuses and test rows change after merge |
| Chat screen (Y-07), chat states (Y-08), viewport checks (Y-10) | Yunus | FR-17, FR-19, NFR-07 |
| Acceptance test document merge (PR #17) and acceptance runs (S-07) | Yunus, Sefa | AC IDs above refer to draft v0.2; AT results go to the Test Results Report |

This document is updated whenever one of the items above is merged into `dev`.

---

## 6. Document-Specific Task Matrix

| Task ID | Work package | Lead | Contributors / reviewer | Status |
| :--- | :--- | :--- | :--- | :--- |
| TSK-TRC-01 | Matrix structure, MCP/shared/agent rows, compilation (M-12) | Murat Can Işık | Reviewer: Ahmet Sefa Efendioğlu (QA traceability, S-12) | Draft (v0.1) |
| TSK-TRC-02 | Web client rows | Yunus Emre Biçer (handover §3) | Compiled by Murat | Done (from handover) |
| TSK-TRC-03 | Gateway, security and deployment rows | Ahmet Sefa Efendioğlu (handover) | Compiled by Murat | Done (from handover) |
| TSK-TRC-04 | Connector rows verification | Arda Çelik | Compiled by Murat from code | Pending (handover needed) |
