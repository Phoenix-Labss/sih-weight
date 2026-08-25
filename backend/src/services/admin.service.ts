import { prisma } from '../db/prisma.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import { PaginatedResult } from '../core/types.js';

/**
 * ADMIN CONTROL-PLANE SERVICE
 *
 * Provides a safe, audited read/mutate surface over the Prisma data model for
 * the system administration portal. Two hard rules govern every operation:
 *  1. LEGAL / TRANSACTIONAL records are READ-ONLY here. Any legal lifecycle
 *     change must flow through the existing domain endpoints / state machines.
 *  2. Every sensitive read and every mutation appends an AuditLog row.
 */

export type EntityKind = 'legal' | 'master';

export interface AdminEntityMeta {
  idField: string | null;
  idRequiredForCreate: boolean;
  kind: EntityKind;
  writable: string[];
  tenantField?: string;
  label: string;
}

const ADMIN_ENTITY_REGISTRY: Record<string, AdminEntityMeta> = {
  tenant: {
    idField: 'tenant_id', idRequiredForCreate: false, kind: 'master', label: 'Tenant',
    writable: ['state_code', 'state_name', 'status', 'config'],
  },
  jurisdiction: {
    idField: 'jurisdiction_id', idRequiredForCreate: false, kind: 'master', label: 'Jurisdiction',
    tenantField: 'tenant_id',
    writable: ['tenant_id', 'parent_jurisdiction_id', 'name', 'code', 'level', 'boundary_geo'],
  },
  stakeholder: {
    idField: 'stakeholder_id', idRequiredForCreate: false, kind: 'master', label: 'Stakeholder',
    tenantField: 'tenant_id',
    writable: ['tenant_id', 'jurisdiction_id', 'legal_name', 'trade_name', 'stakeholder_type',
      'identifier_type', 'identifier_value', 'email', 'phone', 'address_line1',
      'address_line2', 'city', 'pincode', 'is_active'],
  },
  facility: {
    idField: 'facility_id', idRequiredForCreate: false, kind: 'master', label: 'Facility',
    tenantField: 'tenant_id',
    writable: ['tenant_id', 'stakeholder_id', 'facility_name', 'address_line', 'district',
      'pincode', 'gps_latitude', 'gps_longitude', 'is_active'],
  },
  user: {
    idField: 'user_id', idRequiredForCreate: false, kind: 'master', label: 'User',
    tenantField: 'tenant_id',
    writable: ['tenant_id', 'stakeholder_id', 'email', 'full_name', 'role', 'is_active'],
  },
  lmoProfile: {
    idField: 'user_id', idRequiredForCreate: true, kind: 'master', label: 'LMO Profile',
    tenantField: 'tenant_id',
    writable: ['user_id', 'tenant_id', 'jurisdiction_id', 'designation', 'posting_order_number',
      'authorized_from', 'authorized_to', 'digital_signature_cert_id', 'is_active'],
  },
  gatcProfile: {
    idField: 'gatc_id', idRequiredForCreate: false, kind: 'master', label: 'GATC Profile',
    tenantField: 'tenant_id',
    writable: ['tenant_id', 'facility_id', 'approval_order_number', 'approved_scope',
      'valid_from', 'valid_to', 'status'],
  },
  instrumentModel: {
    idField: 'model_id', idRequiredForCreate: false, kind: 'master', label: 'Instrument Model',
    writable: ['category', 'subtype', 'manufacturer_name', 'model_name', 'model_approval_number',
      'accuracy_class', 'verification_scale_interval_e', 'scale_interval_unit',
      'min_capacity', 'max_capacity', 'capacity_unit', 'number_of_intervals_n',
      'specifications', 'is_active'],
  },
  instrument: {
    idField: 'instrument_id', idRequiredForCreate: false, kind: 'legal', label: 'Instrument',
    tenantField: 'tenant_id', writable: [],
  },
  feeAssessment: {
    idField: 'fee_assessment_id', idRequiredForCreate: false, kind: 'legal', label: 'Fee Assessment',
    tenantField: 'tenant_id', writable: [],
  },
  application: {
    idField: 'application_id', idRequiredForCreate: false, kind: 'legal', label: 'Verification Application',
    tenantField: 'tenant_id', writable: [],
  },
  referenceStandard: {
    idField: 'standard_id', idRequiredForCreate: true, kind: 'master', label: 'Reference Standard',
    tenantField: 'tenant_id',
    writable: ['standard_id', 'tenant_id', 'custodian_type', 'custodian_id', 'asset_tag',
      'denomination_mass', 'mass_unit', 'accuracy_class', 'serial_number',
      'calibration_certificate_number', 'calibrating_laboratory', 'calibrated_at',
      'valid_until', 'expanded_uncertainty', 'calibration_status'],
  },
  session: {
    idField: 'session_id', idRequiredForCreate: false, kind: 'legal', label: 'Verification Session',
    tenantField: 'tenant_id', writable: [],
  },
  sessionReferenceStandard: {
    idField: null, idRequiredForCreate: false, kind: 'legal', label: 'Session Reference Standard',
    writable: [],
  },
  observation: {
    idField: 'observation_id', idRequiredForCreate: false, kind: 'legal', label: 'Test Observation',
    writable: [],
  },
  stampAction: {
    idField: 'stamp_action_id', idRequiredForCreate: false, kind: 'legal', label: 'Physical Stamp Action',
    tenantField: 'tenant_id', writable: [],
  },
  certificate: {
    idField: 'certificate_id', idRequiredForCreate: false, kind: 'legal', label: 'Certificate',
    tenantField: 'tenant_id', writable: [],
  },
  certificateStatusEvent: {
    idField: 'status_event_id', idRequiredForCreate: false, kind: 'legal', label: 'Certificate Status Event',
    writable: [],
  },
  auditLog: {
    idField: 'audit_id', idRequiredForCreate: false, kind: 'legal', label: 'Audit Log',
    tenantField: 'tenant_id', writable: [],
  },
  delegation: {
    idField: 'delegation_id', idRequiredForCreate: false, kind: 'master', label: 'Delegation',
    tenantField: 'tenant_id',
    writable: ['tenant_id', 'granter_user_id', 'delegatee_user_id', 'jurisdiction_id',
      'valid_from', 'valid_to', 'is_active'],
  },
  procedurePack: {
    idField: 'pack_id', idRequiredForCreate: true, kind: 'master', label: 'Procedure Pack',
    writable: ['pack_id', 'version', 'legal_source_id', 'checksum_sha256', 'name',
      'accuracy_class_scope', 'status', 'effective_from', 'effective_until', 'schema_definition'],
  },
  legalSourceRecord: {
    idField: 'legal_source_id', idRequiredForCreate: true, kind: 'master', label: 'Legal Source Record',
    writable: ['legal_source_id', 'act_name', 'section_rule', 'title', 'effective_date',
      'checksum_sha256', 'source_document_url'],
  },
};

