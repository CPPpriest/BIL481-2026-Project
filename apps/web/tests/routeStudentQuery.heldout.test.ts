import { describe, expect, it } from 'vitest';
import { routeStudentQuery } from '../src/router/routeStudentQuery.js';
import {
  ROUTER_HELD_OUT_CORPUS,
  type ExpectedLabel,
  type HeldOutQuery,
} from './fixtures/routerHeldOutCorpus.js';
import { ROUTER_VALIDATION_CORPUS } from './fixtures/routerValidationCorpus.js';

/**
 * Y-01 / FR-16 measurement on corpora that were not used to write the router.
 *
 * Targets (Requirements Document FR-16, QA Plan TC-05, team guide §11.2):
 *   - overall accuracy >= 90 %
 *   - compound queries routed to the agent: 100 %
 *
 * Each suite prints its accuracy, a confusion matrix and the misrouted queries
 * so the run log can be attached as evidence (docs/assignment3/evidence/fr16-router).
 */

const LABELS: readonly ExpectedLabel[] = ['CAFETERIA', 'SHUTTLE', 'LIBRARY', 'AGENT'];

function predictedLabel(query: string): ExpectedLabel {
  const result = routeStudentQuery(query);
  return result.route === 'DIRECT_WIDGET' ? result.intent : 'AGENT';
}

function evaluate(corpus: readonly HeldOutQuery[]) {
  const evaluated = corpus.map((item) => ({ ...item, predicted: predictedLabel(item.query) }));
  const misrouted = evaluated.filter((item) => item.predicted !== item.expected);
  const compound = evaluated.filter((item) => item.compound);
  return {
    evaluated,
    misrouted,
    accuracy: (evaluated.length - misrouted.length) / evaluated.length,
    compoundTotal: compound.length,
    compoundToAgent: compound.filter((item) => item.predicted === 'AGENT').length,
  };
}

function formatReport(name: string, result: ReturnType<typeof evaluate>): string {
  const { evaluated, misrouted, accuracy, compoundTotal, compoundToAgent } = result;
  const matrix = [
    ['expected \\ predicted', ...LABELS].join(' | '),
    ...LABELS.map((expected) =>
      [
        expected,
        ...LABELS.map(
          (predicted) =>
            evaluated.filter((item) => item.expected === expected && item.predicted === predicted).length
        ),
      ].join(' | ')
    ),
  ].join('\n');

  return [
    `[FR-16 ${name} report]`,
    `Corpus size: ${evaluated.length}`,
    `Accuracy: ${(accuracy * 100).toFixed(1)} % (${evaluated.length - misrouted.length}/${evaluated.length})`,
    `Compound -> agent: ${compoundToAgent}/${compoundTotal}`,
    '',
    matrix,
    '',
    misrouted.length === 0
      ? 'Misrouted: none'
      : `Misrouted:\n${misrouted
          .map((item) => `  - [${item.language}] "${item.query}" expected ${item.expected}, got ${item.predicted}`)
          .join('\n')}`,
  ].join('\n');
}

const SUITES = [
  { name: 'held-out', corpus: ROUTER_HELD_OUT_CORPUS, size: 40 },
  { name: 'validation', corpus: ROUTER_VALIDATION_CORPUS, size: 20 },
] as const;

for (const suite of SUITES) {
  describe(`routeStudentQuery ${suite.name} evaluation (Y-01, FR-16)`, () => {
    const result = evaluate(suite.corpus);

    it('reports accuracy, confusion matrix and misrouted queries', () => {
      console.info(`\n${formatReport(suite.name, result)}\n`);
      expect(result.evaluated).toHaveLength(suite.size);
    });

    it('meets the >= 90 % overall accuracy target', () => {
      expect(result.accuracy).toBeGreaterThanOrEqual(0.9);
    });

    it('routes 100 % of compound queries to the LLM agent', () => {
      expect(result.compoundToAgent).toBe(result.compoundTotal);
    });
  });
}
