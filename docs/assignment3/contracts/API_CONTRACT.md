# BİL481 / Group-ASYM — Assignment 3 API Contract

**Contract version:** 1.1 (19 November 2026) — see §9 Change Record  
**Status:** **In effect from 19 November 2026** (distributed to the team by Yunus Emre Biçer). Adoption is by *lazy consensus*: if no objection is raised by **20 November 2026, 23:59 (UTC+3)**, v1.1 is frozen. Objections or change requests are raised as a PR or a team message that names the section and the proposed diff. Nobody is recorded as having approved unless they actually did; §8 lists the items that are still proposed defaults.  
**Scope:** `UC-01`..`UC-04` web → Fastify gateway → MCP/agent → connector  
**Repository baseline inspected:** `main` at `0ab3cc356eaa37a95779ba300d895cd8b672c7bb`  
**Authority:** Team implementation contract, **not** a new official instructor requirement. Every member (and every AI assistant a member uses) builds against **this file and this version**; do not invent alternative payload formats. After the freeze, changes need an explicit PR, a version increase and a notification to the other three members.

> **Critical status:** The HTTP gateway response shapes and SSE streaming below are **TARGET CONTRACTS**, not current production behavior. In the inspected repo `/api/v1/query` returned a perimeter-validation/mock response; the agent remained `NOT_IMPLEMENTED`, and the web workspace provided router logic, not a full Next.js UI. Do not tell AI that these endpoints already work as specified. Implement and verify them.

## 1. Non-negotiable design decisions

| Decision | Contract | Owner |
|---|---|---|
| External transport | Browser sends requests to the **Fastify API gateway**; it never calls the MCP server directly | Sefa / Yunus |
| Public direct queries | `POST /api/v1/query` with `{toolName, parameters}`; no LLM inference | Sefa / Murat |
| Compound agent queries | `POST /api/v1/chat/stream` with `text/event-stream` SSE response; browser parses `fetch()` response stream | Sefa / Murat / Yunus |
| Authentication | Public tools may be guest; `get_course_schedule` requires valid mock-SSO JWT. JWT validated **only** at gateway; downstream gets trusted context (no raw token) | Sefa |
| Tool identity | `get_course_schedule` input **must not** contain `studentId`; student comes from gateway-verified identity only | Sefa / Murat / Arda |
| MCP wire protocol | Internal `POST /mcp`, JSON-RPC 2.0 `tools/call`; do not rewrite MCP tool definitions | Murat |
| Data response | Gateway returns normalized JSON with domain `data` plus `meta`; preserve connector metadata | Sefa / Arda |
| Source metadata | `meta.source` is `LIVE\|CACHE_HIT\|STALE\|ERROR` (execution source); **not** `MOCK`. Simulation is **separate** `meta.isSimulated: boolean` | Arda / Sefa |
| Cache TTL (sec) | cafeteria 3600, shuttle 120, library 60, course schedule 300 | Arda |
| Error semantics | HTTP statuses + stable error JSON; failures are not synthetic successes | Sefa |
| Streaming | SSE events `token`, `tool`, `done`, `error` with exact JSON below. The lack of SSE is a failed/unimplemented FR-17, not an alternate PASS | Murat / Yunus / Sefa |
| Contract maintenance | `docs/assignment3/contracts/API_CONTRACT.md` is single source of truth; all response fixtures and tests must match it | Murat steward and committer (proposed default, §8), all review |
| Chat access | `/api/v1/chat/stream` always requires a verified student JWT, for **every** compound query (not only those that need the personal schedule). The UI asks a guest to log in before sending a chat message; dashboard cards stay public. The agent can therefore assume an authenticated context on every call | Yunus / Sefa / Murat |
| Browser origin | The browser calls `/api/v1/*` on the **web app's own origin**; the Next.js server rewrites these paths to the gateway (`GATEWAY_URL`, §7). No CORS is needed in the gateway. Proposed default, Sefa confirms (§8) | Yunus / Sefa |
| Browser token storage | JWT kept in `sessionStorage` (cleared when the tab closes), sent only in `Authorization: Bearer`; never in URLs, cookies set by the web app, logs or localStorage | Yunus |

### Path and deployment topology

```text
Browser / Next.js (Yunus)
    | HTTP, /api/v1/*, JWT in Authorization only when logged in
    v
Fastify gateway (Sefa) — verify JWT, rate-limit, delete untrusted X-Authenticated-* headers
    | only internal container network; no raw JWT
    +-- POST /mcp JSON-RPC (Murat) --> connector runtime (Arda) --> Redis/mock data
    +-- agent interface (Murat) --> validated MCP tool calls --> Gemini adapter

Browser never sends client-chosen X-Authenticated-Student-Id or studentId tool argument.
MCP/agent runtime internal ports must not be exposed to browser as unauthenticated public endpoints.
```

