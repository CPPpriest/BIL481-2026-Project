/**
 * Fastify Gateway Sample — Campus Data Orchestrator (Group-ASYM)
 *
 * Demonstrates why Fastify was chosen over Express for the API Gateway:
 * 1. Native JSON Schema validation at route registration (Ajv-compiled at boot).
 * 2. Typed preHandler lifecycle hooks for JWT verification and Token Termination.
 * 3. Zero-socket in-memory HTTP testing via `app.inject()` for deterministic CI tests.
 */

import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface QueryRequestBody {
  query: string;
  locale?: 'tr' | 'en';
}

export function buildFastifyGatewaySample(): FastifyInstance {
  const app = Fastify({ logger: false });

  // Lifecycle Hook: Anti-spoofing + Token Termination before route handler runs
  app.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    delete request.headers['x-authenticated-student-id'];
    delete request.headers['x-authenticated-user-role'];

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      // Terminate raw token at gateway perimeter and inject verified context
      delete request.headers.authorization;
      request.headers['x-authenticated-student-id'] = '241101066';
      request.headers['x-authenticated-user-role'] = 'STUDENT';
    } else {
      request.headers['x-authenticated-user-role'] = 'GUEST';
    }
  });

  // Declarative JSON Schema validation compiled once at startup
  app.post<{ Body: QueryRequestBody }>(
    '/api/v1/query',
    {
      schema: {
        body: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string', minLength: 1, maxLength: 500 },
            locale: { type: 'string', enum: ['tr', 'en'] }
          },
          additionalProperties: false
        }
      }
    },
    async (request, reply) => {
      return reply.code(200).send({
        status: 'ok',
        role: request.headers['x-authenticated-user-role'],
        studentId: request.headers['x-authenticated-student-id'] ?? null,
        query: request.body.query
      });
    }
  );

  return app;
}

