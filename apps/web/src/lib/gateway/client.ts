/**
 * Typed client for the browser-facing gateway API (API Contract v1.1 §3).
 *
 * The same client is used with the real gateway and with the fixture
 * transport: only the `transport` function changes, so response parsing and
 * error handling are exercised on real HTTP-shaped responses in both modes.
 */
import type {
  DataSource,
  GatewayErrorBody,
  GatewayErrorCode,
  QueryRequestBody,
  QueryResult,
  ResponseMeta,
  ToolData,
  ToolName,
  ToolParams,
} from './types';

/** Anything with the `fetch` signature: the browser fetch or the fixture transport. */
export type Transport = (input: string, init: RequestInit) => Promise<Response>;

export interface GatewayClientOptions {
  transport: Transport;
  /** Prefix for API paths. Empty = same origin; Next.js rewrites /api/v1/* to the gateway. */
  baseUrl?: string;
  /** Client-side limit for one direct query. */
  timeoutMs?: number;
}

export interface QueryOptions {
  /** Mock-SSO JWT; sent only when given (required for get_course_schedule). */
  token?: string | null;
  /** Lets a card cancel a request that is no longer needed (e.g. route changed). */
  signal?: AbortSignal;
}

export interface GatewayClient {
  query<T extends ToolName>(toolName: T, parameters: ToolParams<T>, options?: QueryOptions): Promise<QueryResult<T>>;
}

export const QUERY_PATH = '/api/v1/query';
export const DEFAULT_QUERY_TIMEOUT_MS = 10_000;

const GATEWAY_ERROR_CODES: readonly GatewayErrorCode[] = [
  'INVALID_PARAMS',
  'AUTHENTICATION_REQUIRED',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'DOWNSTREAM_ERROR',
  'UPSTREAM_TIMEOUT',
  'INTERNAL_ERROR',
];

const DATA_SOURCES: readonly DataSource[] = ['LIVE', 'CACHE_HIT', 'STALE', 'ERROR'];

/**
 * Identity must come only from the gateway-verified JWT (contract §1 "Tool
 * identity"). The client refuses to send identity-like parameters even if a
 * caller passes them by mistake.
 */
const FORBIDDEN_PARAMETER_KEYS = ['studentId', 'student_id', 'userId'] as const;

export function createGatewayClient({
  transport,
  baseUrl = '',
  timeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
}: GatewayClientOptions): GatewayClient {
  async function query<T extends ToolName>(
    toolName: T,
    parameters: ToolParams<T>,
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const forbidden = FORBIDDEN_PARAMETER_KEYS.find((key) => Object.hasOwn(parameters as object, key));
    if (forbidden !== undefined) {
      throw new Error(`Refusing to send "${forbidden}" as a tool parameter; identity comes from the JWT only.`);
    }

    const body: QueryRequestBody<T> = { toolName, parameters };
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    let response: Response;
    try {
      response = await transport(`${baseUrl}${QUERY_PATH}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (timedOut) {
        return clientError('CLIENT_TIMEOUT', 'Sunucu zamanında cevap vermedi.');
      }
      if (options.signal?.aborted) {
        return clientError('ABORTED', 'İstek iptal edildi.');
      }
      return clientError('NETWORK_ERROR', 'Sunucuya ulaşılamadı. Bağlantını kontrol et.');
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      // A non-JSON 5xx usually means the web server could not reach the gateway at all
      // (the Next.js rewrite target is down), which the user experiences as "no connection".
      if (response.status >= 500) {
        return clientError('NETWORK_ERROR', 'Sunucuya ulaşılamadı. Bağlantını kontrol et.', response.status);
      }
      return clientError('INVALID_RESPONSE', 'Sunucudan okunamayan bir cevap geldi.', response.status);
    }

    if (response.ok) {
      return parseSuccess(toolName, json, response.status);
    }
    return parseError(json, response);
  }

  return { query };
}

function parseSuccess<T extends ToolName>(toolName: T, json: unknown, status: number): QueryResult<T> {
  if (!isRecord(json) || json.ok !== true || json.toolName !== toolName || !isRecord(json.meta)) {
    return clientError('INVALID_RESPONSE', 'Sunucu cevabı beklenen biçimde değil.', status);
  }
  const meta = parseMeta(json.meta);
  // A success must carry real domain data; an empty object is not a valid answer (contract §3.2).
  const data = json.data;
  if (meta === null || data === null || typeof data !== 'object' || isEmptyPlainObject(data)) {
    return clientError('INVALID_RESPONSE', 'Sunucu cevabı beklenen biçimde değil.', status);
  }
  return { ok: true, toolName, data: data as ToolData<T>, meta };
}

function parseMeta(value: Record<string, unknown>): ResponseMeta | null {
  const { isSimulated, isStale, source, timestamp, durationMs } = value;
  if (
    typeof isSimulated !== 'boolean' ||
    typeof isStale !== 'boolean' ||
    typeof timestamp !== 'string' ||
    !DATA_SOURCES.includes(source as DataSource)
  ) {
    return null;
  }
  const meta: ResponseMeta = { isSimulated, isStale, source: source as DataSource, timestamp };
  if (typeof durationMs === 'number') {
    meta.durationMs = durationMs;
  }
  return meta;
}

function parseError<T extends ToolName>(json: unknown, response: Response): QueryResult<T> {
  const body = json as Partial<GatewayErrorBody> | null;
  const code = body?.error?.code;
  const message = body?.error?.message;
  if (body?.ok !== false || !GATEWAY_ERROR_CODES.includes(code as GatewayErrorCode) || typeof message !== 'string') {
    return clientError('INVALID_RESPONSE', 'Sunucudan beklenmeyen bir hata cevabı geldi.', response.status);
  }

  const result: QueryResult<T> = { ok: false, code: code as GatewayErrorCode, message, status: response.status };
  const retryAfter = Number(response.headers.get('Retry-After'));
  if (response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
    result.retryAfterSeconds = retryAfter;
  }
  return result;
}

function clientError<T extends ToolName>(
  code: 'NETWORK_ERROR' | 'CLIENT_TIMEOUT' | 'INVALID_RESPONSE' | 'ABORTED',
  message: string,
  status?: number
): QueryResult<T> {
  return status === undefined ? { ok: false, code, message } : { ok: false, code, message, status };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyPlainObject(value: object): boolean {
  return !Array.isArray(value) && Object.keys(value).length === 0;
}