## 2. Fixed domain inputs and outputs

Use the repo's existing TypeScript interfaces in `packages/shared/src/types/tools.ts` and `domain.ts`. Do **not** fork independent definitions in each app.

| Tool name | Exact `parameters` type | `data` contract | Public? |
|---|---|---|---|
| `get_cafeteria_menu` | `{ "date"?: "YYYY-MM-DD" }` | `CafeteriaDailyMenu {date, lunch, dinner, available, unavailableReason?}` | Yes |
| `get_shuttle_schedule` | `{ "route"?: "MAIN_RING" \| "METRO_LINE" \| "DORMITORY_LINE" }` | `ShuttleRouteData {routeId, routeName, nextDepartures, activeVehicles, lastUpdated}` | Yes |
| `get_library_occupancy` | `{ "floor"?: "FLOOR_1" \| "FLOOR_2" \| "FLOOR_3" \| "ALL" }` | `LibraryOccupancyReport {timestamp, isSimulated, totalCapacity, totalOccupied, floors[]}` | Yes |
| `get_course_schedule` | `{ "day"?: "TODAY" \| "MONDAY" \| ... \| "SUNDAY" }`; validate against Requirements/schema | `StudentClassEntry[]` | **No; authenticated student only** |

Do not infer `get_course_schedule` accepts a `studentId` argument, or place one in the LLM function signature. `date`, `route`, `floor`, `day` defaulting remains in the connector/registered schema layer; UI can send `{}` for defaults. Preserve real (non-mock) sources only if authorized; always mark synthetic data.

## 3. Browser → gateway REST contract

The REST shapes here are **the selected integration design for PA3**. MCP protocol / shared domain types stay unchanged.

### 3.1 `POST /api/v1/auth/mock-login` — existing route, keep compatible

Request:

```json
{"studentId":"demo-student-01","name":"Demo Student","email":"demo@example.test","role":"STUDENT"}
```

Success `200` preserves existing shape:

```json
{"token":"<JWT_FROM_MOCK_SSO>","user":{"studentId":"demo-student-01","name":"Demo Student","email":"demo@example.test","role":"STUDENT"},"expiresIn":3600}
```

This is **development/demo authentication**, not real TOBB ETÜ SSO. Use synthetic identities, never commit real signed tokens. `GET /api/v1/auth/me` continues to report verified session state. Public direct queries (`get_cafeteria_menu`, `get_shuttle_schedule`, `get_library_occupancy`) do not need login; `get_course_schedule` and the chat endpoint (all compound UC-04 queries, see §1 "Chat access") do.

### 3.2 `POST /api/v1/query` — direct path (`UC-01`/`02`/`03`, optionally private course)

Headers: `Content-Type: application/json`; `Authorization: Bearer <JWT>` only if a protected tool is requested.

Request (exact top-level fields, no extra identity field):

```json
{"toolName":"get_cafeteria_menu","parameters":{"date":"2026-11-23"}}
```

**Successful response, HTTP 200:**

```json
{
  "ok": true,
  "toolName": "get_cafeteria_menu",
  "data": {
    "date": "2026-11-23",
    "available": true,
    "lunch": {"soup":"Example soup","mainDish":"Example dish","vegOption":"Example vegetarian dish","sideDish":"Example side","calories":600},
    "dinner": {"soup":"Example soup","mainDish":"Example dish","sideDish":"Example side","calories":550}
  },
  "meta": {
    "isSimulated": true,
    "isStale": false,
    "source": "LIVE",
    "timestamp": "2026-11-23T12:00:00.000Z",
    "durationMs": 12
  }
}
```

The sample is **illustrative**, not an observed campus menu or executed result. `source: "LIVE"` means a *fresh connector execution* (could be synthetic), **not** real university data. `isSimulated: true` labels synthetic data. `data` is the **domain object** from the connector, not the MCP `content[]` envelope. For a stale fallback: HTTP 200, `meta.source:"STALE"`, `meta.isStale:true`, original cached timestamp; UI must show a stale warning. Empty/error result must not be silently translated into `{ok:true,data:{}}`.

Gateway adapter extraction rule: inspect JSON-RPC tool result; if its MCP `content` contains a JSON block, use that block's `data` (and `isSimulated`, `isStale`, `source`, `timestamp`, `durationMs`); otherwise return a structured error. Do not drop stale/simulation metadata. This is an **external REST adaptation**, not a change to the registered MCP tool.

