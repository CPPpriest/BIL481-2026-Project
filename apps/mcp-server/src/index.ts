import http from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { AuthContext } from '@campus-orchestrator/shared';
import { ToolDispatcher, AuthenticationRequiredError } from './dispatcher/ToolDispatcher.js';
import { createCampusMcpServer } from './server.js';
import { TOOL_DEFINITIONS } from './registry/toolDefinitions.js';
import {
  buildToolCallOutcome,
  jsonRpcError,
  jsonRpcResult,
} from './wire/jsonRpc.js';
import type { ConnectorRuntime } from '@campus-orchestrator/connectors';

export interface McpServerStartOptions {
  /** Injected connector runtime (tests); defaults to one built from process.env. */
  connectorRuntime?: ConnectorRuntime;
}

/** Describes the connector tier for logs and /health. Redis is not wired yet (Arda A-02). */
function describeRuntime(runtime: ConnectorRuntime | undefined) {
  if (!runtime) {
    return { source: 'sample-mocks (deprecated)' };
  }
  return {
    source: 'connectors',
    cache: 'in-memory',
    redisUrlConfigured: Boolean(process.env.REDIS_URL),
    connectorModes: runtime.config.modes,
  };
}

// Re-export all submodules for external and library consumers
export * from './registry/toolDefinitions.js';
export * from './dispatcher/ToolDispatcher.js';
export * from './agent/AgentOrchestrator.js';
export * from './server.js';
export * from './wire/jsonRpc.js';
export * from './mocks/sampleMockHandlers.js';

/**
 * Starts the MCP Server using Stdio transport (FR-02).
 * Designed for local command-line MCP clients, desktop assistants, or MCP Inspector via CLI.
 */
