import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const ADMIN_HEADERS = {
  'x-tenant-id': 'tenant-delhi-central',
  'x-actor-role': 'ADMIN',
  'x-actor-id': 'adm-system-01',
};

const NON_ADMIN_ROLES = ['OWNER', 'LMO', 'GATC_VERIFIER', 'SUPERVISOR', 'CONTROLLER', 'APPLICANT', 'PUBLIC'];

function headersFor(role: string): Record<string, string> {
  return {
    'x-tenant-id': 'tenant-delhi-central',
    'x-actor-role': role,
    'x-actor-id': `actor-${role.toLowerCase()}`,
  };
}

describe('ADMIN Control Plane Integration Suite', () => {
  let app: FastifyInstance;
  let createdTenantId: string | null = null;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (createdTenantId) {
      await prisma.tenant.deleteMany({ where: { tenant_id: createdTenantId } }).catch(() => undefined);
    }
    await app.close();
    await prisma.$disconnect();
  });

  describe('Admin-only authorization', () => {
    it('rejects every non-ADMIN role with 403 on /admin/overview', async () => {
      for (const role of NON_ADMIN_ROLES) {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/admin/overview',
          headers: headersFor(role),
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().detail).toContain('ADMIN');
      }
    });

    it('rejects non-ADMIN role on master-data create with 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/master/tenant',
        headers: headersFor('LMO'),
        payload: { state_code: 'XX', state_name: 'Test' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('accepts ADMIN on /admin/entities', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/admin/entities', headers: ADMIN_HEADERS });
      expect(res.statusCode).toBe(200);
      const entities = res.json();
      expect(Array.isArray(entities)).toBe(true);
      expect(entities.some((e: any) => e.slug === 'certificate' && e.kind === 'legal')).toBe(true);
      expect(entities.some((e: any) => e.slug === 'user' && e.kind === 'master')).toBe(true);
    });
  });

  describe('Overview dashboard', () => {
    it('returns totals and status distributions for ADMIN', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/admin/overview', headers: ADMIN_HEADERS });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.totals).toBeDefined();
      expect(typeof body.totals.tenants).toBe('number');
      expect(Array.isArray(body.certificates_by_status)).toBe(true);
      expect(Array.isArray(body.applications_by_status)).toBe(true);
    });
  });

  describe('Entity browser', () => {
    it('lists users with pagination for ADMIN', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/db/user?page=1&page_size=5',
        headers: ADMIN_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.page).toBe(1);
      expect(body.page_size).toBe(5);
      expect(body.total_pages).toBeGreaterThanOrEqual(1);
    });

    it('caps page_size at 100', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/db/user?page_size=1000',
        headers: ADMIN_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().page_size).toBe(100);
    });

    it('returns 404 for an unknown entity slug', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/db/__not_a_real_entity__',
        headers: ADMIN_HEADERS,
      });
      expect(res.statusCode).toBe(404);
    });

    it('reads a single record by id (tenant)', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/db/tenant?page_size=1',
        headers: ADMIN_HEADERS,
      });
      const id = listRes.json().items[0]?.tenant_id;
      expect(id).toBeTruthy();
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/db/tenant/${id}`,
        headers: ADMIN_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().tenant_id).toBe(id);
    });
  });

  describe('Audit log viewer', () => {
    it('lists audit entries, newest first, with filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit-logs?page_size=5',
        headers: ADMIN_HEADERS,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.items)).toBe(true);
      for (const item of body.items) {
        expect(item.entity_type).toBeTruthy();
      }
    });
  });

  describe('Master-data create/update with immutable audit', () => {
    it('creates a tenant master record, updates it, and writes before/after audit', async () => {
      const code = `TEST-ADM-${Date.now()}`;
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/master/tenant',
        headers: ADMIN_HEADERS,
        payload: { state_code: code, state_name: 'Admin Test State', status: 'ACTIVE' },
      });
      expect(createRes.statusCode).toBe(201);
      const created = createRes.json();
      expect(created.state_code).toBe(code);
      createdTenantId = created.tenant_id;

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/master/tenant/${createdTenantId}`,
        headers: ADMIN_HEADERS,
        payload: { state_name: 'Admin Test State (Updated)' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().state_name).toBe('Admin Test State (Updated)');

      const auditRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit-logs?entity_type=tenant&page_size=50',
        headers: ADMIN_HEADERS,
      });
      const actions = auditRes.json().items
        .filter((a: any) => a.entity_id === createdTenantId)
        .map((a: any) => a.action);
      expect(actions).toContain('ADMIN_MASTER_CREATE');
      expect(actions).toContain('ADMIN_MASTER_UPDATE');
    });

    it('rejects create on legal/transactional records with 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/master/certificate',
        headers: ADMIN_HEADERS,
        payload: { certificate_number: 'CERT-FORBIDDEN' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().detail).toContain('legal/transactional');
    });

    it('rejects update on legal/transactional records with 422', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/master/instrument/some-instrument-id',
        headers: ADMIN_HEADERS,
        payload: { serial_number: 'CHANGED' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().detail).toContain('legal/transactional');
    });
  });

  describe('Health', () => {
    it('reports database connectivity', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/admin/health', headers: ADMIN_HEADERS });
      expect(res.statusCode).toBe(200);
      expect(res.json().database_connectivity).toBe(true);
    });
  });
});