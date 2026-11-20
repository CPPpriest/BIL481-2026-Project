import type { DispatcherResult } from '../dispatcher/ToolDispatcher.js';

/**
 * Wire serialization shared by the direct HTTP `/mcp` endpoint and the SDK `tools/call` handler
 * (API Contract v1.1 §3.2 / §4).
 *
 * Two kinds of failure are kept apart:
 * - Protocol errors (unknown tool -32601, invalid params -32602) are JSON-RPC `error` objects.
 * - Tool execution failures (upstream unavailable/timeout, circuit open, internal) are normal
 *   `result` objects with `isError: true`, a `code` and a text content block, as in MCP.
 *
 * Successful results carry the domain object plus its metadata (isSimulated, isStale, source,
 * timestamp, durationMs) inside the `json` content block, so the gateway never loses stale or
 * simulation labels.
 */

/** Codes that describe a malformed request and therefore travel as JSON-RPC errors. */
const PROTOCOL_ERROR_CODES: ReadonlySet<unknown> = new Set([-32601, -32602]);

type ContentBlock = { type: string; [key: string]: unknown };

/** DispatcherResult plus the optional envelope fields connector handlers add at runtime. */
export type WireDispatcherResult = DispatcherResult & {
  isSimulated?: boolean;
  source?: string;
  durationMs?: number;
};

export interface JsonRpcErrorObject {
  code: number | string;
  message: string;
  data?: unknown;
}

export type ToolCallOutcome =
  | { kind: 'protocol-error'; error: JsonRpcErrorObject }
  | { kind: 'result'; result: Record<string, unknown> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function metaOf(result: WireDispatcherResult) {
  return {
    isStale: result.isStale ?? false,
    isSimulated: result.isSimulated,
    source: result.source,
    timestamp: result.timestamp,
    durationMs: result.durationMs,
  };
}

/** Fills metadata the handler left off a `json` block from the envelope's top-level fields. */
function withMeta(block: ContentBlock, meta: ReturnType<typeof metaOf>): ContentBlock {
  if (block.type !== 'json') {
    return block;
  }
  return {
    ...block,
    isStale: block.isStale ?? meta.isStale,
    isSimulated: block.isSimulated ?? meta.isSimulated,
    source: block.source ?? meta.source,
    timestamp: block.timestamp ?? meta.timestamp,
    durationMs: block.durationMs ?? meta.durationMs,
  };
}

export function buildToolCallOutcome(result: WireDispatcherResult): ToolCallOutcome {
  const code = result.code ?? result.error?.code ?? -32603;
  const message = result.message ?? result.error?.message ?? 'Tool execution error';

  if (result.isError) {
    if (PROTOCOL_ERROR_CODES.has(code)) {
      return {
        kind: 'protocol-error',
        error: { code, message, data: result.error?.data },
      };
    }
    return {
      kind: 'result',
      result: {
        isError: true,
        code,
        message,
        source: 'ERROR',
        content:
          Array.isArray(result.content) && result.content.length > 0
            ? result.content
            : [{ type: 'text', text: message }],
        timestamp: result.timestamp,
        durationMs: result.durationMs,
      },
    };
  }

  const meta = metaOf(result);
  const rawContent = Array.isArray(result.content)
    ? (result.content as ContentBlock[])
    : [{ type: 'json', data: result.content } as ContentBlock];
  return {
    kind: 'result',
    result: {
      content: rawContent.map((block) => (isRecord(block) ? withMeta(block, meta) : block)),
      isError: false,
      ...meta,
    },
  };
}

export function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

export function jsonRpcError(id: unknown, error: JsonRpcErrorObject) {
  return { jsonrpc: '2.0', id: id ?? null, error };
}
