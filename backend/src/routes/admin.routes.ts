import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { adminService } from '../services/admin.service.js';
import { requireAdminGuard, requireGovernanceGuard } from '../security/middleware/admin.guard.js';

function actorFrom(request: FastifyRequest) {
  return {
    userId: request.securityContext.userId,
    role: request.securityContext.role,
    tenantId: request.securityContext.tenantId,
    userName: (request.securityContext as any).userName || request.securityContext.userId,
  };
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const adminPre = { preHandler: [requireAdminGuard] };
  const govPre = { preHandler: [requireGovernanceGuard] };

  // GET /api/v1/admin/entities
  fastify.get('/admin/entities', adminPre, async (_request, reply) => {
    return reply.send(await adminService.listEntities());
  });

  // GET /api/v1/admin/overview
  fastify.get('/admin/overview', adminPre, async (request, reply) => {
    return reply.send(await adminService.overview(actorFrom(request)));
  });

  // GET /api/v1/admin/health
  fastify.get('/admin/health', adminPre, async (request, reply) => {
    const { prisma } = await import('../db/prisma.js');
    let dbOk = true;
    let errorMessage: string | undefined;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      dbOk = false;
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    return reply.send({
      status: dbOk ? 'HEALTHY' : 'DEGRADED',
      database_connectivity: dbOk,
      database_error: errorMessage,
      checked_at: new Date().toISOString(),
    });
  });

  // --- GOVERNANCE & ONBOARDING ENDPOINTS ---

  // GET /api/v1/admin/jurisdictions
  fastify.get('/admin/jurisdictions', govPre, async (request, reply) => {
    const actor = actorFrom(request);
    return reply.send(await adminService.listJurisdictions(actor.tenantId));
  });

  // GET /api/v1/admin/users
  fastify.get('/admin/users', govPre, async (request, reply) => {
    const actor = actorFrom(request);
    return reply.send(await adminService.listUsers(actor.tenantId));
  });

  // GET /api/v1/admin/gatc
  fastify.get('/admin/gatc', govPre, async (request, reply) => {
    const actor = actorFrom(request);
    return reply.send(await adminService.listGATCCentres(actor.tenantId));
  });

  // POST /api/v1/admin/users/provision
  fastify.post<{
    Body: {
      tenant_id?: string;
      full_name: string;
      email: string;
      role: 'LMO' | 'GATC_VERIFIER' | 'SUPERVISOR' | 'CONTROLLER' | 'ADMIN' | 'AUDITOR';
      password?: string;
      jurisdiction_id?: string;
      designation?: string;
      posting_order_number?: string;
      digital_signature_cert_id?: string;
      stakeholder_id?: string;
    };
  }>('/admin/users/provision', govPre, async (request, reply) => {
    const created = await adminService.provisionUser(actorFrom(request), request.body);
    return reply.status(201).send(created);
  });

  // POST /api/v1/admin/gatc/register
  fastify.post<{
    Body: {
      tenant_id?: string;
      facility_name: string;
      approval_order_number: string;
      jurisdiction_id?: string;
      address_line: string;
      district: string;
      pincode: string;
      max_capacity_kg: number;
      approved_classes: string[];
      valid_from?: string;
      valid_to?: string;
    };
  }>('/admin/gatc/register', govPre, async (request, reply) => {
    const created = await adminService.registerGATC(actorFrom(request), request.body);
    return reply.status(201).send(created);
  });

  // POST /api/v1/admin/models/register
  fastify.post<{
    Body: {
      category: string;
      subtype: string;
      manufacturer_name: string;
      model_name: string;
      model_approval_number: string;
      accuracy_class: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII';
      min_capacity: number | string;
      max_capacity: number | string;
      capacity_unit: string;
      verification_scale_interval_e: number | string;
      scale_interval_unit: string;
      specifications?: Record<string, unknown>;
    };
  }>('/admin/models/register', govPre, async (request, reply) => {
    const created = await adminService.registerModelApproval(actorFrom(request), request.body);
    return reply.status(201).send(created);
  });

  // POST /api/v1/admin/approvals/submit
  fastify.post<{
    Body: {
      tenant_id?: string;
      entity_type: 'USER_PROVISION' | 'GATC_REGISTRATION' | 'MODEL_APPROVAL' | 'STANDARD_REGISTER';
      title: string;
      payload: Record<string, unknown>;
    };
  }>('/admin/approvals/submit', govPre, async (request, reply) => {
    const created = await adminService.createApprovalRequest(actorFrom(request), request.body);
    return reply.status(201).send(created);
  });

  // GET /api/v1/admin/approvals
  fastify.get<{ Querystring: { status?: string } }>('/admin/approvals', govPre, async (request, reply) => {
    return reply.send(await adminService.listApprovals(request.query.status));
  });

  // POST /api/v1/admin/approvals/:id/review
  fastify.post<{
    Params: { id: string };
    Body: { action: 'APPROVE' | 'REJECT'; notes?: string };
  }>('/admin/approvals/:id/review', govPre, async (request, reply) => {
    const result = await adminService.reviewApproval(
      actorFrom(request),
      request.params.id,
      request.body.action,
      request.body.notes
    );
    return reply.send(result);
  });

  // --- ENTITY BROWSER & AUDIT LOGS (ADMIN ONLY) ---

  // GET /api/v1/admin/db/:table
  fastify.get<{
    Params: { table: string };
    Querystring: { page?: string; page_size?: string; id?: string };
  }>('/admin/db/:table', adminPre, async (request, reply) => {
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const pageSize = request.query.page_size ? parseInt(request.query.page_size, 10) : 50;
    const result = await adminService.browse(actorFrom(request), request.params.table, page, pageSize, request.query.id);
    return reply.send(result);
  });

  // GET /api/v1/admin/db/:table/:id
  fastify.get<{ Params: { table: string; id: string } }>(
    '/admin/db/:table/:id',
    adminPre,
    async (request, reply) => {
      return reply.send(await adminService.getRecord(actorFrom(request), request.params.table, request.params.id));
    }
  );

  // GET /api/v1/admin/audit-logs
  fastify.get<{
    Querystring: {
      page?: string; page_size?: string; actor_id?: string; action?: string;
      entity_type?: string; correlation_id?: string; from?: string; to?: string;
    };
  }>('/admin/audit-logs', adminPre, async (request, reply) => {
    const q = request.query;
    const result = await adminService.listAuditLogs(actorFrom(request), {
      page: q.page ? parseInt(q.page, 10) : 1,
      pageSize: q.page_size ? parseInt(q.page_size, 10) : 50,
      actorId: q.actor_id,
      action: q.action,
      entityType: q.entity_type,
      correlationId: q.correlation_id,
      from: q.from,
      to: q.to,
    });
    return reply.send(result);
  });

  // POST /api/v1/admin/master/:table
  fastify.post<{ Params: { table: string }; Body: Record<string, unknown> }>(
    '/admin/master/:table',
    adminPre,
    async (request, reply) => {
      const created = await adminService.createMaster(actorFrom(request), request.params.table, request.body || {});
      return reply.status(201).send(created);
    }
  );

  // PUT /api/v1/admin/master/:table/:id
  fastify.put<{ Params: { table: string; id: string }; Body: Record<string, unknown> }>(
    '/admin/master/:table/:id',
    adminPre,
    async (request, reply) => {
      const updated = await adminService.updateMaster(
        actorFrom(request),
        request.params.table,
        request.params.id,
        request.body || {}
      );
      return reply.send(updated);
    }
  );
};