/** Maps a portal entity slug to its Prisma model delegate name. */
const PRISMA_DELEGATE: Record<string, string> = {
  tenant: 'tenant', jurisdiction: 'jurisdiction', stakeholder: 'stakeholder', facility: 'facility',
  user: 'user', lmoProfile: 'lmoProfile', gatcProfile: 'gatcProfile', instrumentModel: 'instrumentModel',
  instrument: 'instrument', feeAssessment: 'feeAssessment', application: 'verificationApplication',
  referenceStandard: 'referenceStandard', session: 'verificationSession',
  sessionReferenceStandard: 'sessionReferenceStandard', observation: 'testObservation',
  stampAction: 'physicalStampAction', certificate: 'certificate',
  certificateStatusEvent: 'certificateStatusEvent', auditLog: 'auditLog', delegation: 'delegation',
  procedurePack: 'procedurePack', legalSourceRecord: 'legalSourceRecord',
};

function entityMeta(entity: string): AdminEntityMeta {
  const meta = ADMIN_ENTITY_REGISTRY[entity];
  if (!meta) {
    throw new NotFoundError(`Unknown admin entity '${entity}'. See /admin/entities for the whitelist`);
  }
  return meta;
}

function getPrismaModel(delegate: string): any {
  const model = (prisma as unknown as Record<string, any>)[delegate];
  if (!model) {
    throw new Error(`Database model '${delegate}' is not available on the Prisma client`);
  }
  return model;
}

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    if (typeof (value as any).toNumber === 'function') return (value as any).toString();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitize(v);
    return out;
  }
  return value;
}

export interface AdminActor { userId: string; role: string; tenantId: string; }

async function writeAudit(
  actor: AdminActor,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeState?: unknown,
  afterState?: unknown
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenant_id: actor.tenantId,
      actor_id: actor.userId,
      actor_role: actor.role,
      action,
      entity_type: entityType,
      entity_id: entityId || '',
      correlation_id: crypto.randomUUID(),
      before_state: beforeState !== undefined ? JSON.stringify(sanitize(beforeState)) : null,
      after_state: afterState !== undefined ? JSON.stringify(sanitize(afterState)) : null,
      recorded_at: new Date(),
    },
  });
}

export class AdminService {
  async listEntities(): Promise<Array<{ slug: string } & AdminEntityMeta>> {
    return Object.entries(ADMIN_ENTITY_REGISTRY).map(([slug, meta]) => ({ slug, ...meta }));
  }

