/**
 * Liveness endpoint for the Docker / Compose healthcheck of the web service.
 * It only reports that the Next.js server is up; it does not call the gateway,
 * so a gateway outage does not mark the web container unhealthy.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok', service: 'web' }, { headers: { 'Cache-Control': 'no-store' } });
}
