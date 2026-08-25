import { FastifyPluginAsync } from 'fastify';
import { sessionService } from '../services/session.service.js';
import { tenantGuard } from '../security/middleware/tenant.guard.js';
import { requireRoles } from '../security/middleware/rbac.guard.js';
import { VerificationOutcomeEnum } from '../core/types.js';

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /tenants/:tenantId/sessions
  fastify.get<{
    Params: { tenantId: string };
    Querystring: { page?: string; page_size?: string };
  }>('/tenants/:tenantId/sessions', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId } = request.params;
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const pageSize = request.query.page_size ? parseInt(request.query.page_size, 10) : 50;

    const result = await sessionService.listSessions(tenantId, page, pageSize);
    return reply.send(result);
  });

  // GET /tenants/:tenantId/sessions/:id
  fastify.get<{
    Params: { tenantId: string; id: string };
  }>('/tenants/:tenantId/sessions/:id', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId, id } = request.params;
    const session = await sessionService.getSessionById(tenantId, id);
    return reply.send(session);
  });

  // POST /tenants/:tenantId/sessions
  fastify.post<{
    Params: { tenantId: string };
    Body: {
      application_id: string;
      instrument_id: string;
      procedure_pack_id?: string;
      scheduled_date?: string;
      environmental_temp_celsius?: number;
      environmental_humidity_percent?: number;
    };
  }>(
    '/tenants/:tenantId/sessions',
    { preHandler: [tenantGuard, requireRoles('LMO', 'GATC_VERIFIER', 'SUPERVISOR', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId } = request.params;
      const body = request.body;

      const created = await sessionService.createSession(
        tenantId,
        {
          application_id: body.application_id,
          instrument_id: body.instrument_id,
          procedure_pack_id: body.procedure_pack_id,
          scheduled_date: body.scheduled_date || new Date().toISOString(),
          environmental_temp_celsius: body.environmental_temp_celsius,
          environmental_humidity_percent: body.environmental_humidity_percent,
        },
        request.securityContext
      );

      return reply.status(201).send(created);
    }
  );

  // POST /tenants/:tenantId/sessions/:id/identity
  fastify.post<{
    Params: { tenantId: string; id: string };
    Querystring: { serial_verified?: string | boolean };
    Body?: { serial_verified?: boolean };
  }>(
    '/tenants/:tenantId/sessions/:id/identity',
    { preHandler: [tenantGuard, requireRoles('LMO', 'GATC_VERIFIER', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId, id } = request.params;
      const queryParam = request.query.serial_verified;
      const bodyParam = request.body?.serial_verified;

      const isVerified =
        queryParam === true ||
        queryParam === 'true' ||
        bodyParam === true ||
        queryParam === undefined; // Default true if endpoint called

      const updated = await sessionService.confirmIdentity(
        tenantId,
        id,
        isVerified,
        request.securityContext
      );
      return reply.send(updated);
    }
  );

  // POST /tenants/:tenantId/sessions/:id/start
  fastify.post<{
    Params: { tenantId: string; id: string };
  }>(
    '/tenants/:tenantId/sessions/:id/start',
    { preHandler: [tenantGuard, requireRoles('LMO', 'GATC_VERIFIER', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId, id } = request.params;
      const started = await sessionService.startSession(tenantId, id, request.securityContext);
      return reply.send(started);
    }
  );

  // POST /tenants/:tenantId/sessions/:id/observations
  fastify.post<{
    Params: { tenantId: string; id: string };
    Body: {
      reference_standard_ids: string[];
      observations: any[];
      environmental_temp_celsius?: number;
      environmental_humidity_percent?: number;
    };
  }>(
    '/tenants/:tenantId/sessions/:id/observations',
    { preHandler: [tenantGuard, requireRoles('LMO', 'GATC_VERIFIER', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId, id } = request.params;
      const submitted = await sessionService.submitObservations(
        tenantId,
        id,
        request.body,
        request.securityContext
      );
      return reply.send(submitted);
    }
  );

  // POST /tenants/:tenantId/sessions/:id/disposition
  fastify.post<{
    Params: { tenantId: string; id: string };
    Body: {
      outcome: VerificationOutcomeEnum;
      disposition_notes?: string;
    };
  }>(
    '/tenants/:tenantId/sessions/:id/disposition',
    { preHandler: [tenantGuard, requireRoles('LMO', 'GATC_VERIFIER', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId, id } = request.params;
      const finalized = await sessionService.recordDisposition(
        tenantId,
        id,
        request.body,
        request.securityContext
      );
      return reply.send(finalized);
    }
  );
};
