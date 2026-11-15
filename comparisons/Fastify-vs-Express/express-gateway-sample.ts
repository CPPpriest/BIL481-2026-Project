/**
 * Express.js Gateway Sample — Counterpart Comparison (Group-ASYM)
 *
 * Illustrates the additional middleware boilerplate and manual schema/error
 * handling required in Express.js 4.x compared to Fastify:
 * 1. Requires external validation middleware or manual runtime checks per route.
 * 2. Requires `try / next(err)` wrapping for async middleware in Express 4.x.
 * 3. Requires `supertest` (ephemeral socket binding) for integration tests.
 */

interface MockExpressRequest {
  headers: Record<string, string | undefined>;
  body?: { query?: unknown; locale?: unknown };
}

interface MockExpressResponse {
  status(code: number): MockExpressResponse;
  json(payload: unknown): void;
}

type NextFunction = (err?: unknown) => void;

// 1. Manual Token Termination Middleware requiring explicit next() flow
export function expressTokenTerminationMiddleware(
  req: MockExpressRequest,
  _res: MockExpressResponse,
  next: NextFunction
): void {
  try {
    delete req.headers['x-authenticated-student-id'];
    delete req.headers['x-authenticated-user-role'];

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      delete req.headers.authorization;
      req.headers['x-authenticated-student-id'] = '241101066';
      req.headers['x-authenticated-user-role'] = 'STUDENT';
    } else {
      req.headers['x-authenticated-user-role'] = 'GUEST';
    }
    next();
  } catch (err) {
    next(err);
  }
}

// 2. Manual Request Body Validation Middleware (no native JSON Schema compiler)
export function expressValidateQueryBody(
  req: MockExpressRequest,
  res: MockExpressResponse,
  next: NextFunction
): void {
  const query = req.body?.query;
  const locale = req.body?.locale;

  if (typeof query !== 'string' || query.trim().length === 0 || query.length > 500) {
    res.status(400).json({
      error: 'Bad Request',
      code: 'INVALID_REQUEST_BODY',
      message: 'Field "query" must be a non-empty string up to 500 characters.'
    });
    return;
  }

  if (locale !== undefined && locale !== 'tr' && locale !== 'en') {
    res.status(400).json({
      error: 'Bad Request',
      code: 'INVALID_LOCALE',
      message: 'Field "locale" must be either "tr" or "en".'
    });
    return;
  }

  next();
}

