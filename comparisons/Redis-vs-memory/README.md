# Technology Comparison: Redis vs. Process In-Memory `Map` for the Tool Cache

| Field | Detail |
| :--- | :--- |
| **Author & Evaluator** | **Arda Çelik** (241101065) — `@ardacelik11` |
| **Target Tier** | Tier 5: Connector Integration & Cache (`packages/connectors`) |
| **Linked Requirements** | FR-09 (TTL cache), FR-10 (stale-if-error), FR-11 (circuit breaker), NFR-02 (≥ 90 % hit ratio), NFR-03 (fault isolation), NFR-04 (stateless instances), NFR-08 (offline tests) |
| **Decision Outcome** | **Selected: Redis 7 (single instance)** as the production cache. **Kept: in-memory `Map`** behind the same `CacheStore` interface for unit tests and offline development only. |

---

## 1. Context

Every MCP tool result is cached with a tool-specific TTL (cafeteria 3600 s, shuttle 120 s, library 60 s, course schedule 300 s, FR-09). Expired values must stay available for 3 × TTL so they can be returned with `isStale: true` when a campus service fails (FR-10). NFR-04 requires the MCP server to be stateless so that two instances can run behind the gateway, and NFR-02 requires a cache hit ratio of at least 90 % under dashboard load.

The question: where do cached tool results live?

| Option | Description |
| :--- | :--- |
| **A — Process `Map`** | Each MCP server process keeps its own `Map<string, entry>` in memory. |
| **B — Redis** | All MCP server instances read and write one shared Redis instance with key expiry (`PX`). |

## 2. Evaluation Matrix

| Criterion | A — In-memory `Map` | B — Redis (**selected**) | Why it matters here |
| :--- | :--- | :--- | :--- |
| **Shared across instances** | No. Each instance has its own cache; instance 2 misses what instance 1 cached. | Yes. One cache for all instances. | NFR-04 (two instances) and NFR-02 (hit ratio) |
| **Survives restart / redeploy** | No. Cache and stale fallback data are lost. | Yes (data lives outside the Node.js process). | FR-10 fallback must work right after a redeploy |
| **TTL / expiry** | Must be implemented by hand (lazy cleanup). | Native per-key expiry (`SET … PX`). | FR-09 retention of 3 × TTL without custom cleanup |
| **Memory bound** | Grows inside the Node.js heap until keys are read again. | Separate process with its own memory limit and eviction policy. | Protects the MCP server process |
| **Per-lookup cost** | In-process function call, no network. | One local network round trip. | NFR-01 budget (P95 < 250 ms for cached calls) |
| **Infrastructure** | None. | One more container in Docker Compose. | NFR-09 single-command startup |
| **Reuse in the system** | None. | Gateway already needs Redis for atomic rate-limit counters (FR-08). | No additional technology |
| **Testability / offline** | Excellent. | Needs a running server, or a fake client in unit tests. | NFR-08 offline tests |

**Per-lookup latency was not measured by the team** (no Redis server is running yet). The latency row above is qualitative. A real comparison is planned in the Phase 4 load test (NFR-01: autocannon/k6, 20 concurrent users for 5 minutes).

## 3. Code in This Folder

| File | What it shows |
| :--- | :--- |
| [`in-memory-map-cache.ts`](./in-memory-map-cache.ts) | Option A: a minimal Map cache with fresh/stale/retention logic and its built-in limitations (per-process, lost on restart, lazy expiry). |
| [`redis-cache.ts`](./redis-cache.ts) | Option B: the same contract on Redis with `PX` expiry, plus the planned `createClient` bootstrap for Phase 3. |
| [`../../tests/connectors/redisVsMemory.demo.test.ts`](../../tests/connectors/redisVsMemory.demo.test.ts) | Executable demonstration of both options with the real connector code (see §4). |

Production versions of both options are in `packages/connectors/src/cache/` (`InMemoryCacheStore.ts`, `RedisCacheStore.ts`). Both implement the same `CacheStore` interface, so the choice is a one-line change in `createConnectorRuntime({ cache })`.

## 4. Demonstration Result (functional, executed)

`npx vitest run tests/connectors/redisVsMemory.demo.test.ts` runs the same scenario against both options. Two MCP server instances answer the same cafeteria query. Later the cafeteria upstream fails and instance 1 restarts.

| Step | A — `Map` per instance | B — shared store (Redis semantics) |
| :--- | :--- | :--- |
| Instance 1 query | `LIVE` (upstream call 1) | `LIVE` (upstream call 1) |
| Instance 2 same query | `LIVE` (upstream call 2: cache not shared) | `CACHE_HIT` (no upstream call) |
| Upstream calls in total | **2** | **1** |
| Upstream down + instance 1 restarted | `ERROR` (fallback data lost) | `STALE`, `isStale: true` (fallback survived) |

Both test cases passed on 15 Nov 2026. Option B uses a shared in-memory fake of the Redis client, because no Redis server is available in the test environment. The demonstration therefore shows **sharing and persistence semantics, not Redis performance**.

## 5. Decision

**Redis is selected** for the production cache, for these reasons:

1. **Stateless scaling (NFR-04) and hit ratio (NFR-02):** a per-process cache multiplies upstream calls by the number of instances and makes the 90 % hit-ratio target depend on how many instances run.
2. **Stale-if-error that survives restarts (FR-10):** fallback data must exist exactly when something has just gone wrong, including right after a redeploy.
3. **Native expiry (FR-09):** `PX = 3 × TTL` gives the required retention without custom cleanup code.
4. **No new technology:** Redis is already required for the gateway's rate-limit counters (FR-08).

The **in-memory `Map` is kept**, behind the same `CacheStore` interface, for unit tests and offline development (NFR-08). It is the runtime default only until the Redis client is wired in Phase 3.

**Trade-offs accepted:**
- Redis adds one container and one network hop.
- A Redis outage must not break tool calls. This is handled in `ResilientConnectorExecutor`: a cache read error counts as a miss, and a write error is skipped.

## 6. Status

| Item | Status |
| :--- | :--- |
| `CacheStore` interface, `InMemoryCacheStore`, `RedisCacheStore` adapter | **Implemented**, unit-tested (fake Redis client) |
| Demonstration test (§4) | **Implemented**, passing |
| `redis` npm dependency, Redis container, connection bootstrap | **Planned** (Phase 3) |
| Latency comparison against a live Redis | **Not measured** (planned with the Phase 4 load test) |
