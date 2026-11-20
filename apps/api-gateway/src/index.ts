import { buildGateway } from './server.js';
import { createRateLimiterStoreFromEnv } from './rate-limiter/redisRateLimiterStore.js';

const PORT = Number(process.env.GATEWAY_PORT || process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const MCP_URL = process.env.MCP_URL || 'http://localhost:3001/mcp';
const AGENT_STREAM_URL =
  process.env.AGENT_STREAM_URL || 'http://localhost:3001/internal/agent/stream';

async function main() {
  const rateLimiter = createRateLimiterStoreFromEnv(process.env);
  const app = buildGateway({
    rateLimiterStore: rateLimiter.store,
    mcpUrl: MCP_URL,
    agentStreamUrl: AGENT_STREAM_URL,
  });

  const shutdown = async (signal: string) => {
    console.log(`[API Gateway] Received ${signal}, shutting down...`);
    try {
      await app.close();
      await rateLimiter.close();
      process.exit(0);
    } catch (err) {
      console.error('[API Gateway] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(
      `[API Gateway] Listening at ${address} (rateLimiter=${rateLimiter.kind}, mcpUrl=${MCP_URL})`
    );
  } catch (err) {
    console.error('[API Gateway] Failed to start:', err);
    await rateLimiter.close();
    process.exit(1);
  }
}

main();
