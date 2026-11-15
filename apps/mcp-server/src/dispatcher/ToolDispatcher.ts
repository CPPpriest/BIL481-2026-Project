import {
  TOOL_NAMES,
  type AuthContext,
} from '@campus-orchestrator/shared';
import {
  TOOL_DEFINITIONS,
  validateToolArguments,
} from '../registry/toolDefinitions.js';

/**
 * Custom error thrown when a private tool is invoked without verified authentication (FR-06).
 */
export class AuthenticationRequiredError extends Error {
  public readonly statusCode: number = 401;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

/**
 * Standard JSON-RPC Error representation conforming to JSON-RPC 2.0 specification.
 */
export class JsonRpcError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'JsonRpcError';
    this.code = code;
    this.data = data;
  }
}

/**
 * Handler signature for registered tool execution.
 */
export type ToolHandler<TInput = any, TOutput = any> = (
  args: TInput,
  auth: AuthContext
) => Promise<TOutput>;

/**
 * Extended MCP Tool Response returned by ToolDispatcher.
 */
export interface DispatcherResult<T = unknown> {
  isError: boolean;
  code?: number | string;
  message?: string;
  error?: {
    code: number | string;
    message: string;
    data?: unknown;
  };
  content: Array<{ type: string; text?: string; data?: unknown; [key: string]: unknown }> | T;
  isStale?: boolean;
  timestamp?: string;
}

/**
 * ToolDispatcher
 *
 * Central dispatcher for MCP tool calls.
 * 1. Validates incoming parameters against strict JSON/Zod schemas.
 * 2. Enforces perimeter identity context on restricted tools (FR-06).
 * 3. Enforces standard JSON-RPC -32602 error semantics on invalid parameters.
 * 4. Manages connector handlers and returns NOT_IMPLEMENTED honestly when unattached.
 */
export class ToolDispatcher {
  private readonly handlers: Map<string, ToolHandler> = new Map();

  /**
   * Registers an execution handler for a specific tool.
   */
  public registerHandler<TInput = any, TOutput = any>(
    name: string,
    handler: ToolHandler<TInput, TOutput>
  ): void {
    this.handlers.set(name, handler as ToolHandler);
  }

  /**
   * Checks if an execution handler is currently registered for the given tool.
   */
  public hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Dispatches and processes an incoming tool execution request.
   *
   * @param name Name of the MCP tool to call
   * @param args Input arguments object passed by the client or LLM
   * @param auth Verified identity context injected by the API gateway
   * @throws AuthenticationRequiredError if a private tool is called without studentId
   * @returns Standard DispatcherResult (MCPToolResponse / JSON-RPC error envelope)
   */
  public async dispatch(
    name: string,
    args: unknown,
    auth: AuthContext
  ): Promise<DispatcherResult> {
    // 1. Verify that the requested tool is a recognized tool definition
    const toolDef = TOOL_DEFINITIONS.find((t) => t.name === name);
    if (!toolDef) {
      return {
        isError: true,
        code: -32601,
        message: `Method not found: Tool '${name}' is not recognized`,
        error: {
          code: -32601,
          message: 'Method not found',
          data: { tool: name },
        },
        content: [
          {
            type: 'text',
            text: `JSON-RPC Error -32601 (Method not found): Tool '${name}' does not exist.`,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Authorization check: get_course_schedule requires a verified student identity (FR-06)
    if (name === TOOL_NAMES.COURSE_SCHEDULE) {
      if (!auth || !auth.studentId || typeof auth.studentId !== 'string' || auth.studentId.trim() === '') {
        throw new AuthenticationRequiredError(
          'Authentication required: Verified student identity is required to invoke get_course_schedule'
        );
      }
    }

    // 3. Schema validation against strict JSON Schema / Zod (FR-01, FR-03, FR-04, FR-05, FR-06)
    const validation = validateToolArguments(name, args);
    if (!validation.success) {
      return {
        isError: true,
        code: -32602,
        message: validation.errorMessage,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: validation.details,
        },
        content: [
          {
            type: 'text',
            text: `JSON-RPC Error -32602 (Invalid params): ${validation.errorMessage}`,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }

    // 4. Handler lookup: if handler is not registered yet, return honest NOT_IMPLEMENTED error
    const handler = this.handlers.get(name);
    if (!handler) {
      return {
        isError: true,
        code: 'NOT_IMPLEMENTED',
        message: `NOT_IMPLEMENTED: Handler for tool '${name}' is not implemented yet`,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: `Handler for tool '${name}' has not been registered yet.`,
          data: { tool: name },
        },
        content: [
          {
            type: 'text',
            text: `NOT_IMPLEMENTED: Handler for tool '${name}' has not been registered yet.`,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }

    // 5. Execute registered handler
    try {
      const result = await handler(validation.data, auth);

      // If handler returned an MCPToolResponse envelope, preserve it
      if (
        result &&
        typeof result === 'object' &&
        'isError' in result &&
        'content' in result
      ) {
        return {
          ...result,
          timestamp: result.timestamp ?? new Date().toISOString(),
        } as DispatcherResult;
      }

      // Otherwise wrap raw handler output in standard envelope
      return {
        isError: false,
        content: [
          {
            type: 'json',
            data: result,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        code: -32603,
        message: `Internal error executing '${name}': ${errorMessage}`,
        error: {
          code: -32603,
          message: 'Internal error',
          data: { error: errorMessage },
        },
        content: [
          {
            type: 'text',
            text: `JSON-RPC Error -32603 (Internal error): ${errorMessage}`,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }
}
