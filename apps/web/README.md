# Web client (`@campus-orchestrator/web`)

Next.js 16 (App Router, React 19) client for the Campus Data Orchestrator: the *Kampüs Özeti* dashboard (UC-01..UC-03) and the assistant view (UC-04). Owner: Yunus Emre Biçer.

The browser talks only to this app's own origin. `/api/v1/*` is rewritten on the server to the Fastify gateway (API Contract v1.1 §1, §7), so the gateway needs no CORS and its address is not exposed to the client.

## Run locally

```bash
npm install                                  # repository root
npm run build                                # root: builds packages/shared first (the web app imports its output)
npm run dev -w @campus-orchestrator/web      # http://localhost:3002
```

Other scripts: `npm run build -w @campus-orchestrator/web` (standalone production build), `npm run start -w @campus-orchestrator/web`, `npm run typecheck -w @campus-orchestrator/web`. Tests run from the root with `npx vitest run apps/web`.

## Configuration

| Variable | Default | When it is read | Purpose |
| :--- | :--- | :--- | :--- |
| `GATEWAY_URL` | `http://localhost:3000` | **Build time** (Next.js bakes rewrites into the build) | Target of the `/api/v1/*` rewrite. In Compose: `http://api-gateway:3000` |
| `NEXT_PUBLIC_WEB_DATA_SOURCE` | `gateway` | **Build time** (inlined into browser code) | `gateway` = real requests; `fixtures` = local example data with a visible "Örnek veri modu" banner. Fixture runs never count as acceptance evidence |
| `PORT` | `3002` | Run time | Port of the Next.js server |
| `HOSTNAME` | `0.0.0.0` in Docker | Run time | Listen address inside the container |

For local overrides copy `.env.example` to `.env.local` (git-ignored).

## Docker

The image is built from the **repository root** because it needs the root lockfile and `packages/shared`:

```bash
docker build -f apps/web/Dockerfile -t campus-web --build-arg GATEWAY_URL=http://api-gateway:3000 .
docker run --rm -p 3002:3002 campus-web
```

- Multi-stage build on `node:24-alpine`: installs only the `shared` and `web` workspaces, builds the Next.js standalone server, and runs it as a non-root user.
- `GATEWAY_URL` and `NEXT_PUBLIC_WEB_DATA_SOURCE` are **build arguments**: changing them needs a rebuild.
- Healthcheck: `GET /healthz` → `{"status":"ok","service":"web"}`. It does not call the gateway, so a gateway outage does not mark the web container unhealthy.
- Build context filter: `apps/web/Dockerfile.dockerignore` (no root `.dockerignore` needed). `.env` files are never copied into the image.

### Suggested Compose service (for the shared compose file, owner: Ahmet Sefa Efendioğlu)

```yaml
web:
  build:
    context: .
    dockerfile: apps/web/Dockerfile
    args:
      GATEWAY_URL: http://api-gateway:3000        # must match the gateway service name and port
      NEXT_PUBLIC_WEB_DATA_SOURCE: gateway
  ports:
    - "3002:3002"                                 # the only web port published to the host
  depends_on:
    - api-gateway
  restart: unless-stopped
```

Only the web app and the gateway need to be reachable from the host; the MCP server and Redis stay on the internal network (API Contract v1.1 §1, §7).

### Verification status

`docker build` has **not** been run on the author's machine (no Docker available there). What was verified without Docker, on 20 Nov 2026:

- the `deps` and `build` stages reproduced step by step in a clean folder with the same file filters: `npm ci` for the two workspaces only (60 packages, no gateway/MCP dependencies), shared and web builds pass, `GATEWAY_URL=http://api-gateway:3000` ends up in the rewrite manifest;
- the `runner` stage reproduced by starting `apps/web/server.js` from the standalone output plus `.next/static`: `/healthz` returns ok, `/` and `/asistan` return 200 with their CSS, and a `POST /api/v1/query` is forwarded with its body to a stand-in gateway, without an `Authorization` header.

The first real `docker build` / `docker compose up` should be recorded in the Deployment Plan.
