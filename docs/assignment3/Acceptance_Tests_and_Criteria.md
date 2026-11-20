# Acceptance Tests and Acceptance Criteria

**Campus Data Orchestrator — Model Context Protocol (MCP) Based Campus Data Orchestrator**

| Field | Detail |
| :--- | :--- |
| **Course** | BIL 481 Software Engineering, Fall 2026, TOBB University of Economics and Technology |
| **Assignment** | Project Assignment 3 — Deliverable 2: Acceptance Tests and Acceptance Criteria |
| **Group Name** | Group-ASYM |
| **Document Lead & Author** | **Yunus Emre Biçer** (241101009) — `@YunusEmre113` |
| **Document Version / Date** | **Version 0.4 (draft for team review), 20 November 2026** — see §9 Change Record |
| **Repository Filepath** | `docs/assignment3/Acceptance_Tests_and_Criteria.md` |
| **Related Documents** | `docs/Requirements_Document.md` (FR/NFR IDs), `docs/Design_Document.md` §3 (UC-01..UC-04), `docs/QA_Plan.md` (TC-01..TC-08), API Contract v1.1 (to be committed as `docs/assignment3/contracts/API_CONTRACT.md`), `docs/assignment3/Deployment_Plan.md` and `docs/assignment3/Test_Results_Report.md` (both in preparation, lead: Ahmet Sefa Efendioğlu) |

> **Status of this draft.** This document defines *how* the four selected scenarios will be accepted and *what* counts as a pass. It does **not** contain test results: actual results, dates, commit SHAs and logs are recorded only in the Test Results Report after the tests are executed. Steps for the chat screen, which is not built yet, are written at the level of observable behaviour and will be made concrete before the planned freeze on 26 November 2026.

## List of Contributors

