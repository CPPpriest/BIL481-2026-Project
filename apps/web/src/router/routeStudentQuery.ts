import { TOOL_NAMES } from '@campus-orchestrator/shared';

export type QueryRoute = 'DIRECT_WIDGET' | 'LLM_AGENT';

export type DirectIntent = 'CAFETERIA' | 'SHUTTLE' | 'LIBRARY';

export type DirectToolName =
  | typeof TOOL_NAMES.CAFETERIA_MENU
  | typeof TOOL_NAMES.SHUTTLE_SCHEDULE
  | typeof TOOL_NAMES.LIBRARY_OCCUPANCY;

export type AgentRoutingReason =
  | 'EMPTY_QUERY'
  | 'COMPOUND_QUERY'
  | 'AMBIGUOUS_QUERY'
  | 'UNMATCHED_QUERY';

export interface DirectWidgetRoute {
  route: 'DIRECT_WIDGET';
  intent: DirectIntent;
  toolName: DirectToolName;
  normalizedQuery: string;
}

export interface AgentRoute {
  route: 'LLM_AGENT';
  reason: AgentRoutingReason;
  normalizedQuery: string;
}

export type StudentQueryRoute = DirectWidgetRoute | AgentRoute;

interface IntentDefinition {
  intent: DirectIntent;
  toolName: DirectToolName;
  patterns: readonly RegExp[];
}

const COMPOUND_QUERY_PATTERN =
  /(?:,|\b(?:and|then|after|before|with|ve|ile|sonra|once|ardindan)\b)/i;

const INTENT_DEFINITIONS: readonly IntentDefinition[] = [
  {
    intent: 'CAFETERIA',
    toolName: TOOL_NAMES.CAFETERIA_MENU,
    patterns: [
      /\b(?:cafeteria|menu|lunch|dinner|meal|food)\b/i,
      /\b(?:yemek\w*|yemeg\w*|menu\w*|ogle yemeg\w*|aksam yemeg\w*|kafeterya)\b/i,
    ],
  },
  {
    intent: 'SHUTTLE',
    toolName: TOOL_NAMES.SHUTTLE_SCHEDULE,
    patterns: [
      /\b(?:shuttle|ring|campus bus|bus departure|departure|metro shuttle)\b/i,
      /\b(?:ring|servis|kampus otobusu|otobus|kalkis|metro)\b/i,
    ],
  },
  {
    intent: 'LIBRARY',
    toolName: TOOL_NAMES.LIBRARY_OCCUPANCY,
    patterns: [
      /\b(?:library|library occupancy|study space|empty seats?|available seats?)\b/i,
      /\b(?:kutuphane|doluluk|calisma alani|bos yer|bos koltuk)\b/i,
    ],
  },
] as const;

/**
 * Normalizes Turkish and English text into an ASCII-comparable form so that
 * the deterministic router does not need separate expressions for every
 * casing and diacritic combination.
 */
export function normalizeStudentQuery(query: string): string {
  return query
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0131/g, 'i')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classifies a student query according to FR-16.
 *
 * Only an unambiguous, single-domain cafeteria, shuttle, or library query is
 * allowed onto the direct widget path. Compound, unmatched, and ambiguous
 * queries fail safely to the LLM agent path.
 */
export function routeStudentQuery(query: string): StudentQueryRoute {
  const normalizedQuery = normalizeStudentQuery(query);

  if (normalizedQuery.length === 0) {
    return {
      route: 'LLM_AGENT',
      reason: 'EMPTY_QUERY',
      normalizedQuery,
    };
  }

  if (COMPOUND_QUERY_PATTERN.test(normalizedQuery)) {
    return {
      route: 'LLM_AGENT',
      reason: 'COMPOUND_QUERY',
      normalizedQuery,
    };
  }

  const matches = INTENT_DEFINITIONS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(normalizedQuery))
  );

  if (matches.length === 0) {
    return {
      route: 'LLM_AGENT',
      reason: 'UNMATCHED_QUERY',
      normalizedQuery,
    };
  }

  if (matches.length > 1) {
    return {
      route: 'LLM_AGENT',
      reason: 'AMBIGUOUS_QUERY',
      normalizedQuery,
    };
  }

  const match = matches[0];
  if (match === undefined) {
    return {
      route: 'LLM_AGENT',
      reason: 'UNMATCHED_QUERY',
      normalizedQuery,
    };
  }

  return {
    route: 'DIRECT_WIDGET',
    intent: match.intent,
    toolName: match.toolName,
    normalizedQuery,
  };
}
