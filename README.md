# Campus Data Orchestrator — BIL 481 Term Project (Fall 2026)

## Group Name

**Group-ASYM**

## Group Members

| Full Name | GitHub Username | Email | School Number | Primary Technical Role |
| :--- | :--- | :--- | :--- | :--- |
| Murat Can Işık | [`@cmuratt`](https://github.com/cmuratt) | muratcanisik@etu.edu.tr | 241101013 | MCP Server, Tool Dispatcher & AI Agent Lead |
| Yunus Emre Biçer | [`@YunusEmre113`](https://github.com/YunusEmre113) | y.bicer@etu.edu.tr | 241101009 | Web Client, Bilingual Intent Router & Use Cases |
| Ahmet Sefa Efendioğlu | [`@Sefa-Efendioglu`](https://github.com/Sefa-Efendioglu) | a.efendioglu@etu.edu.tr | 241101066 | API Gateway, Perimeter Security, QA & Release Lead |
| Arda Çelik | [`@ardacelik11`](https://github.com/ardacelik11) | arda.celik@etu.edu.tr | 241101065 | Campus Connectors, Caching, Resilience & Design Decisions |

---

## Project Overview

**Campus Data Orchestrator** is a Model Context Protocol (MCP) based campus information orchestrator built over JSON-RPC 2.0. It unifies four university data domains — cafeteria menus (`get_cafeteria_menu`), shuttle ring schedules (`get_shuttle_schedule`), library floor occupancy (`get_library_occupancy`), and authenticated student course schedules (`get_course_schedule`) — behind two decoupled consumption paths:

- **Direct Fast-Path (`DIRECT_WIDGET`):** Single-domain queries bypass LLM inference and resolve directly from cached MCP tool endpoints.
- **Agentic Orchestration Path (`LLM_AGENT`):** Compound or multi-service queries invoke the AI Agent tier to plan multi-tool sequences while isolating raw JWT tokens and scrubbing student PII at the perimeter.

---

## Deliverables Index

### Assignment 2 (Design & Quality Assurance)
- **[Design Document](docs/Design_Document.md):** System overview, architecture, codebase structure, key implementations, component interfaces, wireframes (`docs/wireframes/`), 4 use cases (`UC-01`–`UC-04`), technology comparisons (`comparisons/`), and task matrix.
- **[Quality Assurance (QA) Plan](docs/QA_Plan.md):** Testing strategy, 4 measurable quality factors, detailed test cases (`TC-01`–`TC-08`), bug tracking workflow, and release gate checklist.

### Assignment 1 (Baseline Documentation)
- [Project Definition Document](docs/Project_Definition_Document.md)
- [Requirements Document](docs/Requirements_Document.md)
- [Project Plan Document](docs/Project_Plan_Document.md)

---

## Implementation Status (Phase 2 Implemented vs. Phase 3 Planned)

| Component / Workspace | Phase 2 Status | Notes |
| :--- | :--- | :--- |
| **`packages/shared`** | **Implemented** | Shared domain models, tool input/output contracts, TTL constants, `ICampusConnector` interface |
| **`apps/mcp-server`** | **Implemented (Core)** | MCP SDK server (`stdio`, legacy HTTP+SSE, `POST /mcp`), Zod validation, `ToolDispatcher`, auth guard, `IAgentOrchestrator` skeleton |
| **`packages/connectors`** | **Implemented (Mock & In-Memory)** | Deterministic seeded mock connectors for all 4 services, `InMemoryCacheStore`, 3-state `CircuitBreaker`, `ResilientConnectorExecutor` |
| **`apps/api-gateway`** | **Implemented (Skeleton)** | Fastify gateway, mock-SSO JWT verification, token termination & header injection, `InMemoryRateLimiterStore` |
| **`apps/web`** | **Implemented (Intent Router)** | Bilingual TR/EN deterministic `routeStudentQuery` router; Next.js 14 dashboard & chat views designed via SVG wireframes (`docs/wireframes/`) |
| **Gemini LLM & PII Scrubber** | **Planned (Phase 3)** | Live Google Gemini function calling and regex PII scrubber (`FR-13`, `FR-14`) |
| **Redis, PostgreSQL & Docker** | **Planned (Phase 3)** | Live Redis 7.2 cache/rate-limit stores, PostgreSQL/Prisma telemetry (`FR-20`), full `docker compose up` orchestration (`NFR-09`), live Streamable HTTP transport |

---

## Build & Test Instructions

All Phase 2 TypeScript workspaces and offline unit/integration test suites run without external network access:

```bash
npm install
npm run build
npm test
```
