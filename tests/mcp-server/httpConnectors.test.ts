/**
 * M-10: the MCP server over real HTTP, backed by the connector runtime (M-01/M-02/M-03).
 * Uses mock connectors only; results prove wire format and error semantics, not AT-01..04.
 */

import type http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { TOOL_NAMES } from '@campus-orchestrator/shared';
import { createConnectorRuntime } from '../../packages/connectors/src/index.js';
import { startHttpServer, ToolDispatcher } from '../../apps/mcp-server/src/index.js';
import { forwardToolQuery } from '../../apps/api-gateway/src/proxy/mcpProxy.js';
import { MONDAY, TestClock } from '../connectors/helpers.js';

const STUDENT_ID = '241101065';
const servers: http.Server[] = [];

async function boot(env: Record<string, string> = {}) {
  const clock = new TestClock(`${MONDAY}T12:35`);
  const connectorRuntime = createConnectorRuntime({ env, clock: clock.now });
  const server = await startHttpServer(0, '127.0.0.1', new ToolDispatcher(), { connectorRuntime });
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, url: `${base}/mcp`, clock };
}

async function rpc(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, json: (await res.json()) as any };
}

const call = (name: unknown, args?: unknown) => ({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name, ...(args === undefined ? {} : { arguments: args }) },
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => s.close(resolve))));
});

