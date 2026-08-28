import { FastifyPluginAsync } from 'fastify';
import { evidenceService, EvidenceVerificationInput } from '../services/evidence.service.js';
import { tenantGuard } from '../security/middleware/tenant.guard.js';
import { requireRoles } from '../security/middleware/rbac.guard.js';

export const evidenceRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /tenants/:tenantId/evidence/verify-and-ingest
  fastify.post<{
    Params: { tenantId: string };
    Body: EvidenceVerificationInput;
  }>(
    '/tenants/:tenantId/evidence/verify-and-ingest',
    { preHandler: [tenantGuard, requireRoles('LMO', 'SUPERVISOR', 'ADMIN', 'GATC_VERIFIER')] },
    async (request, reply) => {
      const { tenantId } = request.params;
      const result = await evidenceService.verifyAndIngestEvidence(
        tenantId,
        request.body,
        request.securityContext
      );
      return reply.status(201).send(result);
    }
  );

  // GET /tenants/:tenantId/evidence/:evidenceId
  fastify.get<{
    Params: { tenantId: string; evidenceId: string };
  }>(
    '/tenants/:tenantId/evidence/:evidenceId',
    { preHandler: [tenantGuard] },
    async (request, reply) => {
      const { tenantId, evidenceId } = request.params;
      const record = await evidenceService.getEvidenceRecord(tenantId, evidenceId);
      return reply.send(record);
    }
  );
};