### 3.3 `POST /api/v1/chat/stream` — compound path (`UC-04`)

Header `Content-Type: application/json`, `Accept: text/event-stream`, valid `Authorization: Bearer <JWT>`. Request:

```json
{"message":"10:30 dersimden sonra ringe yetişir miyim, bugün yemekte ne var?"}
```

Success HTTP `200`, `Content-Type: text/event-stream; charset=utf-8` and `Cache-Control: no-cache`. The body is a sequence of SSE frames, e.g.:

```text
event: tool
data: {"toolName":"get_course_schedule","status":"LIVE","durationMs":25}

event: tool
data: {"toolName":"get_shuttle_schedule","status":"CACHE_HIT","durationMs":4}

event: tool
data: {"toolName":"get_cafeteria_menu","status":"LIVE","durationMs":15}

event: token
data: {"text":"Dersinden sonra "}

event: token
data: {"text":"uygun bir ring var."}

event: done
data: {"answer":"Dersinden sonra uygun bir ring var.","toolsInvoked":["get_course_schedule","get_shuttle_schedule","get_cafeteria_menu"],"isComplete":true}

```

**Streaming decisions:**
- `tool`: one event **per actual tool invocation**; status `LIVE\|CACHE_HIT\|STALE\|ERROR` and measured `durationMs`. UI uses these to render exactly one badge per invocation. Avoid speculative badges for tools that were only planned.
- `token`: one arbitrary answer text chunk; browser must concatenate in arrival order, not assume each event is a complete word.
- `done`: **exactly once** when synthesis finishes; contains full `answer`, ordered `toolsInvoked`, `isComplete`. `done` is authoritative; UI may reconcile streamed chunks with the final answer.
- `error`: `{ "code":"AGENT_ERROR", "message":"Safe user-readable message" }`; no tokens/PII/stack traces. If failure happens after SSE headers, emit `error` rather than pretending an HTTP 5xx after headers. A request rejected before streaming starts uses normal JSON error and HTTP 401/429/400.
- Keep stream alive only as needed; UI shows processing after 5s and times out at 20s in accordance with Design Document UC-04. SSE reconnect/abort rules must not duplicate tool invocations silently. Reconnection may start a new request **only after explicit retry** if idempotency is not implemented; auto-resuming an already-running tool chain without server replay support is prohibited.
- The real provider adapter must use actual Gemini responses when claiming an LLM-integrated demo. A fake provider can be used for unit/integration tests but **must not be represented as the real UC-04 acceptance test passing**.

### 3.4 Stable JSON error body for the gateway

```json
{"ok":false,"error":{"code":"INVALID_PARAMS","message":"Invalid route value"},"timestamp":"2026-11-23T12:00:00.000Z"}
```

| Condition | HTTP | `error.code` | Notes |
|---|---:|---|---|
| Invalid JSON/body/tool arguments | 400 | `INVALID_PARAMS` | Internal JSON-RPC `-32602` maps to 400; keep details safe |
| Absent/invalid/expired JWT on protected endpoint | 401 | `AUTHENTICATION_REQUIRED` | `/api/v1/query` for private course; UC-04 protected |
| Excessive requests | 429 | `RATE_LIMITED` | Add `Retry-After` header where applicable |
| Recognized tool upstream unavailable, no stale cache | 503 | `UPSTREAM_UNAVAILABLE` | Include no fake data |
| MCP/agent service unreachable | 502 | `DOWNSTREAM_ERROR` | Never expose internal network details |
| Upstream timeout | 504 | `UPSTREAM_TIMEOUT` | Align with 20s overall UI cancellation logic |
| Unexpected internal failure | 500 | `INTERNAL_ERROR` | Safe message; detailed trace only in redacted server log |

MCP JSON-RPC errors remain JSON-RPC 2.0 internally; only the browser-facing gateway uses these HTTP mappings. Invalid `studentId` in tool arguments must be rejected with 400 even when JWT is valid. For `get_course_schedule`, authentication must be required before dispatch (and arguments still validated).

## 4. Gateway → MCP internal wire contract

