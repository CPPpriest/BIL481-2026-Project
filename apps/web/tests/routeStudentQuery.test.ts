import { describe, expect, it } from 'vitest';
import { TOOL_NAMES } from '@campus-orchestrator/shared';
import {
  normalizeStudentQuery,
  routeStudentQuery,
  type StudentQueryRoute,
} from '../src/index.js';

interface LabeledQuery {
  query: string;
  expectedRoute: StudentQueryRoute['route'];
  expectedTool?: string;
}

const turkishQueries: readonly LabeledQuery[] = [
  { query: 'Bugün yemekte ne var?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.CAFETERIA_MENU },
  { query: 'Bugünün menüsünü göster', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.CAFETERIA_MENU },
  { query: 'Öğle yemeğinde ne var?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.CAFETERIA_MENU },
  { query: 'Akşam yemeği menüsü', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.CAFETERIA_MENU },
  { query: 'Kafeterya menüsünü aç', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.CAFETERIA_MENU },
  { query: 'Sonraki ring kaçta?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.SHUTTLE_SCHEDULE },
  { query: 'Ring saatlerini göster', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.SHUTTLE_SCHEDULE },
  { query: 'Metro servisi ne zaman?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.SHUTTLE_SCHEDULE },
  { query: 'Otobüs kalkış saatleri', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.SHUTTLE_SCHEDULE },
  { query: 'Yurda ring var mı?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.SHUTTLE_SCHEDULE },
  { query: 'Kütüphane dolu mu?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.LIBRARY_OCCUPANCY },
  { query: 'Kütüphanede boş yer var mı?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.LIBRARY_OCCUPANCY },
  { query: 'Kütüphane ikinci kat doluluk oranı', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.LIBRARY_OCCUPANCY },
  { query: 'Çalışma alanı doluluğu', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.LIBRARY_OCCUPANCY },
  { query: 'Kütüphanede boş koltuk bulunuyor mu?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.LIBRARY_OCCUPANCY },
  { query: 'Menü ve ring saatleri', expectedRoute: 'LLM_AGENT' },
  { query: 'Dersten sonra ringe yetişir miyim?', expectedRoute: 'LLM_AGENT' },
  { query: 'Yemek, kütüphane ve ring durumunu söyle', expectedRoute: 'LLM_AGENT' },
  { query: 'Ders programımı göster', expectedRoute: 'LLM_AGENT' },
  { query: 'Merhaba, bana yardım eder misin?', expectedRoute: 'LLM_AGENT' },
] as const;

const englishQueries: readonly LabeledQuery[] = [
  { query: 'Show the cafeteria menu', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.CAFETERIA_MENU },
  { query: 'What is for lunch today?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.CAFETERIA_MENU },
  { query: 'Show me the dinner menu', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.CAFETERIA_MENU },
  { query: 'What food is available today?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.CAFETERIA_MENU },
  { query: 'Today\'s meal options', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.CAFETERIA_MENU },
  { query: 'When is the next shuttle?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.SHUTTLE_SCHEDULE },
  { query: 'Show the ring times', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.SHUTTLE_SCHEDULE },
  { query: 'Metro shuttle schedule', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.SHUTTLE_SCHEDULE },
  { query: 'Campus bus departure time', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.SHUTTLE_SCHEDULE },
  { query: 'Dormitory shuttle times', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.SHUTTLE_SCHEDULE },
  { query: 'How full is the library?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.LIBRARY_OCCUPANCY },
  { query: 'Are there library seats available?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.LIBRARY_OCCUPANCY },
  { query: 'Study space availability', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.LIBRARY_OCCUPANCY },
  { query: 'Any empty seats in the library?', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.LIBRARY_OCCUPANCY },
  { query: 'Library floor 2 occupancy', expectedRoute: 'DIRECT_WIDGET', expectedTool: TOOL_NAMES.LIBRARY_OCCUPANCY },
  { query: 'Show the menu and the next shuttle', expectedRoute: 'LLM_AGENT' },
  { query: 'Can I catch the ring after class?', expectedRoute: 'LLM_AGENT' },
  { query: 'Food, library occupancy, and shuttle status', expectedRoute: 'LLM_AGENT' },
  { query: 'Show my class schedule', expectedRoute: 'LLM_AGENT' },
  { query: 'Hello, can you help me?', expectedRoute: 'LLM_AGENT' },
] as const;

function expectLabeledResult(testCase: LabeledQuery): void {
  const result = routeStudentQuery(testCase.query);

  expect(result.route).toBe(testCase.expectedRoute);

  if (testCase.expectedTool !== undefined) {
    expect(result.route).toBe('DIRECT_WIDGET');
    if (result.route === 'DIRECT_WIDGET') {
      expect(result.toolName).toBe(testCase.expectedTool);
    }
  }
}

describe('routeStudentQuery (FR-16)', () => {
  describe('40-query bilingual acceptance benchmark', () => {
    it.each(turkishQueries)('routes Turkish query: $query', (testCase) => {
      expectLabeledResult(testCase);
    });

    it.each(englishQueries)('routes English query: $query', (testCase) => {
      expectLabeledResult(testCase);
    });
  });

  it('routes every compound benchmark query to the LLM agent', () => {
    const allQueries = [...turkishQueries, ...englishQueries];
    const compoundQueries = allQueries.filter(({ query }) =>
      /(?:,|\b(?:and|then|after|before|ve|sonra)\b)/i.test(
        normalizeStudentQuery(query)
      )
    );

    expect(compoundQueries.length).toBeGreaterThan(0);
    for (const { query } of compoundQueries) {
      expect(routeStudentQuery(query).route).toBe('LLM_AGENT');
    }
  });

  it('recognizes the documented Turkish and English compound markers', () => {
    const compoundQueries = [
      'menu and shuttle',
      'menu then library occupancy',
      'shuttle after class',
      'menu, shuttle',
      'menü ve ring',
      'dersten sonra ring',
      'ring ile yemek',
      'dersten önce ring',
      'food with shuttle',
    ];

    for (const query of compoundQueries) {
      expect(routeStudentQuery(query).route).toBe('LLM_AGENT');
    }
  });

  it('routes empty, whitespace-only, and unmatched queries safely to the LLM agent', () => {
    expect(routeStudentQuery('')).toMatchObject({
      route: 'LLM_AGENT',
      reason: 'EMPTY_QUERY',
    });
    expect(routeStudentQuery('   ')).toMatchObject({
      route: 'LLM_AGENT',
      reason: 'EMPTY_QUERY',
    });
    expect(routeStudentQuery('Tell me something interesting')).toMatchObject({
      route: 'LLM_AGENT',
      reason: 'UNMATCHED_QUERY',
    });
  });

  it('routes a multi-domain query without a conjunction as ambiguous', () => {
    expect(routeStudentQuery('menu ring')).toMatchObject({
      route: 'LLM_AGENT',
      reason: 'AMBIGUOUS_QUERY',
    });
  });

  it('normalizes Turkish casing, diacritics, and repeated whitespace', () => {
    expect(normalizeStudentQuery('  KÜTÜPHANE   DOLULUĞU  ')).toBe(
      'kutuphane dolulugu'
    );
  });
});