| Member | Student ID | GitHub | Role in this document | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Yunus Emre Biçer** | 241101009 | `@YunusEmre113` | Lead author: structure, acceptance criteria, AT-01..AT-04, traceability, task matrix | Drafted v0.1 |
| **Arda Çelik** | 241101065 | `@ardacelik11` | Review of data, cache and stale-fallback criteria (AC-01.x, AC-02.x, AC-03.x) | Review requested |
| **Murat Can Işık** | 241101013 | `@cmuratt` | Review of MCP and agent criteria (AC-04.3 – AC-04.7, AC-04.10, AC-04.11) | Reviewed — no objection (PR #17 review, 20 Nov 2026) |
| **Ahmet Sefa Efendioğlu** | 241101066 | `@Sefa-Efendioglu` | Review of gateway, security and end-to-end execution conditions (AC-04.1, AC-04.8, AC-04.9) | Reviewed — approved with two notes (PR #17 comment, 20 Nov 2026) |

Only the work listed as done is claimed. Review rows become "Reviewed" when the reviewer has actually reviewed the section (PR review or written approval).

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Acceptance Approach](#2-acceptance-approach)
3. [Acceptance Criteria](#3-acceptance-criteria)
4. [Acceptance Tests](#4-acceptance-tests)
   - 4.1 [AT-01 — UC-01 View Cafeteria Menu](#41-at-01--uc-01-view-cafeteria-menu)
   - 4.2 [AT-02 — UC-02 View Shuttle Schedule](#42-at-02--uc-02-view-shuttle-schedule)
   - 4.3 [AT-03 — UC-03 View Library Occupancy](#43-at-03--uc-03-view-library-occupancy)
   - 4.4 [AT-04 — UC-04 Combined Course, Shuttle and Menu Question](#44-at-04--uc-04-combined-course-shuttle-and-menu-question)
5. [How Each Test Corresponds to the Acceptance Criteria](#5-how-each-test-corresponds-to-the-acceptance-criteria)
6. [Traceability](#6-traceability)
7. [Scope Limits and Known Gaps](#7-scope-limits-and-known-gaps)
8. [Document-Specific Task Matrix](#8-document-specific-task-matrix)
9. [Change Record](#9-change-record)
10. [Appendix A — Execution Record Template](#appendix-a--execution-record-template)
11. [Appendix B — Direct API Requests Used by the Tests](#appendix-b--direct-api-requests-used-by-the-tests)

---

## 1. Introduction

### 1.1 Purpose

Project Assignment 3 requires clear and measurable acceptance criteria for the four scenarios selected in the Assignment 2 Design Document, exactly four acceptance tests based on those criteria, and an explanation of how each test corresponds to the criteria. This document provides all three for the Campus Data Orchestrator.

### 1.2 Scope: the four selected scenarios

| Use case | Scenario | Path through the system | Linked requirements (Design Document §3.1) |
| :--- | :--- | :--- | :--- |
| **UC-01** | View today's lunch and dinner menu | Dashboard card → gateway `POST /api/v1/query` → MCP `get_cafeteria_menu` → cafeteria connector | FR-01, FR-03, FR-09, FR-12, FR-16, FR-18 |
| **UC-02** | View upcoming departures of a shuttle route | Dashboard card → gateway → MCP `get_shuttle_schedule` → shuttle connector | FR-01, FR-04, FR-09, FR-12, FR-16, FR-18 |
| **UC-03** | View total and per-floor library occupancy | Dashboard card → gateway → MCP `get_library_occupancy` → library connector | FR-01, FR-05, FR-09, FR-12, FR-16, FR-18 |
| **UC-04** | Ask *"10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?"* | Login → assistant → gateway `POST /api/v1/chat/stream` → agent → `get_course_schedule` + `get_shuttle_schedule` + `get_cafeteria_menu` → streamed answer | FR-01, FR-06, FR-07, FR-13, FR-14, FR-16, FR-17, FR-19 |

### 1.3 Relation to other tests

- **AT-01..AT-04** (this document) are *acceptance* tests: they validate that a user can complete each scenario end to end through the deployed system.
- **TC-01..TC-08** (`docs/QA_Plan.md`) and the automated unit/integration suites (Vitest) are *verification* tests. They support the acceptance tests as evidence but do not replace them and do not change the number of acceptance tests (exactly four).
- **Results** of AT-01..AT-04 are reported in `docs/assignment3/Test_Results_Report.md` (lead: Ahmet Sefa Efendioğlu), not here.

### 1.4 Terms

| Term | Meaning in this document |
| :--- | :--- |
| Direct path | Query answered by a dashboard card through `POST /api/v1/query`, without the LLM agent (`DIRECT_WIDGET` route) |
| Agent path | Query sent to `POST /api/v1/chat/stream` and answered by the LLM agent (`LLM_AGENT` route) |
| `meta.source` | Execution source of a response: `LIVE` (fresh connector run, may still be synthetic), `CACHE_HIT`, `STALE`, `ERROR` (API Contract v1.1 §1) |
| `meta.isSimulated` | `true` when the data is synthetic (mock connector); reported separately from `meta.source` |
| Test clock | The campus time (UTC+3) used by the connectors during a run; fixed with `CONNECTOR_FIXED_NOW` when available (§2.3) |
| Mandatory / Conditional criterion | Mandatory criteria decide PASS/FAIL. Conditional criteria are checked when the stated condition holds; otherwise they are reported as `NOT RUN` with the reason and do not by themselves fail the test |

---

## 2. Acceptance Approach

### 2.1 Test level and method

All four tests are **system-level acceptance (validation) tests** executed against the deployed demo stack described in the Deployment Plan: web client, Fastify gateway, MCP server with agent, connectors and cache. Each test combines user-facing steps in the browser with inspection of the HTTP traffic and server logs that the steps produce. Direct API requests (Appendix B) are used only for inputs that the user interface intentionally cannot produce (for example an impossible date or an unknown route).

### 2.2 Data source declaration

No official TOBB ETÜ campus interface is available to the project. All four connectors run in **mock mode** with deterministic synthetic data (`*_CONNECTOR_MODE=mock`, `CONNECTOR_MOCK_SEED`). Every acceptance criterion about data therefore checks *consistency and correct presentation of synthetic data*, never correctness against the real campus. Synthetic data must be labelled as such in the user interface (`meta.isSimulated: true` → "Sentetik veri" badge).

### 2.3 Test environment and test data

| Item | Value |
| :--- | :--- |
| Deployment | Local demo deployment as documented in the Deployment Plan (Docker Compose when available) |
| Browser | Latest stable Chrome; viewport 1440 px (desktop) and 375 px (mobile check in AT-01) |
| Data mode | `MOCK` for all connectors (§2.2) |
| Web data source | `NEXT_PUBLIC_WEB_DATA_SOURCE=gateway`. Runs in `fixtures` mode do not count as acceptance runs |
| Weekday test date | Monday **2026-11-23** |
| Weekend test date | Sunday **2026-11-22** |
| Test clock | `CONNECTOR_FIXED_NOW=2026-11-23T09:00:00+03:00` if supported (API Contract v1.1 §8 Q3, owner Arda Çelik). If not supported at execution time, the real clock is used and the execution time is recorded so that "future departure" checks can be compared against it |
| Test user | Synthetic student created through `POST /api/v1/auth/mock-login` (e.g. `demo-student-01`); no real identity, token or API key is written into evidence |
| LLM provider | Real Gemini provider for AT-04 (`GEMINI_API_KEY` from environment only) |

### 2.4 Evidence rules

- Evidence is stored under `docs/assignment3/evidence/AT-0x/` using the record in Appendix A.
- Allowed evidence: screenshots, redacted browser network entries (HAR excerpts), redacted gateway/MCP/agent log excerpts, test command output.
- Tokens, API keys, real names and real student numbers are never written into evidence. JWTs are shown at most as `eyJ…<redacted>`.

### 2.5 Pass / fail rules

| Status | Rule |
| :--- | :--- |
| **PASS** | Every mandatory criterion of the test was checked in an acceptance run and met |
| **FAIL** | At least one mandatory criterion was checked and not met |
| **NOT RUN** | The test could not be executed (e.g. a component was not deployed). The reason and the blocking component are recorded |
| **BLOCKED** | Execution started but could not be completed because of an external dependency (e.g. LLM quota). Treated as not passed |

Additional rules:

1. A run in web `fixtures` mode, or with a fake LLM provider, is **never** an acceptance PASS. Such runs may be reported as supporting evidence only.
2. A failed or not-run test is reported with its cause and a proposed fix; it is not hidden or re-labelled.
3. Each recorded result references the contract version (API Contract v1.1) and the tested commit SHA.

---

## 3. Acceptance Criteria

Criteria are numbered `AC-<UC>.<n>`. "How it is measured" names the observable that decides the criterion. All thresholds come from the Requirements Document unless stated otherwise.

### 3.1 UC-01 — View Cafeteria Menu

| ID | Criterion | How it is measured | Threshold | Source | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| AC-01.1 | A single-domain menu question takes the direct path | Router decision shown in the query box; browser network log during the step | Decision = "Doğrudan kart" (`DIRECT_WIDGET`, `get_cafeteria_menu`); 0 requests to `/api/v1/chat/stream`; 0 LLM provider requests in the agent log | FR-16, FR-18, Design §3.2 postcondition | Mandatory |
| AC-01.2 | A weekday menu is complete | `data` of the `POST /api/v1/query` response for 2026-11-23 | `available = true`; `lunch` and `dinner` present; `lunch.calories > 0` and `dinner.calories > 0` | FR-03 | Mandatory |
| AC-01.3 | The card shows exactly what the gateway returned | Compare card text with the response `data` | Soup, main dish, side dish, vegetarian option and calories of both meals match; allergens are listed when present | FR-18 | Mandatory |
| AC-01.4 | A weekend day is explained, not treated as an error | Response and card for 2026-11-22 | HTTP 200, `available = false`, non-empty `unavailableReason`; the card shows the reason; no error message | FR-03, Design §3.2 alt. flow | Mandatory |
| AC-01.5 | An impossible date is rejected before any connector call | Direct API request with `date = "2026-99-77"` (Appendix B) | HTTP 400, `error.code = "INVALID_PARAMS"`; no cafeteria connector execution in the MCP log for that request | FR-01 (criterion 2), API Contract §3.4 | Mandatory |
| AC-01.6 | Synthetic data is labelled and not called "MOCK" as a source | Response `meta` and card badges | `meta.isSimulated = true`; `meta.source ∈ {LIVE, CACHE_HIT}`; card shows "Sentetik veri" | FR-12, API Contract §1 | Mandatory |
| AC-01.7 | A repeated request within the TTL is served from cache | Two identical requests less than 3600 s apart (card "Yenile") | Second response `meta.source = "CACHE_HIT"`, `meta.isStale = false`; the connector is executed once for the two requests (MCP/connector log) | FR-09 | Mandatory |
| AC-01.8 | The menu is reachable without login and fits a phone screen | Open the landing page as a guest at 1440 px and 375 px | Menu card visible on the landing page without login; no horizontal scrolling at 375 px | FR-15, NFR-06 (3), NFR-07 | Mandatory |

### 3.2 UC-02 — View Shuttle Schedule

| ID | Criterion | How it is measured | Threshold | Source | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| AC-02.1 | A single-domain shuttle question takes the direct path | Router decision; network and agent log | `DIRECT_WIDGET` → `get_shuttle_schedule`; 0 chat requests; 0 LLM requests | FR-16, FR-18 | Mandatory |
| AC-02.2 | Only future departures, in order | `data.nextDepartures` against the test clock | Every value is strictly later than the test clock; values are in ascending order; at most the configured count | FR-04 | Mandatory |
| AC-02.3 | The selected route is the one shown | Select Ana Ring, Metro, Yurtlar in turn | `data.routeId` equals the selection (`MAIN_RING`, `METRO_LINE`, `DORMITORY_LINE`); card title shows the matching `routeName` | FR-04 | Mandatory |
| AC-02.4 | An unknown route is rejected | Direct API request with `route = "NOWHERE"` (Appendix B) | HTTP 400, `error.code = "INVALID_PARAMS"`; message names the valid values or is a safe generic message | FR-04, FR-01, API Contract §3.4 | Mandatory |
| AC-02.5 | End of service is shown as an empty state | Request after the last departure of a route (test clock ≥ 22:00, e.g. `DORMITORY_LINE` after 21:45) | `nextDepartures = []`; card shows "Bugün bu hatta başka sefer yok."; no error | Design §3.3 alt. flow, FR-19 | Conditional — requires a settable test clock or execution after 22:00 |
| AC-02.6 | Synthetic data is labelled | `meta` and card badges | `meta.isSimulated = true`; "Sentetik veri" visible; no claim of real GPS data | FR-12 | Mandatory |
| AC-02.7 | A repeated request within the TTL is served from cache | Two identical requests less than 120 s apart | Second `meta.source = "CACHE_HIT"`; connector executed once | FR-09 | Mandatory |

### 3.3 UC-03 — View Library Occupancy

| ID | Criterion | How it is measured | Threshold | Source | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| AC-03.1 | A single-domain library question takes the direct path | Router decision; network and agent log | `DIRECT_WIDGET` → `get_library_occupancy`; 0 chat requests; 0 LLM requests | FR-16, FR-18 | Mandatory |
| AC-03.2 | Seat counts are within bounds | `data.floors[]` for `floor = ALL` | `0 ≤ occupiedSeats ≤ maxSeats` for every floor | FR-05 | Mandatory |
| AC-03.3 | Totals equal the sum of the floors | `data` for `floor = ALL` | `totalOccupied = Σ occupiedSeats`; `totalCapacity = Σ maxSeats`; card percentage = `round(totalOccupied / totalCapacity × 100)` | FR-05 | Mandatory |
| AC-03.4 | A single floor shows only that floor | Select "2. kat" (`FLOOR_3`) | `floors` contains only `FLOOR_3`; totals equal that floor's values; the floor's numbers equal its entry in an `ALL` response taken in the same 60 s cache window | FR-05 | Mandatory |
| AC-03.5 | Library data is always labelled synthetic | `data.isSimulated`, `meta.isSimulated`, card | Both flags `true`; "Sentetik veri" visible | FR-05, FR-12 | Mandatory |
| AC-03.6 | A repeated request within the TTL is served from cache | Two identical requests less than 60 s apart | Second `meta.source = "CACHE_HIT"`; connector executed once | FR-09 | Mandatory |
| AC-03.7 | During a connector failure, cached data is served with a freshness warning | Fault injected into the library connector after a successful request and after the TTL expired | HTTP 200, `meta.source = "STALE"`, `meta.isStale = true`, `meta.timestamp` = original cache time; card shows the stale warning with that time | FR-10, FR-19 | Conditional — requires fault injection in the demo deployment; otherwise covered by TC-06 and reported `NOT RUN` |

### 3.4 UC-04 — Combined Course, Shuttle and Menu Question

| ID | Criterion | How it is measured | Threshold | Source | Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| AC-04.1 | Personal data and chat are protected for guests | Guest request for `get_course_schedule` (Appendix B); assistant page as guest | HTTP 401, `error.code = "AUTHENTICATION_REQUIRED"`; assistant shows the login requirement and does not send chat requests | FR-06 (1), FR-15, API Contract §1 "Chat access" | Mandatory |
| AC-04.2 | A synthetic student can log in | Mock login in the web client | Session indicator shows the logged-in synthetic student; assistant input becomes enabled | FR-15 | Mandatory |
| AC-04.3 | The compound question takes the agent path | Router decision for the UC-04 question | `LLM_AGENT` with reason `COMPOUND_QUERY`; exactly one `POST /api/v1/chat/stream` request | FR-16 | Mandatory |
| AC-04.4 | The agent really executes the three tools, once each | SSE `tool` events and agent/MCP log | Exactly three tool executions: `get_course_schedule`, `get_shuttle_schedule`, `get_cafeteria_menu`; one `tool` event and one UI badge per execution, each with a status and `durationMs` | FR-13, FR-17 | Mandatory |
| AC-04.5 | No student identity in tool arguments | Arguments of every `tools/call` in the MCP log | No `studentId` (or any identity field) in any arguments; the course schedule is resolved from the gateway-verified identity | FR-06 (2), API Contract §1 "Tool identity" | Mandatory |
| AC-04.6 | The answer is consistent with the tool results | Compare the final `done.answer` with the three tool results | The answer (a) uses the end time of the relevant class from `get_course_schedule`, (b) names a departure from `get_shuttle_schedule` that is later than that end time, or states that none exists, and (c) mentions at least one dish from `get_cafeteria_menu`, or the closed reason; it does not invent values absent from the results and indicates that the data is synthetic | FR-13 | Mandatory |
| AC-04.7 | No raw token or PII reaches the LLM provider | Outbound provider request log / interception for the run | 0 occurrences of the raw JWT; 0 occurrences of the student ID, name or e-mail of the test user | FR-14, NFR-05 (3) | Mandatory |
| AC-04.8 | The gateway terminates the token and ignores forged identity headers, and the MCP server cannot be reached around the gateway | Internal gateway → MCP/agent request log; request with a forged `X-Authenticated-Student-Id` header; Compose port bindings of `mcp-server`; a direct request from the host to the MCP port with a forged header | No `Authorization` header on internal requests; a browser-supplied `X-Authenticated-*` header is removed and never changes whose schedule is returned; `mcp-server` publishes no port to the host (only the internal Compose network), so the direct request to `/mcp` cannot connect | FR-07, NFR-05, API Contract §1, §4 | Mandatory |
| AC-04.9 | Invalid tokens are rejected | Chat or course-schedule request with an expired token and with a tampered token | HTTP 401 for both; no tool execution | FR-07 | Mandatory |
| AC-04.10 | The answer is streamed | Browser view and SSE frames | First answer text rendered before the `done` event; `done` received exactly once with `isComplete = true` and `toolsInvoked` matching AC-04.4 | FR-17, API Contract §3.3 | Mandatory |
| AC-04.11 | The real LLM provider was used | Agent configuration and provider log for the run | Requests went to the real Gemini provider (not the fake test provider) | API Contract §3.3, team guide §6 | Mandatory |
| AC-04.12 | Slow answers are handled visibly | Response time of the run | If no answer within 5 s, a "still processing" indicator is shown; at 20 s the request is cancelled with a retry option | FR-19, Design §3.5 | Conditional — checked when the run exceeds 5 s, or by a throttled-network repetition |

### 3.5 Non-functional criteria outside the acceptance decision

The following requirement targets are related to the four scenarios but cannot be decided by a single functional run. They are measured separately (or reported as not measured) and **do not decide** AT-01..AT-04:

| Requirement | Target | Where it is reported |
| :--- | :--- | :--- |
| NFR-01 | Cached P95 < 250 ms (20 users, 5 min); connector timeout 800 ms | Test Results Report, "quality metrics" section, if a load test is run |
| NFR-02 | Cache hit ratio ≥ 90 % | Same, if measured |
| NFR-06 (1, 2) | SUS ≥ 70 with ≥ 5 student testers; ≥ 80 % "easy to use" | Reported as *not evaluated* unless a usability session takes place |
| FR-13 benchmark | ≥ 8/10 correct on 10 scripted compound questions | Murat Can Işık's agent evidence; AT-04 uses one scripted question |

---

## 4. Acceptance Tests

Each test lists preconditions, the test data, numbered steps with the expected observation and the criteria each step checks, the pass/fail rule and the evidence to collect. The execution record (date, SHA, executor, actual result, status, issues) is filled in the Test Results Report using Appendix A.

### 4.1 AT-01 — UC-01 View Cafeteria Menu

| Field | Value |
| :--- | :--- |
| **Use case / requirements** | UC-01 / FR-01, FR-03, FR-09, FR-12, FR-15, FR-16, FR-18; NFR-06 (3), NFR-07 |
| **Supporting tests** | TC-01, TC-05; `apps/web/tests/gatewayClient.test.ts`, `apps/web/tests/routeStudentQuery*.test.ts`, `apps/api-gateway/tests/queryProxy.test.ts`, `tests/mcp-server/httpConnectors.test.ts`, `tests/connectors/mockConnectors.test.ts` |
| **Actor** | Guest user |
| **Level** | System / acceptance (validation) |
| **Responsibilities** | UI evidence: Yunus Emre Biçer · data and cache evidence: Arda Çelik · end-to-end execution: Ahmet Sefa Efendioğlu |
| **Preconditions** | Demo stack running per Deployment Plan; connectors in mock mode; web data source `gateway`; browser network log and server logs recording; not logged in |
| **Test data** | Weekday 2026-11-23, weekend 2026-11-22, impossible date 2026-99-77 |

| Step | Action | Expected observation | Checks |
| :---: | :--- | :--- | :--- |
| 1 | Open the landing page ("Kampüs Özeti") as a guest at 1440 px | Menu card ("Yemekhane Menüsü") is visible and loads without login | AC-01.8 |
| 2 | Type *"Bugün yemekte ne var?"* into the query box and press "Sor" | Decision "Doğrudan kart: Yemekhane menüsü"; menu card is highlighted; network log shows no `/api/v1/chat/stream` request; agent log shows no provider request | AC-01.1 |
| 3 | In the menu card set the date to 2026-11-23 | One `POST /api/v1/query` with `{"toolName":"get_cafeteria_menu","parameters":{"date":"2026-11-23"}}`; HTTP 200; `available = true`; both meals with calories > 0 | AC-01.2 |
| 4 | Compare every value shown in the card with the response `data` | All dishes, the vegetarian option, calories and allergens match | AC-01.3 |
| 5 | Inspect the response `meta` and the card badges | `isSimulated = true`; `source` is `LIVE` or `CACHE_HIT`; "Sentetik veri" badge visible | AC-01.6 |
| 6 | Press "Yenile" within 3600 s of step 3 | Second response `source = "CACHE_HIT"`, `isStale = false`; MCP/connector log shows one connector execution for the two requests | AC-01.7 |
| 7 | Set the date to 2026-11-22 | HTTP 200, `available = false`; the card shows the closed reason instead of meals; no error message | AC-01.4 |
| 8 | Send the impossible-date request from Appendix B | HTTP 400, `error.code = "INVALID_PARAMS"`; no cafeteria connector execution for this request in the MCP log | AC-01.5 |
| 9 | Switch the viewport to 375 px and reload | Menu card fully visible; no horizontal scroll bar | AC-01.8 |

**Pass/fail rule:** PASS if steps 1–9 all show the expected observation. Any deviation in a mandatory criterion is a FAIL.

**Evidence:** screenshots of steps 2, 3, 7 and 9; redacted network entries of steps 3, 6, 7, 8; MCP/connector log excerpt for steps 6 and 8; agent log excerpt showing no provider request during steps 2–7.

### 4.2 AT-02 — UC-02 View Shuttle Schedule

| Field | Value |
| :--- | :--- |
| **Use case / requirements** | UC-02 / FR-01, FR-04, FR-09, FR-12, FR-16, FR-18, FR-19 |
| **Supporting tests** | TC-02, TC-05; `apps/web/tests/gatewayClient.test.ts`, `apps/api-gateway/tests/queryProxy.test.ts`, `tests/mcp-server/httpConnectors.test.ts`, `tests/connectors/mockConnectors.test.ts` |
| **Actor** | Guest user |
| **Level** | System / acceptance (validation) |
| **Responsibilities** | UI evidence: Yunus Emre Biçer · data and cache evidence: Arda Çelik · end-to-end execution: Ahmet Sefa Efendioğlu |
| **Preconditions** | As AT-01; test clock fixed to 2026-11-23 09:00 (UTC+3) if supported, otherwise execution time recorded |
| **Test data** | Routes `MAIN_RING`, `METRO_LINE`, `DORMITORY_LINE`; invalid route `NOWHERE` |

| Step | Action | Expected observation | Checks |
| :---: | :--- | :--- | :--- |
| 1 | Type *"Sonraki ring kaçta?"* and press "Sor" | Decision "Doğrudan kart: Ring seferleri"; ring card highlighted; no chat request; no provider request | AC-02.1 |
| 2 | In the ring card select "Ana Ring" | `POST /api/v1/query` with `route = "MAIN_RING"`; `routeId = "MAIN_RING"`; card title shows the route name | AC-02.3 |
| 3 | Check `nextDepartures` against the test clock | Every departure strictly later than the test clock; ascending order; card lists them as `HH:mm` | AC-02.2 |
| 4 | Inspect `meta` and badges | `isSimulated = true`; "Sentetik veri" visible | AC-02.6 |
| 5 | Press "Yenile" within 120 s of step 2 | Second response `source = "CACHE_HIT"`; one connector execution for both requests | AC-02.7 |
| 6 | Select "Metro", then "Yurtlar" | `routeId` = `METRO_LINE`, then `DORMITORY_LINE`; departures again future and ascending | AC-02.3, AC-02.2 |
| 7 | Send the invalid-route request from Appendix B | HTTP 400, `error.code = "INVALID_PARAMS"` | AC-02.4 |
| 8 | *(Conditional)* With the test clock set to 2026-11-23 22:30, select "Yurtlar" | `nextDepartures = []`; card shows "Bugün bu hatta başka sefer yok." | AC-02.5 |

**Pass/fail rule:** PASS if steps 1–7 show the expected observation and step 8 either passes or is `NOT RUN` with the reason "no settable test clock". A failure in step 8, when executed, is a FAIL.

**Evidence:** screenshots of steps 1, 3, 6 (and 8 if run); network entries of steps 2, 5, 6, 7; connector log for step 5; the test clock value used.

### 4.3 AT-03 — UC-03 View Library Occupancy

| Field | Value |
| :--- | :--- |
| **Use case / requirements** | UC-03 / FR-01, FR-05, FR-09, FR-10, FR-12, FR-16, FR-18, FR-19 |
| **Supporting tests** | TC-03, TC-05, TC-06; `apps/web/tests/gatewayClient.test.ts`, `apps/api-gateway/tests/queryProxy.test.ts`, `tests/mcp-server/httpConnectors.test.ts`, `tests/connectors/resilientExecutor.test.ts` |
| **Actor** | Guest user |
| **Level** | System / acceptance (validation) |
| **Responsibilities** | UI evidence: Yunus Emre Biçer · data, cache and fault-injection evidence: Arda Çelik · end-to-end execution: Ahmet Sefa Efendioğlu |
| **Preconditions** | As AT-01. For step 7, a way to make the library connector fail in the demo deployment (e.g. fault-injection configuration provided by the connector owner) |
| **Test data** | Floors `ALL`, `FLOOR_3` |

| Step | Action | Expected observation | Checks |
| :---: | :--- | :--- | :--- |
| 1 | Type *"Kütüphanede boş yer var mı?"* and press "Sor" | Decision "Doğrudan kart: Kütüphane doluluğu"; no chat request; no provider request | AC-03.1 |
| 2 | In the library card keep "Tüm katlar" | `floor = "ALL"`; three floors returned | AC-03.2 |
| 3 | Check each floor and the totals | `0 ≤ occupiedSeats ≤ maxSeats`; `totalOccupied` and `totalCapacity` equal the sums; card percentage and "x / y koltuk" match | AC-03.2, AC-03.3 |
| 4 | Inspect flags and badges | `data.isSimulated = true`, `meta.isSimulated = true`; "Sentetik veri" visible | AC-03.5 |
| 5 | Within 60 s select "2. kat" | Only `FLOOR_3` returned; totals equal that floor; numbers equal the `FLOOR_3` entry from step 2 | AC-03.4 |
| 6 | Select "Tüm katlar" again within 60 s of step 2 | `source = "CACHE_HIT"`; one connector execution for the two `ALL` requests | AC-03.6 |
| 7 | *(Conditional)* Wait until the 60 s TTL has expired, make the library connector fail, then press "Yenile" | HTTP 200 with `source = "STALE"`, `isStale = true`, original timestamp; the card shows "Bu bilgi güncel olmayabilir" with that time | AC-03.7 |

**Pass/fail rule:** PASS if steps 1–6 show the expected observation and step 7 either passes or is `NOT RUN` with the reason "fault injection not available in the demo deployment" (TC-06 is then cited as supporting evidence).

**Evidence:** screenshots of steps 3, 5 (and 7 if run); network entries of steps 2, 5, 6, 7; connector/fault log for step 7.

### 4.4 AT-04 — UC-04 Combined Course, Shuttle and Menu Question

| Field | Value |
| :--- | :--- |
| **Use case / requirements** | UC-04 / FR-01, FR-06, FR-07, FR-13, FR-14, FR-15, FR-16, FR-17, FR-19; NFR-05 |
| **Supporting tests** | TC-04, TC-05, TC-07, TC-08; `apps/api-gateway/tests/jwtAuth.test.ts`, `apps/api-gateway/tests/queryProxy.test.ts`, `apps/api-gateway/tests/chatStreamProxy.test.ts`, `apps/api-gateway/tests/deploymentConfig.test.ts`, `apps/web/tests/auth.test.ts`, `apps/web/tests/chatStreamClient.test.ts`, `tests/mcp-server/dispatcher.test.ts`; agent and PII-scrubber tests (planned, M-04/M-06) |
| **Actor** | Authenticated synthetic student |
| **Level** | System / acceptance (validation) |
| **Responsibilities** | Agent and tool-call evidence: Murat Can Işık · chat UI evidence: Yunus Emre Biçer · schedule data: Arda Çelik · authentication, security checks and end-to-end execution: Ahmet Sefa Efendioğlu |
| **Preconditions** | Demo stack running with the real Gemini provider; outbound provider requests logged or intercepted (redacted); synthetic test student available through mock login; test clock as in AT-02 |
| **Test data** | Question *"10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?"*; synthetic student `demo-student-01`; an expired token and a tampered token generated for the test |

| Step | Action | Expected observation | Checks |
| :---: | :--- | :--- | :--- |
| 1 | As a guest, send the guest course-schedule request from Appendix B; open "Asistan" | HTTP 401 `AUTHENTICATION_REQUIRED`; assistant shows the login requirement; no chat request can be sent | AC-04.1 |
| 2 | Press "Giriş yap", select "Demo Öğrenci 1" (`demo-student-01`) on the login page and press "Giriş yap" | Redirected back to "Asistan"; the header shows "Demo Öğrenci 1", the student number and "Çıkış"; assistant input enabled | AC-04.2 |
| 3 | Enter the test question and send it | Router decision `LLM_AGENT` (`COMPOUND_QUERY`); exactly one `POST /api/v1/chat/stream` | AC-04.3 |
| 4 | Watch the answer arrive | Answer text appears before the stream ends; three tool badges appear, one per tool, each with status and duration; `done` arrives once with `isComplete = true` | AC-04.4, AC-04.10 |
| 5 | Inspect the agent/MCP log for the run | Exactly three `tools/call` executions with the three tool names; no `studentId` or other identity field in any arguments | AC-04.4, AC-04.5 |
| 6 | Compare `done.answer` with the three tool results from the log | Class end time, a later departure (or "none"), and a dish (or the closed reason) are all taken from the results; nothing invented; synthetic data indicated | AC-04.6 |
| 7 | Inspect the outbound provider requests of the run | Real Gemini endpoint; 0 occurrences of the raw JWT, student ID, name or e-mail | AC-04.7, AC-04.11 |
| 8 | Inspect internal gateway → MCP/agent requests; repeat step 3 with a forged `X-Authenticated-Student-Id` header added by the client; check the `mcp-server` port bindings and send the direct MCP request from Appendix B from the host | No `Authorization` header internally; the forged header is removed and the schedule in the answer still belongs to the logged-in student; `mcp-server` has no host port binding and the direct request to `/mcp` fails to connect | AC-04.8 |
| 9 | Repeat the chat request with an expired token, then with a tampered token | HTTP 401 for both; no tool executions logged | AC-04.9 |
| 10 | *(Conditional)* If step 4 took more than 5 s, or in a repetition with network throttling | "Still processing" indicator after 5 s; cancel with retry at 20 s | AC-04.12 |

**Pass/fail rule:** PASS if steps 1–9 show the expected observation with the real provider, and step 10 either passes or is `NOT RUN` because the response was faster than 5 s and no throttled repetition was made. A run with the fake provider, or in web `fixtures` mode, is reported as supporting evidence and the test status is `NOT RUN` or `FAIL`, never PASS (§2.5).

**Evidence:** screenshots/video of steps 1–4; redacted SSE trace (frames `tool`, `token`, `done`); redacted agent/MCP log for steps 5 and 8; `mcp-server` port bindings (e.g. `docker compose ps` / `docker inspect`) and the failed direct request for step 8; redacted outbound provider request log for step 7; HTTP responses for steps 1 and 9.

---

## 5. How Each Test Corresponds to the Acceptance Criteria

| Test | Criteria checked | Correspondence |
| :--- | :--- | :--- |
| **AT-01** | AC-01.1 – AC-01.8 | Each criterion is decided by one step: routing (step 2), completeness (3), presentation (4), labelling (5), caching (6), weekend behaviour (7), input validation (8), guest access and layout (1, 9). Together they cover the UC-01 main flow and both alternative flows from Design Document §3.2. |
| **AT-02** | AC-02.1 – AC-02.7 | Routing (1), route selection for all three routes (2, 6), future/ascending departures (3, 6), labelling (4), caching (5), invalid route (7) and end-of-service (8, conditional) follow the UC-02 main and alternative flows of Design §3.3. |
| **AT-03** | AC-03.1 – AC-03.7 | Routing (1), seat bounds and totals (2, 3), single-floor isolation (5), labelling (4), caching (6) and stale fallback (7, conditional) follow Design §3.4, including its connector-outage alternative flow. |
| **AT-04** | AC-04.1 – AC-04.12 | Steps follow the UC-04 main flow of Design §3.5 in order: protection for guests (1), login (2), agent routing (3), streamed answer with one badge per tool (4), real tool execution without identity arguments (5), answer consistency (6), privacy towards the LLM (7), token termination (8), invalid tokens (9) and slow-response handling (10, conditional). |

Coverage check: every criterion in §3 is checked by at least one step, and every step checks at least one criterion.

| Criterion → step | AT step(s) |
| :--- | :--- |
| AC-01.1 / .2 / .3 / .4 / .5 / .6 / .7 / .8 | AT-01 2 / 3 / 4 / 7 / 8 / 5 / 6 / 1, 9 |
| AC-02.1 / .2 / .3 / .4 / .5 / .6 / .7 | AT-02 1 / 3, 6 / 2, 6 / 7 / 8 / 4 / 5 |
| AC-03.1 / .2 / .3 / .4 / .5 / .6 / .7 | AT-03 1 / 2, 3 / 3 / 5 / 4 / 6 / 7 |
| AC-04.1 / .2 / .3 / .4 / .5 / .6 | AT-04 1 / 2 / 3 / 4, 5 / 5 / 6 |
| AC-04.7 / .8 / .9 / .10 / .11 / .12 | AT-04 7 / 8 / 9 / 4 / 7 / 10 |

---

## 6. Traceability

### 6.1 Requirement → acceptance criterion → test

| Requirement | Acceptance criteria | Test |
| :--- | :--- | :--- |
| FR-01 | AC-01.5, AC-02.4 | AT-01, AT-02 |
| FR-03 | AC-01.2, AC-01.4 | AT-01 |
| FR-04 | AC-02.2, AC-02.3, AC-02.4 | AT-02 |
| FR-05 | AC-03.2, AC-03.3, AC-03.4, AC-03.5 | AT-03 |
| FR-06 | AC-04.1, AC-04.5 | AT-04 |
| FR-07 | AC-04.8, AC-04.9 | AT-04 |
| FR-09 | AC-01.7, AC-02.7, AC-03.6 | AT-01, AT-02, AT-03 |
| FR-10 | AC-03.7 (conditional) | AT-03 |
| FR-12 | AC-01.6, AC-02.6, AC-03.5 | AT-01, AT-02, AT-03 |
| FR-13 | AC-04.4, AC-04.6 | AT-04 |
| FR-14 | AC-04.7 | AT-04 |
| FR-15 | AC-01.8, AC-04.1, AC-04.2 | AT-01, AT-04 |
| FR-16 | AC-01.1, AC-02.1, AC-03.1, AC-04.3 | AT-01..AT-04 |
| FR-17 | AC-04.4, AC-04.10 | AT-04 |
| FR-18 | AC-01.1, AC-01.3, AC-02.1, AC-03.1 | AT-01, AT-02, AT-03 |
| FR-19 | AC-02.5, AC-03.7, AC-04.12 (all conditional) | AT-02, AT-03, AT-04 |
| NFR-05 (3) | AC-04.7, AC-04.8 | AT-04 |
| NFR-06 (3), NFR-07 | AC-01.8 | AT-01 |

### 6.2 Acceptance test → supporting verification tests

| Acceptance test | QA Plan test cases | Automated suites (repository paths) |
| :--- | :--- | :--- |
| AT-01 | TC-01, TC-05 | `apps/web/tests/routeStudentQuery.test.ts`, `apps/web/tests/routeStudentQuery.heldout.test.ts`, `apps/web/tests/gatewayClient.test.ts`, `apps/web/tests/auth.test.ts` (guest access), `apps/api-gateway/tests/queryProxy.test.ts` (public tools for guests, `-32602` → 400, metadata preserved), `tests/mcp-server/httpConnectors.test.ts` (tools served by the connector runtime with full metadata, second identical call from cache, invalid parameters → `-32602`), `tests/connectors/mockConnectors.test.ts`, `tests/connectors/cacheStores.test.ts` |
| AT-02 | TC-02, TC-05 | same router, client, query-proxy and MCP suites, `tests/connectors/mockConnectors.test.ts` |
| AT-03 | TC-03, TC-05, TC-06 | same router, client, query-proxy and MCP suites (incl. `STALE` metadata and original timestamp preserved by the gateway), `tests/connectors/resilientExecutor.test.ts`, `tests/connectors/circuitBreaker.test.ts` |
| AT-04 | TC-04, TC-05, TC-07, TC-08 | `apps/api-gateway/tests/jwtAuth.test.ts` (token termination, expired / tampered tokens, spoofed `X-Authenticated-*`), `apps/api-gateway/tests/queryProxy.test.ts` (guest course schedule 401, `studentId` injection 400), `apps/api-gateway/tests/chatStreamProxy.test.ts` (chat 401 / 400, SSE passthrough without `Authorization`, safe post-header `error`), `apps/api-gateway/tests/deploymentConfig.test.ts` (internal network for `mcp-server` and `redis`, AC-04.8), `apps/web/tests/auth.test.ts`, `apps/web/tests/sseParser.test.ts`, `apps/web/tests/chatStreamClient.test.ts`, `tests/mcp-server/dispatcher.test.ts`, `tests/mcp-server/httpConnectors.test.ts` (private tool without verified identity → 401), `tests/connectors/dispatcherIntegration.test.ts`; agent and PII-scrubber tests are planned (M-04, M-06) |
| All | — | `apps/api-gateway/tests/rateLimiter.test.ts` (FR-08: 31st request → 429 with `Retry-After`); not an acceptance criterion of AT-01..AT-04, but it limits how often an acceptance run may repeat requests |

All paths above exist on `dev` (checked at `4f66b28`, 20 Nov 2026).

### 6.3 Acceptance test → implementing components

| Acceptance test | Web client | Gateway | MCP / agent | Connectors |
| :--- | :--- | :--- | :--- | :--- |
| AT-01..AT-03 | `apps/web/src/router/routeStudentQuery.ts`, `apps/web/src/lib/gateway/`, `apps/web/src/components/cards/` — **implemented** | `apps/api-gateway/src/proxy/mcpProxy.ts` — `/api/v1/query` real MCP proxy **implemented (S-01)**; rate limiter with Redis store (S-04) | `apps/mcp-server/src/server.ts`, `ToolDispatcher`, `src/wire/jsonRpc.ts`; tools backed by the connector runtime **implemented (M-02)**, contract-shaped results and JSON-RPC errors **implemented (M-01, M-03)** | `packages/connectors/src/handlers.ts`, mock connectors, resilience; cache currently `InMemoryCacheStore` — Redis-backed cache **planned (A-02)** |
| AT-04 | login and session `apps/web/src/lib/auth/`, `src/components/SessionProvider.tsx`, `src/app/giris/` — **implemented**; SSE chat client `apps/web/src/lib/chat/` — **implemented**; chat UI on `apps/web/src/app/asistan/` **planned (Y-07)** | mock login, JWT verification and token termination implemented; `apps/api-gateway/src/proxy/chatStreamProxy.ts` — `/api/v1/chat/stream` **implemented (S-03)** | `apps/mcp-server/src/agent/AgentOrchestrator.ts` — multi-tool execution **planned (M-04)**; PII scrubber **planned (M-06)**; `/internal/agent/stream` endpoint **planned (M-08)** | course schedule connector and handlers |
| Deployment | `apps/web/Dockerfile` (web image, `/healthz`) — **implemented** | `apps/api-gateway/Dockerfile`, `compose.yaml` (web, gateway, Redis; `mcp-server` service waiting for its Dockerfile, M-13) — **implemented** | — | — |

---

## 7. Scope Limits and Known Gaps

| Item | Status | Effect on acceptance |
| :--- | :--- | :--- |
| FR-18 card D (connector health) | Not implemented in PA3: the API contract has no endpoint for it and no acceptance test needs it (team decision, 19 Nov 2026). `checkConnectorHealth()` exists in `packages/connectors` for later use | Not tested by AT-01..AT-03; listed as a requirement gap in the Test Results Report |
| FR-18 "clicking a card fills the chat input" | Not implemented yet; the dashboard offers example questions instead | Not part of the acceptance criteria; listed as a gap |
| Real campus data | Not available; all connectors in mock mode (§2.2) | Criteria check synthetic data consistency and labelling only |
| Gateway query and chat proxies, login, MCP connector wiring | Implemented and merged into `dev` (S-01, S-03, Y-08, M-02; 20 Nov 2026) | AT-01..AT-03 can now run end to end |
| Redis-backed tool cache | Planned (A-02); the connector runtime uses `InMemoryCacheStore` until then | Cache checks AC-01.7, AC-02.7, AC-03.6 run against the in-memory store; the execution record must state which store was used. FR-09's Redis requirement is reported separately |
| Agent, PII scrubber, agent stream endpoint, chat UI | Planned (M-04, M-06, M-08, Y-07) | AT-04 cannot run end to end before all four exist |
| Settable test clock (`CONNECTOR_FIXED_NOW`) | Proposed (API Contract v1.1 §8 Q3) | AC-02.5 is conditional on it; other time-dependent checks use the recorded execution time if it is missing |
| Fault injection in the demo deployment | Not yet defined | AC-03.7 is conditional; TC-06 remains the supporting evidence |
| NFR-01, NFR-02, NFR-06 (1, 2), FR-13 benchmark | Outside the acceptance decision (§3.5) | Reported separately or as not measured |

---

## 8. Document-Specific Task Matrix

Estimates are planning values for Project Assignment 3. Actual hours are filled in when the task is completed; "—" means not completed or not recorded yet. Only work on this document is counted here; code work is recorded separately to avoid double counting.

*Note on actual hours (v0.1):* Yunus Emre Biçer spent approximately **1.00 h** in total on the four completed drafting tasks (TSK-AT-01, 02, 03, 05) up to 19 November 2026. No per-task timing was kept, so this total is split across the four tasks in proportion to their estimates; the per-task values are therefore approximate.

| Task ID | Task (this document only) | Responsible | Reviewer | Estimated (h) | Actual (h) | Status |
| :--- | :--- | :--- | :--- | ---: | ---: | :--- |
| TSK-AT-01 | Structure, approach, pass/fail rules, data source declaration (§1, §2) | Yunus Emre Biçer | Ahmet Sefa Efendioğlu | 0.30 | ≈ 0.25 | Draft done (v0.1) |
| TSK-AT-02 | Acceptance criteria AC-01.x – AC-04.x (§3) | Yunus Emre Biçer | Arda Çelik (UC-01..03), Murat Can Işık (UC-04 agent), Ahmet Sefa Efendioğlu (UC-04 security) | 0.40 | ≈ 0.33 | Draft done (v0.1) |
| TSK-AT-03 | AT-01..AT-03 steps against the implemented dashboard (§4.1–4.3) | Yunus Emre Biçer | Arda Çelik | 0.30 | ≈ 0.25 | Draft done (v0.1) |
| TSK-AT-04 | AT-04 steps (§4.4); make concrete after login and chat UI exist | Yunus Emre Biçer | Murat Can Işık, Ahmet Sefa Efendioğlu | 0.30 | — | Draft (behaviour level) |
| TSK-AT-05 | Correspondence and traceability (§5, §6), scope limits (§7) | Yunus Emre Biçer | Murat Can Işık | 0.20 | ≈ 0.17 | Draft done (v0.1) |
| TSK-AT-06 | Review of data, cache and stale criteria | Arda Çelik | Yunus Emre Biçer | 0.10 | — | Requested |
| TSK-AT-07 | Review of agent, MCP and streaming criteria | Murat Can Işık | Yunus Emre Biçer | 0.10 | — | Done (no objection, PR #17 review, 20 Nov 2026) |
| TSK-AT-08 | Review of gateway/security criteria and execution conditions | Ahmet Sefa Efendioğlu | Yunus Emre Biçer | 0.10 | — | Done (approved, PR #17 comment, 20 Nov 2026) |
| TSK-AT-09 | Freeze v1.0 (26 Nov 2026) after reviews and UI completion | Yunus Emre Biçer | Entire team | 0.20 | — | Planned |
| | **Total** | | | **2.00** | **≈ 1.00 so far** (4 of 9 tasks) | |

---

## 9. Change Record

| Version | Date | Updated section | Description of changes | Updated by |
| :--- | :--- | :--- | :--- | :--- |
| 0.1 | 19 Nov 2026 | All | First draft: approach, 34 acceptance criteria, AT-01..AT-04, correspondence, traceability, scope limits, task matrix | Yunus Emre Biçer |
| 0.2 | 20 Nov 2026 | List of Contributors, §3.4 AC-04.8, §4.4 AT-04 step 8 and evidence, §6.1, §8, Appendix B | AC-04.8 extended to the MCP server not being reachable around the gateway (no host port binding for `mcp-server`; a direct `/mcp` request with a forged identity header from the host fails to connect), as suggested in Ahmet Sefa Efendioğlu's review; matching AT-04 step 8, evidence and direct request added; NFR-05 linked to AC-04.8; Sefa's review recorded as done. His second note (adding the gateway test suites to §6.2 and updating the S-01/S-03 status in §6.3) will be applied after his gateway branch is merged into `dev` | Yunus Emre Biçer |
| 0.3 | 20 Nov 2026 | Status note, §4.1–4.4 supporting tests, AT-04 step 2, §6.2, §6.3, §7 | Applied the second note of Ahmet Sefa Efendioğlu's review after PR #22 was merged: gateway suites (`queryProxy`, `chatStreamProxy`, `rateLimiter`, `deploymentConfig`) added to §6.2 and the AT tables; S-01 / S-03 marked implemented in §6.3. Also brought the document in line with `dev` at `4f66b28`: login (PR #20), web data cards and chat client implemented; MCP backed by the connector runtime (PR #26, M-01/M-02/M-03) with `tests/mcp-server/httpConnectors.test.ts`; cache still in-memory until A-02; deployment row added. AT-04 step 2 made concrete for the implemented login page. All referenced `dev` paths re-checked | Yunus Emre Biçer |
| 0.4 | 20 Nov 2026 | List of Contributors, §8 | Recorded Murat Can Işık's review of AC-04.3 – AC-04.7, AC-04.10, AC-04.11 (PR #17, 20 Nov 2026): no objection, consistent with API Contract v1.1. His implementation notes need no change to the criteria: the agent will not call the same tool twice in one turn (AC-04.4), and the AC-04.7 / AC-04.11 evidence will be a redacted outbound provider request log under docs/assignment3/evidence/AT-04/ (no JWT, student ID, name, e-mail or API key), as required by §2.4. Review of AC-01.x – AC-03.x by Arda Çelik is still pending | Yunus Emre Biçer |

---

## Appendix A — Execution Record Template

One record per acceptance run, stored in `docs/assignment3/evidence/AT-0x/README.md` and summarised in the Test Results Report:

```text
AT_ID:            AT-0x
USE_CASE:         UC-0x
CONTRACT_VERSION: API Contract v1.1
EXECUTED_AT:      <ISO timestamp with time zone, e.g. 2026-11-26T14:05:00+03:00>
GIT_SHA:          <full commit SHA of the deployed build>
EXECUTOR:         <team member>
ENV:              <OS / Node / Docker Compose version / browser and version>
DATA_MODE:        MOCK
WEB_DATA_SOURCE:  gateway
LLM_PROVIDER:     <real Gemini | not used>            (AT-04 only)
TEST_CLOCK:       <CONNECTOR_FIXED_NOW value | real clock at execution>
STEPS_EXECUTED:   <step numbers; conditional steps marked RUN / NOT RUN with reason>
EXPECTED:         <reference to the criteria of this document>
ACTUAL:           <observed values per step>
STATUS:           PASS | FAIL | NOT RUN | BLOCKED
FAILED_CRITERIA:  <AC IDs, if any>
EVIDENCE:         <paths under docs/assignment3/evidence/AT-0x/>
ISSUE:            <GitHub issue link, if any>
```

## Appendix B — Direct API Requests Used by the Tests

These requests produce inputs that the user interface does not allow. They are sent to the gateway (default `http://localhost:3000`, API Contract v1.1 §7). Tokens are written as placeholders and never committed.

```bash
# AT-01 step 8 — impossible date (expect 400 INVALID_PARAMS)
curl -s -X POST http://localhost:3000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"toolName":"get_cafeteria_menu","parameters":{"date":"2026-99-77"}}'

# AT-02 step 7 — unknown route (expect 400 INVALID_PARAMS)
curl -s -X POST http://localhost:3000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"toolName":"get_shuttle_schedule","parameters":{"route":"NOWHERE"}}'

# AT-04 step 1 — course schedule as a guest (expect 401 AUTHENTICATION_REQUIRED)
curl -s -X POST http://localhost:3000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"toolName":"get_course_schedule","parameters":{}}'

# AT-04 step 8 — direct request to the MCP server around the gateway, with a forged identity
# header, sent from the host (expect: connection fails, because mcp-server publishes no host port)
curl -s --max-time 5 -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" -H "X-Authenticated-Student-Id: demo-student-02" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_course_schedule","arguments":{}}}'

# AT-04 step 9 — chat with an expired or tampered token (expect 401)
curl -s -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Content-Type: application/json" -H "Accept: text/event-stream" \
  -H "Authorization: Bearer <EXPIRED_OR_TAMPERED_TEST_TOKEN>" \
  -d '{"message":"10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?"}'
```