describe('MCP HTTP server backed by connectors (M-02)', () => {
  it('lists the four tools and reports the connector runtime on /health', async () => {
    const { base, url } = await boot();
    const list = await rpc(url, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(list.json.result.tools.map((t: any) => t.name).sort()).toEqual(Object.values(TOOL_NAMES).sort());

    const health = await (await fetch(`${base}/health`)).json();
    expect(health.runtime).toMatchObject({ source: 'connectors', cache: 'in-memory' });
    expect(health.runtime.connectorModes.library).toBe('mock');
  });

  it('serves all four tools with the full metadata set in the json block (M-01, contract §3.2)', async () => {
    const { url } = await boot();
    const calls: Array<[string, unknown, Record<string, string>]> = [
      [TOOL_NAMES.CAFETERIA_MENU, { date: MONDAY }, {}],
      [TOOL_NAMES.SHUTTLE_SCHEDULE, { route: 'MAIN_RING' }, {}],
      [TOOL_NAMES.LIBRARY_OCCUPANCY, { floor: 'ALL' }, {}],
      [TOOL_NAMES.COURSE_SCHEDULE, { day: 'TUESDAY' }, { 'X-Authenticated-Student-Id': STUDENT_ID }],
    ];
    for (const [name, args, headers] of calls) {
      const { status, json } = await rpc(url, call(name, args), headers);
      expect(status).toBe(200);
      expect(json.error).toBeUndefined();
      expect(json.result.isError).toBe(false);
      const block = json.result.content[0];
      expect(block.type).toBe('json');
      expect(block.data).toBeTruthy();
      expect(block).toMatchObject({ isSimulated: true, isStale: false, source: 'LIVE' });
      expect(typeof block.timestamp).toBe('string');
      expect(typeof block.durationMs).toBe('number');
      expect(json.result).toMatchObject({ isSimulated: true, isStale: false, source: 'LIVE' });
    }
  });

  it('serves the second identical call from the cache', async () => {
    const { url } = await boot();
    const first = await rpc(url, call(TOOL_NAMES.LIBRARY_OCCUPANCY, { floor: 'ALL' }));
    const second = await rpc(url, call(TOOL_NAMES.LIBRARY_OCCUPANCY, { floor: 'ALL' }));
    expect(first.json.result.source).toBe('LIVE');
    expect(second.json.result.source).toBe('CACHE_HIT');
    expect(second.json.result.content[0].data).toEqual(first.json.result.content[0].data);
  });
});

describe('MCP HTTP error semantics (M-03)', () => {
  it('invalid parameters → JSON-RPC error -32602', async () => {
    const { url } = await boot();
    const badRoute = await rpc(url, call(TOOL_NAMES.SHUTTLE_SCHEDULE, { route: 'NIGHT' }));
    expect(badRoute.status).toBe(200);
    expect(badRoute.json.error.code).toBe(-32602);
    expect(badRoute.json.result).toBeUndefined();

    const spoof = await rpc(
      url,
      call(TOOL_NAMES.COURSE_SCHEDULE, { day: 'TUESDAY', studentId: '241101013' }),
      { 'X-Authenticated-Student-Id': STUDENT_ID }
    );
    expect(spoof.json.error.code).toBe(-32602);
  });

  it('missing tool name or non-object arguments → -32602', async () => {
    const { url } = await boot();
    expect((await rpc(url, call(undefined))).json.error.code).toBe(-32602);
    expect((await rpc(url, call(TOOL_NAMES.SHUTTLE_SCHEDULE, [1, 2]))).json.error.code).toBe(-32602);
  });

  it('unknown tool and unknown method → -32601', async () => {
    const { url } = await boot();
    expect((await rpc(url, call('does_not_exist'))).json.error.code).toBe(-32601);
    expect((await rpc(url, { jsonrpc: '2.0', id: 9, method: 'resources/list' })).json.error.code).toBe(-32601);
  });

  it('private tool without a verified identity → HTTP 401 with -32001', async () => {
    const { url } = await boot();
    const { status, json } = await rpc(url, call(TOOL_NAMES.COURSE_SCHEDULE, { day: 'TUESDAY' }));
    expect(status).toBe(401);
    expect(json.error.code).toBe(-32001);
  });

  it('malformed JSON → HTTP 400 with -32700; non-object body → -32600', async () => {
    const { url } = await boot();
    const broken = await rpc(url, '{oops');
    expect(broken.status).toBe(400);
    expect(broken.json.error.code).toBe(-32700);
    const array = await rpc(url, '[]');
    expect(array.status).toBe(400);
    expect(array.json.error.code).toBe(-32600);
  });

  it('upstream failure is a tool error (result.isError + code), not a JSON-RPC error', async () => {
    const { url } = await boot({ LIBRARY_CONNECTOR_MODE: 'live' });
    const { status, json } = await rpc(url, call(TOOL_NAMES.LIBRARY_OCCUPANCY, {}));
    expect(status).toBe(200);
    expect(json.error).toBeUndefined();
    expect(json.result).toMatchObject({ isError: true, code: 'UPSTREAM_UNAVAILABLE', source: 'ERROR' });
    expect(json.result.content[0].type).toBe('text');
  });

  it('sends no CORS headers and rejects OPTIONS (internal service)', async () => {
    const { url } = await boot();
    const post = await rpc(url, call(TOOL_NAMES.LIBRARY_OCCUPANCY, {}));
    expect(post.headers.get('access-control-allow-origin')).toBeNull();
    const options = await fetch(url, { method: 'OPTIONS' });
    expect(options.status).toBe(404);
    expect(options.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('Gateway adapter against the real MCP server (contract §3.2 / §3.4)', () => {
  const guest = { studentId: null, role: 'GUEST', isAuthenticated: false, verifiedAt: new Date().toISOString() } as const;
  const student = { studentId: STUDENT_ID, role: 'STUDENT', isAuthenticated: true, verifiedAt: new Date().toISOString() } as const;

  it('turns a connector result into the REST success body with meta', async () => {
    const { url } = await boot();
    const result = await forwardToolQuery({
      toolName: TOOL_NAMES.SHUTTLE_SCHEDULE,
      parameters: { route: 'MAIN_RING' },
      authContext: guest,
      mcpUrl: url,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.meta).toMatchObject({ isSimulated: true, isStale: false, source: 'LIVE' });
      expect(result.body.meta.durationMs).toBeTypeOf('number');
      expect(result.body.data).toMatchObject({ routeId: 'MAIN_RING' });
    }
  });

  it('forwards the verified identity for the private course schedule', async () => {
    const { url } = await boot();
    const result = await forwardToolQuery({
      toolName: TOOL_NAMES.COURSE_SCHEDULE,
      parameters: { day: 'TUESDAY' },
      authContext: student,
      mcpUrl: url,
    });
    expect(result.ok).toBe(true);
  });

  it('maps upstream failure to 503 UPSTREAM_UNAVAILABLE', async () => {
    const { url } = await boot({ LIBRARY_CONNECTOR_MODE: 'live' });
    const result = await forwardToolQuery({
      toolName: TOOL_NAMES.LIBRARY_OCCUPANCY,
      parameters: {},
      authContext: guest,
      mcpUrl: url,
    });
    expect(result).toMatchObject({ ok: false, statusCode: 503, code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps an invalid parameter rejected by MCP to 400 INVALID_PARAMS', async () => {
    const { url } = await boot();
    const result = await forwardToolQuery({
      toolName: TOOL_NAMES.SHUTTLE_SCHEDULE,
      parameters: { route: 'NIGHT' },
      authContext: guest,
      mcpUrl: url,
    });
    expect(result).toMatchObject({ ok: false, statusCode: 400, code: 'INVALID_PARAMS' });
  });
});