export async function startStdioServer(
  dispatcher: ToolDispatcher = new ToolDispatcher(),
  options: McpServerStartOptions = {}
): Promise<void> {
  const { server, connectorRuntime } = createCampusMcpServer(dispatcher, {
    connectorRuntime: options.connectorRuntime,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Diagnostic logs must be written to stderr; stdout is reserved for JSON-RPC messages
  console.error('[MCP Server] Stdio transport successfully connected and running.');
  console.error('[MCP Server] Runtime:', JSON.stringify(describeRuntime(connectorRuntime)));
}

/**
 * Starts the MCP Server using Streamable HTTP (SSE) and direct JSON-RPC endpoint (FR-02).
 *
 * Implements:
 * - GET  /health: Service heartbeat and tool registry check
 * - GET  /mcp (or /sse): Streamable HTTP connection over Server-Sent Events (SSE)
 * - POST /mcp/messages: SSE message transport handler
 * - POST /mcp: Direct JSON-RPC 2.0 tool discovery and invocation endpoint
 */
export async function startHttpServer(
  port: number = Number(process.env.MCP_SERVER_PORT || process.env.PORT || 3001),
  host = '0.0.0.0',
  dispatcher: ToolDispatcher = new ToolDispatcher(),
  options: McpServerStartOptions = {}
): Promise<http.Server> {
  const { server, connectorRuntime } = createCampusMcpServer(dispatcher, {
    connectorRuntime: options.connectorRuntime,
  });
  const runtimeInfo = describeRuntime(connectorRuntime);

  // Track active SSE transport sessions by sessionId
  const sseSessions = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    // Internal service: no CORS headers. Browsers reach it only through the Next.js rewrite and
    // the API gateway (API Contract v1.1 Q5); OPTIONS therefore falls through to 404.
    const hostHeader = req.headers.host || `localhost:${port}`;
    const parsedUrl = new URL(req.url || '/', `http://${hostHeader}`);
    const pathname = parsedUrl.pathname;

    // 2. Health check endpoint
    if (pathname === '/health' && req.method === 'GET') {
      const payload = {
        status: 'ok',
        service: 'campus-mcp-server',
        version: '1.0.0',
        transports: ['stdio', 'streamable-http (SSE)'],
        tools: TOOL_DEFINITIONS.length,
        runtime: runtimeInfo,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload, null, 2));
      return;
    }

    // 3. Streamable HTTP (SSE) transport endpoints (FR-02)
    if ((pathname === '/mcp' || pathname === '/sse') && req.method === 'GET') {
      const sessionId = Math.random().toString(36).substring(2, 12);
      const transport = new SSEServerTransport(`/mcp/messages?sessionId=${sessionId}`, res);
      sseSessions.set(sessionId, transport);

      transport.onclose = () => {
        sseSessions.delete(sessionId);
      };

      try {
        await server.connect(transport);
      } catch (err) {
        console.error('[MCP Server] Error connecting SSE transport:', err);
        sseSessions.delete(sessionId);
      }
      return;
    }

    // Handle SSE message posts
    if (pathname === '/mcp/messages' && req.method === 'POST') {
      const sessionId = parsedUrl.searchParams.get('sessionId');
      if (!sessionId || !sseSessions.has(sessionId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SSE session not found or expired' }));
        return;
      }

      const transport = sseSessions.get(sessionId)!;
      await transport.handlePostMessage(req, res);
      return;
    }

    // 4. Direct JSON-RPC HTTP POST to /mcp (Direct API Gateway / Web proxy flow)
    if (pathname === '/mcp' && req.method === 'POST') {
      // Extract authentication context from perimeter gateway headers
      const studentIdHeader = req.headers['x-authenticated-student-id'];
      const studentId = typeof studentIdHeader === 'string' ? studentIdHeader : undefined;
      const roleHeader = req.headers['x-authenticated-user-role'];
      const role =
        roleHeader === 'STUDENT' || roleHeader === 'FACULTY' || roleHeader === 'GUEST'
          ? roleHeader
          : studentId
            ? 'STUDENT'
            : 'GUEST';

      const authContext: AuthContext = { studentId, role };

      let rawBody = '';
      req.on('data', (chunk) => {
        rawBody += chunk;
      });

      const sendJson = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      req.on('end', async () => {
        let jsonRpc: unknown;
        try {
          jsonRpc = JSON.parse(rawBody || '{}');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          sendJson(400, jsonRpcError(null, { code: -32700, message: `Parse error: ${msg}` }));
          return;
        }

        if (typeof jsonRpc !== 'object' || jsonRpc === null || Array.isArray(jsonRpc)) {
          sendJson(400, jsonRpcError(null, { code: -32600, message: 'Invalid Request' }));
          return;
        }

        const { id, method, params } = jsonRpc as {
          id?: unknown;
          method?: unknown;
          params?: Record<string, unknown>;
        };

        try {
          if (method === 'tools/list') {
            sendJson(
              200,
              jsonRpcResult(id, {
                tools: TOOL_DEFINITIONS.map((def) => ({
                  name: def.name,
                  description: def.description,
                  inputSchema: def.inputSchema,
                })),
              })
            );
            return;
          }

          if (method === 'tools/call') {
            const toolName = params?.name;
            const toolArgs = params?.arguments;

            if (typeof toolName !== 'string' || toolName.length === 0) {
              sendJson(
                200,
                jsonRpcError(id, { code: -32602, message: 'Invalid params: params.name must be a non-empty string' })
              );
              return;
            }
            if (
              toolArgs !== undefined &&
              (typeof toolArgs !== 'object' || toolArgs === null || Array.isArray(toolArgs))
            ) {
              sendJson(
                200,
                jsonRpcError(id, { code: -32602, message: 'Invalid params: params.arguments must be an object' })
              );
              return;
            }

            const outcome = buildToolCallOutcome(
              await dispatcher.dispatch(toolName, toolArgs, authContext)
            );
            sendJson(
              200,
              outcome.kind === 'protocol-error'
                ? jsonRpcError(id, outcome.error)
                : jsonRpcResult(id, outcome.result)
            );
            return;
          }

          // Unrecognized JSON-RPC method
          sendJson(200, jsonRpcError(id, { code: -32601, message: `Method not found: ${String(method)}` }));
        } catch (err: unknown) {
          if (err instanceof AuthenticationRequiredError) {
            sendJson(401, jsonRpcError(id, { code: -32001, message: err.message }));
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[MCP Server] Unhandled error while serving /mcp:', err);
          sendJson(500, jsonRpcError(id, { code: -32603, message: `Internal error: ${msg}` }));
        }
      });
      return;
    }

    // 5. Default 404 for unmapped routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Not Found',
        message: `Endpoint ${pathname} is not supported. Use /health or /mcp.`,
      })
    );
  });

  return new Promise((resolve, reject) => {
    httpServer.listen(port, host, () => {
      console.log(`[MCP Server] Running on Streamable HTTP http://${host}:${port}/mcp`);
      console.log(`[MCP Server] Health check available at http://${host}:${port}/health`);
      console.log('[MCP Server] Runtime:', JSON.stringify(runtimeInfo));
      if (runtimeInfo.redisUrlConfigured) {
        console.log(
          '[MCP Server] REDIS_URL is set but the Redis client is not wired yet; using in-memory cache (BLOCKED: Arda A-02).'
        );
      }
      resolve(httpServer);
    });

    httpServer.on('error', (err) => {
      console.error('[MCP Server] HTTP server startup error:', err);
      reject(err);
    });
  });
}

/**
 * CLI Entrypoint
 */
async function main() {
  const isStdioMode =
    process.argv.includes('--stdio') || process.env.MCP_TRANSPORT === 'stdio';

  if (isStdioMode) {
    await startStdioServer();
  } else {
    await startHttpServer();
  }
}

// Automatically invoke main when executed directly
if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'))) {
  main().catch((err) => {
    console.error('[MCP Server] Fatal initialization error:', err);
    process.exit(1);
  });
}
