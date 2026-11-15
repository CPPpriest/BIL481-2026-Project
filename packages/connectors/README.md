# @campus-orchestrator/connectors

Connector, cache and resilience tier of the **Campus Data Orchestrator** (Group-ASYM, BIL 481).
Owner: **Arda Çelik** (`@ardacelik11`), Connector & Data Lead. Requirements: FR-03 – FR-06 and FR-09 – FR-12.

The package provides the data behind the four MCP tools:

| MCP tool | Connector | Cache TTL | Data source today |
| :--- | :--- | :--- | :--- |
| `get_cafeteria_menu` | `MockCafeteriaConnector` | 3600 s | Deterministic synthetic menu |
| `get_shuttle_schedule` | `MockShuttleConnector` | 120 s | Deterministic synthetic timetable |
| `get_library_occupancy` | `MockLibraryConnector` | 60 s | Simulated occupancy (`isSimulated: true`) |
| `get_course_schedule` | `MockCourseScheduleConnector` | 300 s (per student) | Deterministic synthetic SIS timetable |

> **Honest status:** No real campus API is accessible (Project Definition §4.3). All four connectors run in **mock mode**. Setting a connector to `live` selects a placeholder that reports "not available" and is handled gracefully. It does **not** fetch real data.

## Implementation Status

| Part | Status |
| :--- | :--- |
| Connector contract: shared `ICampusConnector` + `ManagedCampusConnector` (`name`, `mode`, `healthCheck`) | Implemented |
| 4 deterministic mock connectors (seeded PRNG, Türkiye time) | Implemented, tested |
| Mode switching per connector via env vars (FR-12) | Implemented, tested |
| Live connectors | **Blocked**: upstream access not confirmed; placeholder only |
| `CacheStore` + `InMemoryCacheStore` | Implemented, tested |
| `RedisCacheStore` adapter | Implemented; tested with a fake client only. **Not yet run against a live Redis** |
| Redis client bootstrap + Docker service | Planned (Phase 3) |
| TTL cache, stale-if-error, 800 ms timeout, circuit breaker (`ResilientConnectorExecutor`) | Implemented, tested |
| MCP handlers (`registerConnectorHandlers`) | Implemented; tested with the real `ToolDispatcher`. Swapping them into `apps/mcp-server` is Murat's integration step |
| Telemetry to PostgreSQL (FR-20) | Not part of this package (planned) |

## Usage (integration in the MCP server)

```ts
import { createConnectorRuntime, registerConnectorHandlers } from '@campus-orchestrator/connectors';

const runtime = createConnectorRuntime();          // reads process.env
registerConnectorHandlers(dispatcher, runtime);     // replaces the temporary sample handlers
```

To use Redis once it is wired:

```ts
createConnectorRuntime({ cache: new RedisCacheStore(redisClient) });
```

## Environment Variables

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| `CAFETERIA_CONNECTOR_MODE`, `SHUTTLE_CONNECTOR_MODE`, `LIBRARY_CONNECTOR_MODE`, `SCHEDULE_CONNECTOR_MODE` | `mock` | `mock` or `live` (any other value fails at startup) |
| `CACHE_TTL_CAFETERIA`, `CACHE_TTL_SHUTTLE`, `CACHE_TTL_LIBRARY`, `CACHE_TTL_COURSE_SCHEDULE` | 3600 / 120 / 60 / 300 | TTL in seconds (FR-09) |
| `UPSTREAM_TIMEOUT_MS` | `800` | Upstream cutoff (NFR-01, FR-10) |
| `CONNECTOR_MOCK_SEED` | `481-FALL-2026` | Seed for all synthetic data (new; not yet in `.env.example`) |

## Tests

Tests live in `tests/connectors/` (picked up by the root `vitest.config.mts`) and run fully offline.

```bash
npm test                          # whole repository
npx vitest run tests/connectors   # connector tier only
npx tsc -p packages/connectors --noEmit   # type check (build packages/shared first)
```

Details of the design (algorithms, interfaces, design decisions): `docs/_sections/arda-data-decisions.md`.