`POST http://mcp-server:<port>/mcp` **internal only** (actual port from Compose env), with standard JSON-RPC:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_shuttle_schedule","arguments":{"route":"MAIN_RING"}}}
```

Headers injected by **gateway after JWT verification only**: `X-Authenticated-Student-Id` for private schedule, `X-Authenticated-User-Role` for role. No raw Authorization header or student identity originating from untrusted browser headers. Gateway must remove all client-supplied `X-Authenticated-*` headers before constructing internal request. Internal MCP listener must not trust these headers from arbitrary external callers; restrict it by network/binding or mutually authenticated service identity. Direct public access to `/mcp` with a forged `X-Authenticated-Student-Id` is a security bypass if it reaches the MCP server — block it in deployment and test it.

MCP wire success stays as the actual repo implementation documents it:

```json
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"json","data":{"routeId":"MAIN_RING","routeName":"Campus Ring","nextDepartures":[],"activeVehicles":0,"lastUpdated":"2026-11-23T12:00:00.000Z"}}],"isError":false,"isStale":false,"timestamp":"2026-11-23T12:00:00.000Z"}}
```

Example values are illustrative; distinguish actual connector transport behavior from intended output and test it before accepting this contract. Sefa is responsible for REST adaptation; Murat for MCP dispatcher/result serialization; Arda for `content[]` data/metadata; Yunus for UI consumption. Avoid implementing redundant proxy branches in each module.

## 5. Contract fixtures, contract tests, no-wait implementation

**Fixtures to commit with this contract** (owned by Sefa for HTTP and Arda for data; reviewed by Murat/Yunus):

```text
docs/assignment3/contracts/API_CONTRACT.md

tests/contracts/fixtures/query-cafeteria-success.json
tests/contracts/fixtures/query-shuttle-success.json
tests/contracts/fixtures/query-library-success.json
tests/contracts/fixtures/query-stale-success.json
tests/contracts/fixtures/query-invalid-params.json
tests/contracts/fixtures/query-unauthorized.json
tests/contracts/fixtures/agent-stream-success.sse
tests/contracts/fixtures/agent-stream-error.sse
```

These paths are deliverables **to create**; they do not currently exist in the inspected repository. Responses must validate against shared domain types and the gateway adapter tests. Use **synthetic** values and deterministic clocks where appropriate.

| Member | Can implement right now without waiting | First integration dependency | Contract proof |
|---|---|---|---|
| Yunus | Next.js views, router, `gatewayClient` against fixtures, chat SSE parser, UI unit tests | Sefa's live REST route; Murat's real stream | Browser UI renders 3 direct cards + 1 streamed chat from fixtures and later from live backend |
| Murat | Handler wiring, Gemini provider adapter w/ fake provider tests, `AgentOrchestrator` + PII sanitizer | Arda handler runtime; Sefa gateway trusted headers | MCP tool calls return real connector envelopes; UC-04 calls 3 tools and streams |
| Arda | Connector runtime, real Redis adapter, fixed seed fixtures, resilience fault tests | Sefa Redis host/port in Compose | JSON body + meta semantics match 4 tool contracts; stale fallback reproducible |
| Sefa | Gateway `/api/v1/query` real proxy, stable error adapter, auth/rate tests, `/api/v1/chat/stream` proxy stub, Compose skeleton | Murat internal MCP and agent; Yunus app port | Gateway contract tests against fake downstream; later true E2E |

**First contract review** (team adoption, lazy consensus — see header): each member has their AI assistant read this file and either raises a specific diff (PR, issue or team message) by 20 November 23:59 or builds against it as is. Do not silently diverge. **The actual `main` repository remains unchanged by this file generation; someone must commit the contract and fixtures on a branch.**

## 6. Required conformance checks before AT-01..04

- [ ] API contract file committed and the version frozen (no open objection after 20 Nov 23:59; explicit ACKs recorded only where actually given).
- [ ] Gateway contract tests cover 200/400/401/429/502/503/504 paths, as relevant.
- [ ] Browser-facing `source` and `isSimulated` are not conflated.
- [ ] No raw token in internal transport, logs, LLM prompt, or committed evidence.
- [ ] Client-forged student ID cannot access personal timetable, including when MCP URL is guessed or reached directly.
- [ ] Public tools work as GUEST and course schedule requires verified identity.
- [ ] Backend reports accurate `isStale` and original timestamp; UI displays them.
- [ ] UC-04 agent executes **actual three** tools, emits tool telemetry and final synthesis; tests distinguish fake provider from actual provider.
- [ ] The four acceptance test results reference the exact contract version and tested commit SHA.

## 7. Runtime configuration defaults (proposed, owners confirm)

Values below come from the repository's `.env.example` where it already defines them. They are **proposed defaults** until the owner confirms (§8); Docker Compose (Sefa) is the final source once it exists.

| Variable | Used by | Proposed default (local) | In Compose | Owner | Note |
|---|---|---|---|---|---|
| `GATEWAY_PORT` | gateway | `3000` | `3000` (only port published to the host besides web) | Sefa | **Mismatch found:** `.env.example` defines `GATEWAY_PORT=3000`, but `apps/api-gateway/src/index.ts` reads `PORT` with fallback `4000`. Gateway should read `GATEWAY_PORT` (or the example should change) |
| `MCP_SERVER_PORT` | mcp-server | `3001` | `3001`, internal network only, **not published** | Murat | Already read by `apps/mcp-server/src/index.ts` |
| `WEB_PORT` | web | `3002` | `3002`, published | Yunus | |
| `GATEWAY_URL` | web (server-side rewrite target) | `http://localhost:3000` | `http://api-gateway:3000` | Yunus | New. Not exposed to the browser (no `NEXT_PUBLIC_` prefix) |
| `MCP_URL` | gateway | `http://localhost:3001/mcp` | `http://mcp-server:3001/mcp` | Sefa | New. Internal JSON-RPC endpoint (§4) |
| `AGENT_STREAM_URL` | gateway | `http://localhost:3001/internal/agent/stream` | `http://mcp-server:3001/internal/agent/stream` | Murat | New; path is a proposal (§8 Q4) |
| `REDIS_URL` | connectors (and rate limiter if Redis-backed) | `redis://localhost:6379` | `redis://redis:6379`, internal only | Arda / Sefa | Already in `.env.example` |
| `JWT_SECRET`, `MOCK_SSO_ISSUER` | gateway | from `.env` (never committed) | from `.env` | Sefa | `jwtVerifier.ts` currently falls back to a hard-coded secret when `JWT_SECRET` is unset; acceptable for tests, should not be the demo configuration |
| `GEMINI_API_KEY` | agent | from `.env` (never committed) | from `.env` | Murat (§8 Q2) | |
| `CONNECTOR_FIXED_NOW` | connectors | unset (= real Turkey time) | set only for acceptance runs, e.g. `2026-11-23T09:00:00+03:00` | Arda (§8 Q3) | New; makes AT-01..04 reproducible regardless of the time of day |
| `*_CONNECTOR_MODE`, `CACHE_TTL_*`, `UPSTREAM_TIMEOUT_MS`, `CONNECTOR_MOCK_SEED` | connectors | as in `.env.example` | same | Arda | Already defined |

