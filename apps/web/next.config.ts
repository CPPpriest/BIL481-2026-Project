import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/**
 * The browser only ever talks to this web app's own origin. Requests to
 * /api/v1/* are rewritten on the server side to the Fastify gateway
 * (API Contract v1.1 §1 "Browser origin", §7 GATEWAY_URL), so the gateway
 * needs no CORS configuration and its address is never exposed to the client.
 *
 * Note: Next.js resolves rewrites at BUILD time. In Docker, GATEWAY_URL is
 * therefore passed as a build argument (see apps/web/Dockerfile), not only as
 * a runtime environment variable.
 */
const gatewayUrl = (process.env.GATEWAY_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** Monorepo root, so the standalone output also traces packages/shared. */
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server for the Docker image (apps/web/Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${gatewayUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
