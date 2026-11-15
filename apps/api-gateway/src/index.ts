import { buildGateway } from './server.js';

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = buildGateway();

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`[API Gateway] Listening at ${address}`);
  } catch (err) {
    console.error('[API Gateway] Failed to start:', err);
    process.exit(1);
  }
}

main();

