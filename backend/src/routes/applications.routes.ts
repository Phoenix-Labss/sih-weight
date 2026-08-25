import { FastifyPluginAsync } from 'fastify';
import { applicationService } from '../services/application.service.js';
import { tenantGuard } from '../security/middleware/tenant.guard.js';
import { requireRoles } from '../security/middleware/rbac.guard.js';

export const applicationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /tenants/:tenantId/applications
  fastify.get<{
    Params: { tenantId: string };
    Querystring: { page?: string; page_size?: string; applicant_id?: string };
  }>('/tenants/:tenantId/applications', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId } = request.params;
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const pageSize = request.query.page_size ? parseInt(request.query.page_size, 10) : 50;

    let applicantId = request.query.applicant_id;
    if (request.securityContext.role === 'OWNER' && !applicantId) {
      applicantId = request.securityContext.userId;
    }

    const result = await applicationService.listApplications(tenantId, page, pageSize, applicantId);
    return reply.send(result);
  });

  // GET /tenants/:tenantId/applications/:id
  fastify.get<{
    Params: { tenantId: string; id: string };
  }>('/tenants/:tenantId/applications/:id', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId, id } = request.params;
    const app = await applicationService.getApplicationById(tenantId, id);
    return reply.send(app);
  });

  // POST /tenants/:tenantId/applications
  fastify.post<{
    Params: { tenantId: string };
    Body: {
      instrument_id: string;
      applicant_id?: string;
      application_type?: string;
      service_mode?: string;
      preferred_verification_date?: string;
      applicant_declaration_accepted?: boolean;
    };
  }>('/tenants/:tenantId/applications', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId } = request.params;
    const body = request.body;
    const applicantId = body.applicant_id || request.securityContext.userId || 'usr-trader-01';

    const created = await applicationService.createApplication(
      tenantId,
      {
        instrument_id: body.instrument_id,
        applicant_id: applicantId,
        application_type: body.application_type,
        service_mode: body.service_mode,
        preferred_verification_date: body.preferred_verification_date,
        applicant_declaration_accepted: body.applicant_declaration_accepted,
      },
      request.securityContext
    );

    return reply.status(201).send(created);
  });

  // POST /tenants/:tenantId/applications/:id/submit
  fastify.post<{
    Params: { tenantId: string; id: string };
  }>('/tenants/:tenantId/applications/:id/submit', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId, id } = request.params;
    const submitted = await applicationService.submitApplication(tenantId, id, request.securityContext);
    return reply.send(submitted);
  });

  // POST /tenants/:tenantId/applications/:id/scrutiny
  fastify.post<{
    Params: { tenantId: string; id: string };
    Body: {
      action: 'ACCEPT' | 'QUERY' | 'REJECT';
      notes?: string;
      query_text?: string;
      rejection_reason?: string;
    };
  }>(
    '/tenants/:tenantId/applications/:id/scrutiny',
    { preHandler: [tenantGuard, requireRoles('LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId, id } = request.params;
      const scrutinized = await applicationService.scrutinizeApplication(
        tenantId,
        id,
        request.body,
        request.securityContext
      );
      return reply.send(scrutinized);
    }
  );

  // POST /tenants/:tenantId/applications/:id/correction
  fastify.post<{
    Params: { tenantId: string; id: string };
    Body: {
      correction_notes: string;
    };
  }>('/tenants/:tenantId/applications/:id/correction', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId, id } = request.params;
    const corrected = await applicationService.submitCorrection(
      tenantId,
      id,
      request.body.correction_notes,
      request.securityContext
    );
    return reply.send(corrected);
  });

  // POST /tenants/:tenantId/applications/:id/fee
  fastify.post<{
    Params: { tenantId: string; id: string };
    Body: {
      base_verification_fee: number;
      user_charge?: number;
      late_fee?: number;
      policy_version?: string;
    };
  }>(
    '/tenants/:tenantId/applications/:id/fee',
    { preHandler: [tenantGuard, requireRoles('LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId, id } = request.params;
      const assessed = await applicationService.assessFees(tenantId, id, request.body, request.securityContext);
      return reply.send(assessed);
    }
  );

  // POST /tenants/:tenantId/applications/:id/pay
  fastify.post<{
    Params: { tenantId: string; id: string };
    Body: {
      receipt_number?: string;
      payment_gateway_ref?: string;
    };
  }>('/tenants/:tenantId/applications/:id/pay', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId, id } = request.params;
    const paid = await applicationService.reconcilePayment(tenantId, id, request.body, request.securityContext);
    return reply.send(paid);
  });

  // POST /tenants/:tenantId/applications/:id/schedule
  fastify.post<{
    Params: { tenantId: string; id: string };
    Body: {
      slot_start: string;
      slot_end: string;
      assigned_lmo_id?: string;
      assigned_gatc_id?: string;
    };
  }>(
    '/tenants/:tenantId/applications/:id/schedule',
    { preHandler: [tenantGuard, requireRoles('LMO', 'SUPERVISOR', 'CONTROLLER', 'ADMIN')] },
    async (request, reply) => {
      const { tenantId, id } = request.params;
      const scheduled = await applicationService.scheduleApplication(
        tenantId,
        id,
        request.body,
        request.securityContext
      );
      return reply.send(scheduled);
    }
  );
};
