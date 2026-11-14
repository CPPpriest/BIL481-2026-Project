import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { AuthContext } from '@campus-orchestrator/shared';
import { TOOL_DEFINITIONS } from './registry/toolDefinitions.js';
import {
  ToolDispatcher,
  AuthenticationRequiredError,
} from './dispatcher/ToolDispatcher.js';

/**
 * Creates and configures the core Model Context Protocol (MCP) server instance.
 *
 * Implements:
 * - FR-01: MCP Protocol Compliance and Strict Schema Validation (tools/list & tools/call)
 * - FR-02: Transport Layer Support hook (Streamable HTTP / stdio)
 *
 * @param dispatcher ToolDispatcher instance managing validation and handlers
 * @param serverInfo Name and version metadata for MCP handshake
 */
export function createCampusMcpServer(
  dispatcher: ToolDispatcher = new ToolDispatcher(),
  serverInfo = { name: 'campus-data-orchestrator', version: '1.0.0' }
) {
  const server = new Server(serverInfo, {
    capabilities: {
      tools: {},
    },
  });

  // FR-01: tools/list discovery endpoint
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFINITIONS.map((def) => ({
        name: def.name,
        description: def.description,
        inputSchema: def.inputSchema,
      })),
    };
  });

  // FR-01, FR-02: tools/call invocation endpoint
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    // Retrieve verified auth context if available from transport headers; default to GUEST
    const authContext: AuthContext = (extra as { authContext?: AuthContext })?.authContext ?? {
      role: 'GUEST',
    };

    try {
      const result = await dispatcher.dispatch(name, args, authContext);

      if (result.isError && result.code === -32602) {
        throw new McpError(ErrorCode.InvalidParams, result.message ?? 'Invalid params');
      }

      return {
        content: Array.isArray(result.content)
          ? (result.content as any)
          : [{ type: 'json', data: result.content }],
        isError: result.isError,
      };
    } catch (err: unknown) {
      if (err instanceof AuthenticationRequiredError) {
        throw new McpError(ErrorCode.InvalidRequest, err.message);
      }
      if (err instanceof McpError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new McpError(ErrorCode.InternalError, message);
    }
  });

  return { server, dispatcher };
}