  async browse(
    actor: AdminActor,
    entity: string,
    page = 1,
    pageSize = 50,
    searchId?: string
  ): Promise<PaginatedResult<any>> {
    const meta = entityMeta(entity);
    const model = getPrismaModel(PRISMA_DELEGATE[entity]);
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const skip = (safePage - 1) * safeSize;

    const where: Record<string, unknown> = {};
    if (meta.tenantField && actor.role !== 'ADMIN') where[meta.tenantField] = actor.tenantId;
    if (searchId && meta.idField) where[meta.idField] = searchId;

    const [total, raw] = await Promise.all([
      model.count({ where }),
      // The only entity with a composite/id-less lens (sessionReferenceStandard)
      // sorts by its session key; all others use their primary key.
      model.findMany({ where, skip, take: safeSize, orderBy: { [meta.idField || 'session_id']: 'desc' } }),
    ]);

    await writeAudit(actor, 'ADMIN_ENTITY_BROWSE', entity, searchId || null, null, {
      page: safePage, page_size: safeSize, total,
    });

    return {
      items: sanitize(raw) as any[],
      total,
      page: safePage,
      page_size: safeSize,
      total_pages: Math.max(1, Math.ceil(total / safeSize)),
    };
  }

  async getRecord(actor: AdminActor, entity: string, id: string): Promise<any> {
    const meta = entityMeta(entity);
    if (!meta.idField) {
      throw new NotFoundError(`Entity '${entity}' has no single primary key to look up`);
    }
    const model = getPrismaModel(PRISMA_DELEGATE[entity]);
    const where: Record<string, unknown> = { [meta.idField]: id };
    if (meta.tenantField && actor.role !== 'ADMIN') where[meta.tenantField] = actor.tenantId;
    const record = await model.findUnique({ where });
    if (!record) throw new NotFoundError(`${meta.label} '${id}' not found`);
    await writeAudit(actor, 'ADMIN_ENTITY_READ', entity, id);
    return sanitize(record);
  }

  async createMaster(actor: AdminActor, entity: string, payload: Record<string, unknown>): Promise<any> {
    const meta = entityMeta(entity);
    if (meta.kind !== 'master') {
      throw new ValidationError(
        `Entity '${entity}' is a legal/transactional record and cannot be created through the admin console`
      );
    }
    const model = getPrismaModel(PRISMA_DELEGATE[entity]);
    const data: Record<string, unknown> = {};
    for (const key of meta.writable) if (payload[key] !== undefined) data[key] = payload[key];
    if (meta.idRequiredForCreate && meta.idField && !data[meta.idField]) {
      throw new ValidationError(`Entity '${entity}' requires '${meta.idField}' to be provided`);
    }
    if (meta.tenantField && actor.role !== 'ADMIN' && !data[meta.tenantField]) {
      data[meta.tenantField] = actor.tenantId;
    }
    const created = await model.create({ data });
    await writeAudit(actor, 'ADMIN_MASTER_CREATE', entity, (created as any)[meta.idField as string], null, created);
    return sanitize(created);
  }

  async updateMaster(
    actor: AdminActor,
    entity: string,
    id: string,
    payload: Record<string, unknown>
  ): Promise<any> {
    const meta = entityMeta(entity);
    if (meta.kind !== 'master') {
      throw new ValidationError(
        `Entity '${entity}' is a legal/transactional record and cannot be mutated through the admin console`
      );
    }
    if (!meta.idField) throw new NotFoundError(`Entity '${entity}' has no primary key to update`);
    const model = getPrismaModel(PRISMA_DELEGATE[entity]);
    const where: Record<string, unknown> = { [meta.idField]: id };
    if (meta.tenantField && actor.role !== 'ADMIN') where[meta.tenantField] = actor.tenantId;
    const before = await model.findUnique({ where });
    if (!before) throw new NotFoundError(`${meta.label} '${id}' not found`);

    const data: Record<string, unknown> = {};
    for (const key of meta.writable) if (payload[key] !== undefined) data[key] = payload[key];
    if (Object.keys(data).length === 0) throw new ValidationError('No writable fields provided for update');

    const updated = await model.update({ where, data });
    await writeAudit(actor, 'ADMIN_MASTER_UPDATE', entity, id, before, updated);
    return sanitize(updated);
  }

