import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'apps/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@campus-orchestrator/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@campus-orchestrator/mcp-server': path.resolve(__dirname, 'apps/mcp-server/src/index.ts'),
    },
  },
});
