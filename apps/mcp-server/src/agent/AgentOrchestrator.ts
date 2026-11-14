import type { AuthContext } from '@campus-orchestrator/shared';
import type { ToolDispatcher } from '../dispatcher/ToolDispatcher.js';

/**
 * Single step within a planned multi-tool execution workflow (FR-13).
 */
export interface AgentPlanStep {
  toolName: string;
  parameters: Record<string, unknown>;
  reasoning?: string;
}

/**
 * Execution telemetry badge rendered in the client chat view (FR-17).
 */
export interface AgentTelemetryBadge {
  toolName: string;
  status: 'CACHE_HIT' | 'LIVE' | 'STALE' | 'ERROR';
  durationMs: number;
}

/**
 * Result of multi-tool contextual synthesis by the AI Agent (FR-13).
 */
export interface AgentSynthesisResult {
  text: string;
  toolsInvoked: string[];
  badges: AgentTelemetryBadge[];
  isComplete: boolean;
}

/**
 * Contract for the AI Agent Orchestration engine (FR-13, FR-14).
 */
export interface IAgentOrchestrator {
  /**
   * Plans and executes a multi-step tool reasoning chain for a compound query.
   *
   * @param query Raw natural language query from student
   * @param auth Verified identity context injected by gateway
   * @returns Synthesized response accompanied by tool execution telemetry
   */
  executePlan(query: string, auth: AuthContext): Promise<AgentSynthesisResult>;
}

/**
 * AgentOrchestrator
 *
 * Skeleton implementation for FR-13 Multi-Tool AI Agent Orchestration.
 *
 * NOTE: Per the BIL 481 Project Plan and Architecture Specification,
 * active LLM provider integration (Google Gemini API via Provider Adapter)
 * is scheduled for Phase 3 (Core Development, 21 Nov - 25 Dec 2026).
 *
 * This class defines the architectural boundary, type contracts, and dependency
 * injection requirements without fabricating non-functional mock LLM responses.
 */
export class AgentOrchestrator implements IAgentOrchestrator {
  private readonly dispatcher: ToolDispatcher;

  constructor(dispatcher: ToolDispatcher) {
    this.dispatcher = dispatcher;
  }

  /**
   * Returns the attached ToolDispatcher instance.
   */
  public getDispatcher(): ToolDispatcher {
    return this.dispatcher;
  }

  /**
   * Executes multi-tool planning and synthesis.
   * Currently a skeleton throwing NOT_IMPLEMENTED until Phase 3 LLM integration.
   */
  public async executePlan(
    query: string,
    auth: AuthContext
  ): Promise<AgentSynthesisResult> {
    // TODO: Phase 3 - Gemini provider adapter & multi-tool orchestration
    // Implementation Roadmap for Phase 3:
    // 1. Initialize Gemini client using GEMINI_API_KEY from environment.
    // 2. Supply registered tool definitions from TOOL_DEFINITIONS as Gemini function declarations.
    // 3. Scrub Personally Identifiable Information (PII) from prompt context (FR-14).
    // 4. Receive model function call invocations and dispatch via this.dispatcher.dispatch(name, args, auth).
    // 5. Send tool results back to the model context.
    // 6. Return synthesized final answer with tool duration badges and staleness flags.

    throw new Error(
      `NOT_IMPLEMENTED: AgentOrchestrator multi-tool synthesis is scheduled for Phase 3 (Core Development). ` +
        `Query received: "${query}". Role: ${auth.role}.`
    );
  }
}
