import { describe, expect, it } from 'vitest';
import {
  checkConnectorHealth,
  ConnectorConfigError,
  ConnectorUnavailableError,
  createCampusConnectors,
  DEFAULT_MOCK_SEED,
  loadConnectorConfig,
  MockCafeteriaConnector,
  MockCourseScheduleConnector,
  MockLibraryConnector,
  MockShuttleConnector,
  resolveConnectorMode,
  UnavailableLiveConnector,
} from '../../packages/connectors/src/index.js';
import { MONDAY, TestClock } from './helpers.js';

describe('Connector configuration (FR-09, FR-12)', () => {
  it('defaults every connector to mock mode with the shared TTLs, 800 ms timeout and default seed', () => {
    const config = loadConnectorConfig({});
    expect(config.modes).toEqual({ cafeteria: 'mock', shuttle: 'mock', library: 'mock', courseSchedule: 'mock' });
    expect(config.ttlSeconds).toEqual({ cafeteria: 3600, shuttle: 120, library: 60, courseSchedule: 300 });
    expect(config.upstreamTimeoutMs).toBe(800);
    expect(config.mockSeed).toBe(DEFAULT_MOCK_SEED);
  });

  it('reads the exact variable names used in .env.example', () => {
    const config = loadConnectorConfig({
      CAFETERIA_CONNECTOR_MODE: 'live',
      SHUTTLE_CONNECTOR_MODE: 'MOCK',
      LIBRARY_CONNECTOR_MODE: ' mock ',
      SCHEDULE_CONNECTOR_MODE: 'live',
      UPSTREAM_TIMEOUT_MS: '500',
      CACHE_TTL_SHUTTLE: '90',
      CONNECTOR_MOCK_SEED: 'demo-seed',
    });
    expect(config.modes).toEqual({ cafeteria: 'live', shuttle: 'mock', library: 'mock', courseSchedule: 'live' });
    expect(config.upstreamTimeoutMs).toBe(500);
    expect(config.ttlSeconds.shuttle).toBe(90);
    expect(config.ttlSeconds.cafeteria).toBe(3600);
    expect(config.mockSeed).toBe('demo-seed');
  });

  it('fails fast on invalid values instead of silently guessing', () => {
    expect(() => resolveConnectorMode('library', { LIBRARY_CONNECTOR_MODE: 'fake' })).toThrow(ConnectorConfigError);
    expect(() => loadConnectorConfig({ UPSTREAM_TIMEOUT_MS: '-5' })).toThrow(ConnectorConfigError);
    expect(() => loadConnectorConfig({ CACHE_TTL_LIBRARY: 'abc' })).toThrow(ConnectorConfigError);
  });
});

describe('Connector factory: hot-swappable modes without code changes (FR-12)', () => {
  const clock = new TestClock(`${MONDAY}T10:00`);

  it('builds the four mock connectors in mock mode', () => {
    const set = createCampusConnectors(loadConnectorConfig({}), clock.now);
    expect(set.cafeteria).toBeInstanceOf(MockCafeteriaConnector);
    expect(set.shuttle).toBeInstanceOf(MockShuttleConnector);
    expect(set.library).toBeInstanceOf(MockLibraryConnector);
    expect(set.courseSchedule).toBeInstanceOf(MockCourseScheduleConnector);
    for (const connector of Object.values(set)) {
      expect(connector.mode).toBe('mock');
      expect(connector.isMock).toBe(true);
    }
  });

  it('switches only the configured connector to live; live placeholders fail honestly', async () => {
    const set = createCampusConnectors(loadConnectorConfig({ CAFETERIA_CONNECTOR_MODE: 'live' }), clock.now);
    expect(set.cafeteria).toBeInstanceOf(UnavailableLiveConnector);
    expect(set.cafeteria.mode).toBe('live');
    expect(set.shuttle).toBeInstanceOf(MockShuttleConnector);
    await expect(set.cafeteria.execute({ date: MONDAY })).rejects.toBeInstanceOf(ConnectorUnavailableError);
  });

  it('reports health per connector (UP for mock, DOWN for unavailable live)', async () => {
    const set = createCampusConnectors(loadConnectorConfig({ LIBRARY_CONNECTOR_MODE: 'live' }), clock.now);
    const health = await checkConnectorHealth(set);
    expect(health.map((h) => [h.connector, h.mode, h.status])).toEqual([
      ['cafeteria', 'mock', 'UP'],
      ['shuttle', 'mock', 'UP'],
      ['library', 'live', 'DOWN'],
      ['courseSchedule', 'mock', 'UP'],
    ]);
    expect(health[2]!.detail).toMatch(/not confirmed/);
  });

  it('two runs with the same seed produce identical data across all connectors (FR-12 acceptance)', async () => {
    const run = async () => {
      const set = createCampusConnectors(loadConnectorConfig({ CONNECTOR_MOCK_SEED: 'repeatable' }), clock.now);
      return Promise.all([
        set.cafeteria.execute({ date: MONDAY }),
        set.shuttle.execute({ route: 'METRO_LINE' }),
        set.library.execute({ floor: 'ALL' }),
        set.courseSchedule.execute({ day: 'TODAY' }, { studentId: '241101065', role: 'STUDENT' }),
      ]);
    };
    expect(await run()).toEqual(await run());
  });
});
