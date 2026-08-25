import { FastifyPluginAsync } from 'fastify';
import { instrumentService } from '../services/instrument.service.js';
import { tenantGuard } from '../security/middleware/tenant.guard.js';

export const instrumentRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /tenants/:tenantId/instruments/models (Register before :id to prevent collision)
  fastify.get<{
    Params: { tenantId: string };
  }>('/tenants/:tenantId/instruments/models', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId } = request.params;
    const models = await instrumentService.listModels(tenantId);
    return reply.send(models);
  });

  // GET /tenants/:tenantId/instruments
  fastify.get<{
    Params: { tenantId: string };
    Querystring: { page?: string; page_size?: string; owner_id?: string };
  }>('/tenants/:tenantId/instruments', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId } = request.params;
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const pageSize = request.query.page_size ? parseInt(request.query.page_size, 10) : 50;

    // If role is OWNER, filter to their ownerId automatically
    let ownerId = request.query.owner_id;
    if (request.securityContext.role === 'OWNER' && !ownerId) {
      ownerId = request.securityContext.userId;
    }

    const result = await instrumentService.listInstruments(tenantId, page, pageSize, ownerId);
    return reply.send(result);
  });

  // GET /tenants/:tenantId/instruments/:id
  fastify.get<{
    Params: { tenantId: string; id: string };
  }>('/tenants/:tenantId/instruments/:id', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId, id } = request.params;
    const instrument = await instrumentService.getInstrumentById(tenantId, id);
    return reply.send(instrument);
  });

  // POST /tenants/:tenantId/instruments
  fastify.post<{
    Params: { tenantId: string };
    Body: {
      jurisdiction_id?: string;
      model_id: string;
      owner_id?: string;
      facility_id?: string;
      serial_number: string;
      year_of_manufacture?: number;
      intended_use?: string;
      installation_location_notes?: string;
    };
  }>('/tenants/:tenantId/instruments', { preHandler: [tenantGuard] }, async (request, reply) => {
    const { tenantId } = request.params;
    const body = request.body;

    const ownerId = body.owner_id || request.securityContext.userId || 'usr-trader-01';
    const facilityId = body.facility_id || 'fac-retail-01';
    const jurisdictionId = body.jurisdiction_id || request.securityContext.jurisdictionId || 'jur-dl-01';

    const registered = await instrumentService.registerInstrument(tenantId, {
      jurisdiction_id: jurisdictionId,
      model_id: body.model_id,
      owner_id: ownerId,
      facility_id: facilityId,
      serial_number: body.serial_number,
      year_of_manufacture: body.year_of_manufacture || new Date().getFullYear(),
      intended_use: body.intended_use,
      installation_location_notes: body.installation_location_notes,
    });

    return reply.status(201).send(registered);
  });
};
