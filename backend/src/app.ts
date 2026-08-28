import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { authMiddleware } from './security/middleware/auth.middleware.js';
import { DomainError } from './core/errors.js';

import { instrumentRoutes } from './routes/instruments.routes.js';
import { applicationRoutes } from './routes/applications.routes.js';
import { sessionRoutes } from './routes/sessions.routes.js';
import { stampRoutes } from './routes/stamps.routes.js';
import { certificateRoutes } from './routes/certificates.routes.js';
import { evidenceRoutes } from './routes/evidence.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { authRoutes } from './auth/auth.routes.js';

/**
 * Builds and configures the Fastify Application instance
 */
export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    ...opts,
  });

  // 1. Security Middleware: Helmet
  await app.register(helmet, {
    contentSecurityPolicy: false, // Permissive for API and embedded frames in preview
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // 2. Cross-Origin Resource Sharing (CORS)
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Actor-Id',
      'X-Actor-Role',
      'X-Tenant-Id',
      'X-Jurisdiction-Id',
      'X-Test-User-Id',
      'X-Test-Role',
      'X-Test-Tenant-Id',
      'X-Test-Jurisdiction-Id',
    ],
  });

  // 3. Rate Limiting Protection
  await app.register(rateLimit, {
    max: 2000,
    timeWindow: '1 minute',
  });

  // 4. Global Auth and Statutory Header Extraction Hook
  app.addHook('preHandler', authMiddleware);

  // 5. Unified Error Handler: Guarantees { detail: string } JSON format
  app.setErrorHandler((error: any, _request, reply) => {
    let statusCode = 500;
    let detailMessage = error?.message || 'Internal server error';

    if (error instanceof DomainError) {
      statusCode = error.statusCode;
      detailMessage = error.message;
    } else if (error && typeof error === 'object' && typeof error.statusCode === 'number') {
      statusCode = error.statusCode;
    }

    if (error && typeof error === 'object' && error.validation) {
      statusCode = 422;
      detailMessage = error.message;
    }

    return reply.status(statusCode).send({
      detail: detailMessage,
      statusCode,
      error: error?.name || 'Error',
    });
  });

  // 6. Health Check Endpoint
  app.get('/health', async () => ({
    status: 'HEALTHY',
    service: 'legal-metrology-verification-api',
    engine: 'Fastify v5 + TypeScript + Prisma',
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/v1/health', async () => ({
    status: 'HEALTHY',
    service: 'legal-metrology-verification-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  // System Reset Endpoint (Cleans all transactions & reseeds 21 approved models)
  app.post('/api/v1/system/reset-database', async (_request, reply) => {
    const { seedDatabase } = await import('./db/seed.js');
    await seedDatabase();
    return reply.send({
      status: 'SUCCESS',
      message: 'Database reset to clean state with 21 statutory Indian models.',
      timestamp: new Date().toISOString(),
    });
  });
  // 7. Register REST API Routes under /api/v1 prefix
  await app.register(
    async (v1) => {
      await v1.register(instrumentRoutes);
      await v1.register(applicationRoutes);
      await v1.register(sessionRoutes);
      await v1.register(stampRoutes);
      await v1.register(evidenceRoutes);
      await v1.register(certificateRoutes);
      await v1.register(publicRoutes);
      await v1.register(adminRoutes);
      await v1.register(authRoutes);
    },
    { prefix: '/api/v1' }
  );

  // 8. Register Root Scanner & Certificate Aliases
  await app.register(publicRoutes);
  await app.register(certificateRoutes);

  return app;
}

export default buildApp;