  async listAuditLogs(
    actor: AdminActor,
    o: {
      page?: number; pageSize?: number; actorId?: string; entityType?: string;
      action?: string; from?: string; to?: string; correlationId?: string;
    }
  ): Promise<PaginatedResult<any>> {
    const safePage = Math.max(1, o.page || 1);
    const safeSize = Math.min(100, Math.max(1, o.pageSize || 50));
    const where: Record<string, unknown> = {};
    if (o.actorId) where.actor_id = o.actorId;
    if (o.entityType) where.entity_type = o.entityType;
    if (o.action) where.action = o.action;
    if (o.correlationId) where.correlation_id = o.correlationId;
    if (o.from || o.to) {
      const recordedAt: Record<string, unknown> = {};
      if (o.from) recordedAt.gte = new Date(o.from);
      if (o.to) recordedAt.lte = new Date(o.to);
      where.recorded_at = recordedAt;
    }
    const [total, raw] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where, skip: (safePage - 1) * safeSize, take: safeSize, orderBy: { recorded_at: 'desc' },
      }),
    ]);
    return {
      items: sanitize(raw) as any[],
      total, page: safePage, page_size: safeSize,
      total_pages: Math.max(1, Math.ceil(total / safeSize)),
    };
  }

  async overview(actor: AdminActor): Promise<Record<string, unknown>> {
    const whereTenant = actor.role === 'ADMIN' ? {} : { tenant_id: actor.tenantId };

    const [
      tenantCount, jurisdictionCount, stakeholderCount, facilityCount, userCount, instrumentModelCount,
      instrumentCount, applicationCount, sessionCount, certificateCount, standardCount,
      observationCount, stampCount, feeCount, auditCount, delegationCount,
      procedureCount, legalSourceCount,
      appByStatus, certByStatus, sessionByStatus, standardByStatus, instrumentByStatus, paymentByStatus,
    ] = await Promise.all([
      prisma.tenant.count(), prisma.jurisdiction.count({ where: whereTenant }),
      prisma.stakeholder.count({ where: whereTenant }), prisma.facility.count({ where: whereTenant }),
      prisma.user.count({ where: whereTenant }), prisma.instrumentModel.count(),
      prisma.instrument.count({ where: whereTenant }),
      prisma.verificationApplication.count({ where: whereTenant }),
      prisma.verificationSession.count({ where: whereTenant }),
      prisma.certificate.count({ where: whereTenant }),
      prisma.referenceStandard.count({ where: whereTenant }),
      prisma.testObservation.count(), prisma.physicalStampAction.count({ where: whereTenant }),
      prisma.feeAssessment.count({ where: whereTenant }), prisma.auditLog.count(),
      prisma.delegation.count({ where: whereTenant }), prisma.procedurePack.count(),
      prisma.legalSourceRecord.count(),
      prisma.verificationApplication.groupBy({ by: ['current_status'], _count: { _all: true }, where: whereTenant }),
      prisma.certificate.groupBy({ by: ['certificate_status'], _count: { _all: true }, where: whereTenant }),
      prisma.verificationSession.groupBy({ by: ['status'], _count: { _all: true }, where: whereTenant }),
      prisma.referenceStandard.groupBy({ by: ['calibration_status'], _count: { _all: true }, where: whereTenant }),
      prisma.instrument.groupBy({ by: ['current_status'], _count: { _all: true }, where: whereTenant }),
      prisma.feeAssessment.groupBy({ by: ['payment_status'], _count: { _all: true }, where: whereTenant }),
    ]);

    await writeAudit(actor, 'ADMIN_OVERVIEW', 'dashboard', null);

    return {
      generated_at: new Date().toISOString(),
      totals: {
        tenants: tenantCount, jurisdictions: jurisdictionCount, stakeholders: stakeholderCount,
        facilities: facilityCount, users: userCount, instrument_models: instrumentModelCount,
        instruments: instrumentCount, applications: applicationCount, sessions: sessionCount,
        certificates: certificateCount, reference_standards: standardCount,
        procedure_packs: procedureCount, legal_sources: legalSourceCount,
        test_observations: observationCount, stamp_actions: stampCount,
        fee_assessments: feeCount, audit_logs: auditCount, delegations: delegationCount,
      },
      applications_by_status: appByStatus.map((r) => ({ status: r.current_status, count: r._count._all })),
      certificates_by_status: certByStatus.map((r) => ({ status: r.certificate_status, count: r._count._all })),
      sessions_by_status: sessionByStatus.map((r) => ({ status: r.status, count: r._count._all })),
      standards_by_status: standardByStatus.map((r) => ({ status: r.calibration_status, count: r._count._all })),
      instruments_by_status: instrumentByStatus.map((r) => ({ status: r.current_status, count: r._count._all })),
      payments_by_status: paymentByStatus.map((r) => ({ status: r.payment_status, count: r._count._all })),
    };
  }
}

export const adminService = new AdminService();