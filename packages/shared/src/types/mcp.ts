/**
 * MCP and System-Level Architecture Types
 */

/**
 * User roles across the platform
 */
export type UserRole = 'STUDENT' | 'FACULTY' | 'GUEST';

/**
 * Authentication Context injected by the API Gateway
 */
export interface AuthContext {
  studentId?: string;
  role: 'STUDENT' | 'FACULTY' | 'GUEST';
}

/**
 * Content block inside an MCP tool response
 */
export interface MCPContentBlock {
  type: string;
  text?: string;
  data?: unknown;
  [key: string]: unknown;
}

/**
 * Standard MCP Tool Response Envelope
 */
export interface MCPToolResponse<T = unknown> {
  isError: boolean;
  content: MCPContentBlock[] | T;
  isStale?: boolean;
  timestamp?: string;
}

/**
 * Common interface for all Campus Connectors (FR-12)
 *
 * Each connector wraps a campus data service with support for both
 * live access and deterministic synthetic mock generation.
 */
export interface ICampusConnector<TInput = unknown, TOutput = unknown> {
  readonly isMock?: boolean;
  execute(input: TInput, context?: AuthContext): Promise<TOutput>;
}
