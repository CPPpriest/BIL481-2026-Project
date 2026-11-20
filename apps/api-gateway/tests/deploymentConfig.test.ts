import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

describe('Gateway & Compose Deployment Configuration Security (S-05, S-06)', () => {
  it('compose.yaml should enforce internal network isolation for mcp-server and redis', () => {
    const composePath = path.join(repoRoot, 'compose.yaml');
    const compose = fs.readFileSync(composePath, 'utf8');

    expect(compose).toContain('internal: true');
    expect(compose).toContain('redis:');
    expect(compose).toContain('mcp-server:');
    expect(compose).toContain('api-gateway:');
    expect(compose).toContain('web:');

    // Every service must define a healthcheck
    const healthcheckCount = (compose.match(/healthcheck:/g) || []).length;
    expect(healthcheckCount).toBe(4);

    // Extract per-service blocks to verify ports & network boundaries
    const redisBlock = compose.slice(compose.indexOf('  redis:'), compose.indexOf('  # BLOCKED (Murat'));
    const mcpBlock = compose.slice(compose.indexOf('  mcp-server:'), compose.indexOf('  api-gateway:'));
    const webBlock = compose.slice(compose.indexOf('  web:'));

    expect(redisBlock).not.toMatch(/^\s+ports:/m);
    expect(mcpBlock).not.toMatch(/^\s+ports:/m);
    expect(mcpBlock).toContain('- internal');
    expect(mcpBlock).not.toContain('- edge');

    expect(webBlock).toContain('- edge');
    expect(webBlock).not.toContain('- internal');
    expect(webBlock).toContain('3002:3002');

    // Secrets must come from env substitution, never hardcoded literals
    expect(compose).toContain('${JWT_SECRET');
    expect(compose).toContain('${GEMINI_API_KEY');
    expect(compose).not.toContain('campus-orchestrator-test-secret-key-bil481');
  });

  it('api-gateway Dockerfile and .dockerignore should follow non-root and secret-exclusion rules', () => {
    const dockerfile = fs.readFileSync(
      path.join(repoRoot, 'apps/api-gateway/Dockerfile'),
      'utf8'
    );
    const dockerignore = fs.readFileSync(
      path.join(repoRoot, 'apps/api-gateway/Dockerfile.dockerignore'),
      'utf8'
    );

    expect(dockerfile).toContain('node:24-alpine');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('GATEWAY_PORT=3000');
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(dockerfile).toContain('http://127.0.0.1:3000/health');

    expect(dockerignore).toContain('**/.env');
    expect(dockerignore).toContain('**/.env.*');
    expect(dockerignore).toContain('.git');
    expect(dockerignore).toContain('apps/web');
    expect(dockerignore).toContain('apps/mcp-server');
    expect(dockerignore).toContain('packages/connectors');
  });

  it('contract error fixtures should validate against API Contract v1.1 §3.4', () => {
    const invalidFixture = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tests/contracts/fixtures/query-invalid-params.json'), 'utf8')
    );
    const unauthFixture = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tests/contracts/fixtures/query-unauthorized.json'), 'utf8')
    );

    expect(invalidFixture.ok).toBe(false);
    expect(invalidFixture.error.code).toBe('INVALID_PARAMS');
    expect(typeof invalidFixture.error.message).toBe('string');
    expect(typeof invalidFixture.timestamp).toBe('string');

    expect(unauthFixture.ok).toBe(false);
    expect(unauthFixture.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(typeof unauthFixture.error.message).toBe('string');
    expect(typeof unauthFixture.timestamp).toBe('string');
  });
});
