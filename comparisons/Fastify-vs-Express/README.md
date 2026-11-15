# Technology Comparison: Fastify vs. Express for API Gateway Tier

| Field | Detail |
| :--- | :--- |
| **Author & Evaluator** | **Ahmet Sefa Efendioğlu** (241101066) — `@Sefa-Efendioglu` |
| **Target Tier** | Tier 2: API Gateway & Security Perimeter (`apps/api-gateway`) |
| **Linked Requirements** | FR-07 (Token Termination), FR-08 (Rate Limiting), NFR-01 (P95 Latency < 250 ms) |
| **Decision Outcome** | **Selected: Fastify v4** (Rejected: Express v4) |

---

## 1. Context & Architectural Problem

The **API Gateway** sits directly on the critical path of every client request (both Direct Dashboard lookups and Conversational AI Agent turns). Every request must undergo:
1. Header sanitization (stripping spoofed `X-Authenticated-*` headers).
2. Cryptographic JWT signature and expiry verification.
3. Atomic sliding-window rate limit verification.
4. Request payload validation and serialization before forwarding to the MCP Server.

Because **NFR-01** mandates that cached tool calls complete within a 95th percentile (P95) latency of **under 250 ms** across 20 concurrent users, the HTTP framework overhead at the gateway layer must be minimal.

---

## 2. Side-by-Side Technical Evaluation Matrix

| Evaluation Criterion | Fastify (v4.x) — **Selected** | Express (v4.x) — **Alternative** | Impact on Campus Data Orchestrator |
| :--- | :--- | :--- | :--- |
| **Request Throughput** | `≈ 65,000 – 75,000 req/sec` | `≈ 25,000 – 30,000 req/sec` | Fastify provides `> 2.5×` higher throughput and lower per-request event-loop overhead. |
| **JSON Serialization** | `fast-json-stringify` (2–3x faster than `JSON.stringify`) | Standard `JSON.stringify` | Accelerates serialization of MCP JSON-RPC envelopes and telemetry badges. |
| **Input Schema Validation** | Built-in **Ajv** compiler out of the box | None (Requires external middleware + boilerplate) | Automatically rejects malformed login or query payloads before reaching handler logic. |
| **TypeScript Integration** | First-class generic route typing (`FastifyRequest<{ Body: T }>`) | Loose typings; requires global namespace augmentation (`req as any`) | Eliminates type-casting bugs when attaching `AuthenticatedRequestContext`. |
| **Lifecycle & Hooks** | Structured lifecycle (`onRequest`, `preValidation`, `preHandler`, `onSend`) | Linear, untyped `next()` callback middleware chain | Enables deterministic separation between Token Termination (`preHandler`) and proxying. |
| **Async / Promise Support** | Native `async/await` error catching | Requires `express-async-errors` wrapper in v4 to prevent unhandled rejections | Prevents server crashes if an async Redis rate-limit check rejects. |
| **Testing Utilities** | Built-in `app.inject()` (lightweight, zero-socket HTTP injection) | Requires spinning up ephemeral TCP sockets via `supertest` | Allows gateway security unit tests (`TC-07`) to execute in `< 50 ms` in CI. |

---

## 3. Code Comparison Snippets

### 3.1 Fastify Implementation (`fastify-gateway-sample.ts`)
Fastify natively compiles JSON schemas into high-speed validators and provides strongly typed lifecycle hooks and zero-socket test injection (`app.inject`).

### 3.2 Express Implementation (`express-gateway-sample.ts`)
Express requires manual status/type validation inside handlers (or third-party middleware wrappers), untyped request mutations, and manual `try/catch/next(err)` error forwarding for asynchronous security hooks.

---

## 4. Final Decision Justification

**Fastify** was selected over **Express** for the API Gateway tier because:
1. **Performance Margin (NFR-01):** Low serialization and routing latency preserves the 250 ms P95 budget for downstream Redis and MCP tool lookups.
2. **Security by Default (FR-07):** Native Ajv schema validation strips unknown properties and rejects invalid payloads at the perimeter before execution reaches business handlers.
3. **Zero-Socket Testability (NFR-08):** Fastify's built-in `.inject()` method allows our security test suite (`apps/api-gateway/tests/jwtAuth.test.ts`) to simulate tampered tokens, expired JWTs, and spoofed headers without binding network ports.

