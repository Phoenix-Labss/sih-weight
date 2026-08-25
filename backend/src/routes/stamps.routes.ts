import { FastifyPluginAsync } from 'fastify';
import { stampService } from '../services/stamp.service.js';
import { tenantGuard } from '../security/middleware/tenant.guard.js';
import { requireRoles } from '../security/middleware/rbac.guard.js';

export const stampRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /tenants/:tenantId/sessions/:sessionId/stamps
  fastify.get<{
    Params: { tenantId: string; sessionId: string };
  }>('/tenants/:tenantId/sessions/:sessionId/stamps', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId, sessionId } = request.params;
    const stamps = await stampService.listStampsForSession(tenantId, sessionId);
    return reply.send(stamps);
  });

  // POST /tenants/:tenantId/sessions/:sessionId/stamps
  fastify.post<{
    Params: { tenantId: string; sessionId: string };
    Body: {
      instrument_id?: string;
      action_type?: string;
      seal_type?: string;
      seal_identification_number: string;
      seal_position: string;
      photo_evidence_hash?: string;
      photo_storage_path?: string;
      notes?: string;
    };
  }>(
    '/tenants/:tenantId/sessions/:sessionId/stamps',
    { preHandler: [tenantGuard, requireRoles('LMO', 'SUPERVISOR', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId, sessionId } = request.params;
      const recorded = await stampService.recordStampAction(
        tenantId,
        sessionId,
        request.body,
        request.securityContext
      );
      return reply.status(201).send(recorded);
    }
  );
};