## 8. Open items with proposed defaults

Each item has a default that applies **unless the named owner objects by 20 November 2026, 23:59**. Silence keeps the default; it is not recorded as an explicit approval.

| # | Question | Proposed default | Owner who confirms |
|---|---|---|---|
| Q1 | Who commits this contract and the `tests/contracts/fixtures/*` files? | Murat commits `API_CONTRACT.md` (steward); Arda supplies the domain/meta fixture data; Sefa supplies the HTTP error fixtures. Until then the web app keeps a local copy of the fixtures under `apps/web` | Murat |
| Q2 | Who provides the Gemini API key for the live UC-04 run? | Murat (owner of M-05) uses his own free-tier key via `.env` only; shared privately, never committed or pasted in logs | Murat |
| Q3 | How do acceptance runs pin "now" (Turkey time) so AT-01..04 are reproducible? | Connectors honour `CONNECTOR_FIXED_NOW` (§7); unit tests keep their injected fake clock | Arda |
| Q4 | Internal gateway → agent endpoint (not defined in §4 v1.0) | `POST {AGENT_STREAM_URL}` with body `{"message": "..."}`, trusted headers as in §4, response = the same SSE frames as §3.3, which the gateway passes through unchanged | Murat (with Sefa) |
| Q5 | Browser → gateway origin | Next.js rewrites `/api/v1/*` to `GATEWAY_URL` (no CORS in the gateway) | Sefa |
| Q6 | Gateway port variable | Gateway reads `GATEWAY_PORT` (default `3000`), matching `.env.example` | Sefa |

## 9. Change Record

| Version | Date | Updated section | Description of changes | Updated by |
|---|---|---|---|---|
| 1.0 | 19 Nov 2026 | All | Initial contract | Yunus Emre Biçer |
| 1.1 | 19 Nov 2026 | Header, §1, §3.1, §7, §8, §9 | Lazy-consensus adoption rule; chat always requires login; browser origin via Next.js rewrite; token storage; runtime configuration table (incl. gateway port mismatch); open items with defaults (committer, Gemini key, fixed clock, gateway→agent endpoint) | Yunus Emre Biçer |
