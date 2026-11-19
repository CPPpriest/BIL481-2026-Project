import type { NextConfig } from 'next';

/**
 * The browser only ever talks to this web app's own origin. Requests to
 * /api/v1/* are rewritten on the server side to the Fastify gateway
 * (API Contract v1.1 §1 "Browser origin", §7 GATEWAY_URL), so the gateway
 * needs no CORS configuration and its address is never exposed to the client.
 */
const gatewayUrl = (process.env.GATEWAY_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
