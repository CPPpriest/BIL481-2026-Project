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
  | 'PERSONAL_QUERY'
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

/**
 * Words that point to the student's personal timetable (FR-06). Such data is
 * only available to an authenticated student through the agent, so a query
 * containing them never takes the direct widget path, even if it also names
 * a cafeteria, shuttle or library keyword ("Dersim bitince ring var mı?").
 */
const PERSONAL_QUERY_PATTERN =
  /\b(?:ders\w*|sinav\w*|laboratuvar\w*|class(?:es)?|lectures?|courses?|exams?)\b/i;

/*
 * Turkish keywords end in \w* so that suffixed forms match as well
 * ("servisinin", "kütüphanede", "ringle", "metroya").
 */
const INTENT_DEFINITIONS: readonly IntentDefinition[] = [
  {
    intent: 'CAFETERIA',
    toolName: TOOL_NAMES.CAFETERIA_MENU,
    patterns: [
      /\b(?:cafeteria|menus?|lunch|dinner|meals?|food|eat)\b/i,
      /\b(?:yemek\w*|yemeg\w*|menu\w*|kafeterya\w*|yiy\w*)\b/i,
    ],
  },
  {
    intent: 'SHUTTLE',
    toolName: TOOL_NAMES.SHUTTLE_SCHEDULE,
    patterns: [
      /\b(?:shuttles?|rings?|bus(?:es)?|departures?)\b/i,
      /\b(?:ring\w*|servis\w*|otobus\w*|kalkis\w*|kalkiyor|kalkar|metro\w*)\b/i,
    ],
  },
  {
    intent: 'LIBRARY',
    toolName: TOOL_NAMES.LIBRARY_OCCUPANCY,
    patterns: [
      /\b(?:library|study space|empty seats?|available seats?)\b/i,
      /\b(?:kutuphane\w*|doluluk\w*|calisma alan\w*|bos yer|bos koltuk)\b/i,
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

  if (PERSONAL_QUERY_PATTERN.test(normalizedQuery)) {
    return {
      route: 'LLM_AGENT',
      reason: 'PERSONAL_QUERY',
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
