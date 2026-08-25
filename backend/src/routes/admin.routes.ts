import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { adminService } from '../services/admin.service.js';
import { requireAdminGuard } from '../security/middleware/admin.guard.js';

function actorFrom(request: FastifyRequest) {
  return {
    userId: request.securityContext.userId,
    role: request.securityContext.role,
    tenantId: request.securityContext.tenantId,
  };
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // All admin endpoints are guarded to ADMIN role only + every call is audited.
  const adminPre = { preHandler: [requireAdminGuard] };

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

