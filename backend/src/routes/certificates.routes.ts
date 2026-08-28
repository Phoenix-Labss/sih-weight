import { FastifyPluginAsync } from 'fastify';
import { certificateService } from '../services/certificate.service.js';
import { tenantGuard } from '../security/middleware/tenant.guard.js';
import { requireRoles } from '../security/middleware/rbac.guard.js';

export const certificateRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /tenants/:tenantId/certificates
  fastify.get<{
    Params: { tenantId: string };
    Querystring: { page?: string; page_size?: string; owner_id?: string };
  }>('/tenants/:tenantId/certificates', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId } = request.params;
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const pageSize = request.query.page_size ? parseInt(request.query.page_size, 10) : 50;

    let ownerId = request.query.owner_id;
    if (request.securityContext.role === 'OWNER' && !ownerId) {
      ownerId = request.securityContext.userId;
    }

    const result = await certificateService.listCertificates(tenantId, page, pageSize, ownerId);
    return reply.send(result);
  });

  // GET /tenants/:tenantId/certificates/:id
  fastify.get<{
    Params: { tenantId: string; id: string };
  }>('/tenants/:tenantId/certificates/:id', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId, id } = request.params;
    const cert = await certificateService.getCertificateById(tenantId, id);
    return reply.send(cert);
  });

  // POST /tenants/:tenantId/certificates/issue
  fastify.post<{
    Params: { tenantId: string };
    Body: {
      session_id: string;
      validity_months?: number;
      signer_notes?: string;
    };
  }>(
    '/tenants/:tenantId/certificates/issue',
    { preHandler: [tenantGuard, requireRoles('LMO', 'GATC_VERIFIER', 'SUPERVISOR', 'CONTROLLER', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId } = request.params;
      const issued = await certificateService.issueCertificate(
        tenantId,
        request.body,
        request.securityContext
      );
      return reply.status(201).send(issued);
    }
  );

  // POST /tenants/:tenantId/certificates/:id/status
  fastify.post<{
    Params: { tenantId: string; id: string };
    Body: {
      action: 'SUSPEND' | 'REINSTATE' | 'REVOKE' | 'SUPERSEDE' | 'EXPIRE';
      reason: string;
      statutory_authority_reference?: string;
      superseding_certificate_id?: string;
    };
  }>(
    '/tenants/:tenantId/certificates/:id/status',
    { preHandler: [tenantGuard, requireRoles('LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId, id } = request.params;
      const updated = await certificateService.updateCertificateStatus(
        tenantId,
        id,
        request.body,
        request.securityContext
      );
      return reply.send(updated);
    }
  );

  // GET /tenants/:tenantId/certificates/:id/pdf
  fastify.get<{
    Params: { tenantId: string; id: string };
  }>('/tenants/:tenantId/certificates/:id/pdf', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId, id } = request.params;
    const { buffer, filename } = await certificateService.getCertificatePdfBytes(tenantId, id);

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  });

  // GET /certificates/:id/pdf (Direct tenant-agnostic alias)
  fastify.get<{
    Params: { id: string };
  }>('/certificates/:id/pdf', async (request, reply) => {
    const tenantId = request.securityContext?.tenantId || 'tenant-delhi-central';
    const { id } = request.params;
    const { buffer, filename } = await certificateService.getCertificatePdfBytes(tenantId, id);

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  });
};
