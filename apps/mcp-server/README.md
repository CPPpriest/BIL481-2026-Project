# MCP Server (`@campus-orchestrator/mcp-server`)

Internal service that exposes the four campus tools over MCP / JSON-RPC and, later, the UC-04 agent
stream. Tools are backed by `@campus-orchestrator/connectors` (TTL cache, stale-if-error, circuit
breaker, mock/live modes). Wire format and error codes: `docs/assignment3/contracts/API_CONTRACT.md` §3.2, §4.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Heartbeat; reports tool count and connector runtime (modes, cache type) |
| `POST` | `/mcp` | JSON-RPC 2.0 `tools/list` and `tools/call` (used by the API gateway) |
| `GET` | `/mcp`, `/sse` | MCP SSE transport (MCP Inspector) |
| `POST` | `/mcp/messages` | SSE message channel |

## Security

`/mcp` trusts the `X-Authenticated-Student-Id` / `X-Authenticated-User-Role` headers, which only the
API gateway may set after JWT verification. **Never publish this port to the host or the internet.**
In Compose it is `expose`d on the internal network only. There are no CORS headers by design.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `MCP_SERVER_PORT` (or `PORT`) | `3001` | Listen port |
| `REDIS_URL` | unset | Reserved. The Redis client is not wired yet, so the cache is in-memory and the startup log says so (Arda A-02) |
| `CAFETERIA_CONNECTOR_MODE`, `SHUTTLE_CONNECTOR_MODE`, `LIBRARY_CONNECTOR_MODE`, `SCHEDULE_CONNECTOR_MODE` | `mock` | `mock` or `live`; `live` has no confirmed upstream and returns `UPSTREAM_UNAVAILABLE` |
| `UPSTREAM_TIMEOUT_MS` | `800` | Upstream cutoff (NFR-01) |
| `CACHE_TTL_CAFETERIA` / `_SHUTTLE` / `_LIBRARY` / `_COURSE_SCHEDULE` | `3600` / `120` / `60` / `300` | TTL in seconds (FR-09) |
| `CONNECTOR_MOCK_SEED` | `481-FALL-2026` | Seed of the deterministic mock data |
| `GEMINI_API_KEY` | unset | Used by the agent (M-05, not part of this image yet). Provide via `.env` only, never commit |

Mock results are labelled `isSimulated: true`.

## Run

```bash
# local
npm run build && npm run start -w @campus-orchestrator/mcp-server
curl http://127.0.0.1:3001/health

# Docker (build from the repository root)
docker build -f apps/mcp-server/Dockerfile -t campus-mcp-server .
docker run --rm -p 127.0.0.1:3001:3001 campus-mcp-server

# Compose (web, api-gateway, mcp-server, redis)
docker compose up --build
```
