import { prisma } from '../db/prisma.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import { PaginatedResult } from '../core/types.js';
import { hashPassword } from '../auth/password.js';

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
  testObservation: {
    idField: 'observation_id', idRequiredForCreate: false, kind: 'legal', label: 'Test Observation',
    writable: [],
  },
  physicalStampAction: {
    idField: 'action_id', idRequiredForCreate: false, kind: 'legal', label: 'Physical Stamp Action',
    tenantField: 'tenant_id', writable: [],
  },
  certificate: {
    idField: 'certificate_id', idRequiredForCreate: false, kind: 'legal', label: 'Certificate',
    tenantField: 'tenant_id', writable: [],
  },
  certificateStatusEvent: {
    idField: 'event_id', idRequiredForCreate: false, kind: 'legal', label: 'Certificate Status Event',
    writable: [],
  },
  evidenceRecord: {
    idField: 'evidence_id', idRequiredForCreate: false, kind: 'legal', label: 'Evidence Record',
    tenantField: 'tenant_id', writable: [],
  },
  delegation: {
    idField: 'delegation_id', idRequiredForCreate: false, kind: 'master', label: 'Delegation',
    tenantField: 'tenant_id',
    writable: ['tenant_id', 'delegator_user_id', 'delegate_user_id', 'scope_rules',
      'starts_at', 'expires_at', 'revoked_at', 'revocation_reason'],
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
  approvalRequest: {
    idField: 'request_id', idRequiredForCreate: false, kind: 'master', label: 'Approval Request',
    tenantField: 'tenant_id',
    writable: ['tenant_id', 'entity_type', 'title', 'payload', 'status', 'requester_id', 'requester_name',
      'reviewer_id', 'reviewer_name', 'review_notes', 'reviewed_at'],
  },
};

export interface AdminActor {
  userId: string;
  role: string;
  tenantId: string;
  userName?: string;
}

async function writeAudit(
  actor: AdminActor,
  action: string,
  entityType: string,
  entityId: string | null,
  diff?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor_id: actor.userId,
        actor_role: actor.role,
        tenant_id: actor.tenantId,
        action,
        entity_type: entityType,
        entity_id: entityId || 'N/A',
        correlation_id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        after_state: diff ? JSON.stringify(diff) : null,
      },
    });
  } catch (err) {
    console.error('Failed to write admin audit log:', err);
  }
}

export class AdminService {
  listEntities(): Array<AdminEntityMeta & { slug: string }> {
    return Object.entries(ADMIN_ENTITY_REGISTRY).map(([slug, meta]) => ({
      slug,
      ...meta,
    }));
  }

  private delegate(table: string): any {
    const d = (prisma as any)[table];
    if (!d) {
      throw new NotFoundError(`Unknown entity table '${table}'`);
    }
    return d;
  }

  async browse(
    actor: AdminActor,
    table: string,
    page = 1,
    pageSize = 50,
    searchId?: string
  ): Promise<any> {
    const meta = ADMIN_ENTITY_REGISTRY[table];
    if (!meta) {
      throw new NotFoundError(`Unknown entity table '${table}'`);
    }

    const del = this.delegate(table);
    const where: Record<string, unknown> = {};

    if (searchId && meta.idField) {
      where[meta.idField] = searchId;
    }

    const safePageSize = Math.min(Math.max(pageSize || 50, 1), 100);
    const skip = (page - 1) * safePageSize;
    const [total, items] = await Promise.all([
      del.count({ where }),
      del.findMany({ where, skip, take: safePageSize }),
    ]);

    await writeAudit(actor, 'ADMIN_BROWSE', table, null, { page, pageSize: safePageSize, searchId, count: items.length });

    const totalPages = Math.ceil(total / safePageSize) || 1;
    return {
      items,
      total,
      page,
      page_size: safePageSize,
      pageSize: safePageSize,
      total_pages: totalPages,
      totalPages,
    };
  }

  async getRecord(actor: AdminActor, table: string, id: string): Promise<any> {
    const meta = ADMIN_ENTITY_REGISTRY[table];
    if (!meta || !meta.idField) {
      throw new NotFoundError(`Entity table '${table}' cannot be queried by single id`);
    }

    const del = this.delegate(table);
    const record = await del.findUnique({
      where: { [meta.idField]: id },
    });

    if (!record) {
      throw new NotFoundError(`${meta.label} with id '${id}' was not found`);
    }

    await writeAudit(actor, 'ADMIN_GET_RECORD', table, id);
    return record;
  }

  async createMaster(actor: AdminActor, table: string, input: Record<string, unknown>): Promise<any> {
    const meta = ADMIN_ENTITY_REGISTRY[table];
    if (!meta) {
      throw new NotFoundError(`Unknown entity table '${table}'`);
    }
    if (meta.kind !== 'master') {
      throw new ValidationError(
        `Entity '${table}' is a legal/transactional record and cannot be created via admin master mutation.`
      );
    }

    const data: Record<string, unknown> = {};
    for (const key of meta.writable) {
      if (input[key] !== undefined) {
        data[key] = input[key];
      }
    }

    if (meta.tenantField && !data[meta.tenantField] && actor.tenantId) {
      data[meta.tenantField] = actor.tenantId;
    }

    const del = this.delegate(table);
    const created = await del.create({ data });
    const newId = meta.idField ? (created as any)[meta.idField] : null;

    await writeAudit(actor, 'ADMIN_MASTER_CREATE', table, newId, { created: data });
    return created;
  }

  async updateMaster(
    actor: AdminActor,
    table: string,
    id: string,
    input: Record<string, unknown>
  ): Promise<any> {
    const meta = ADMIN_ENTITY_REGISTRY[table];
    if (!meta || !meta.idField) {
      throw new NotFoundError(`Entity table '${table}' cannot be updated by single id`);
    }
    if (meta.kind !== 'master') {
      throw new ValidationError(
        `Entity '${table}' is a legal/transactional record and cannot be updated via admin master mutation.`
      );
    }

    const del = this.delegate(table);
    const existing = await del.findUnique({ where: { [meta.idField]: id } });
    if (!existing) {
      throw new NotFoundError(`${meta.label} with id '${id}' was not found`);
    }

    const data: Record<string, unknown> = {};
    for (const key of meta.writable) {
      if (input[key] !== undefined) {
        data[key] = input[key];
      }
    }

    const updated = await del.update({
      where: { [meta.idField]: id },
      data,
    });

    await writeAudit(actor, 'ADMIN_MASTER_UPDATE', table, id, {
      before: existing,
      after: data,
    });

    return updated;
  }

  // --- GOVERNMENT PERSONNEL PROVISIONING ---
  async provisionUser(actor: AdminActor, payload: {
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
  }) {
    if (!payload.email || !payload.full_name || !payload.role) {
      throw new ValidationError('Full name, email, and role are required for provisioning.');
    }
    const tenantId = payload.tenant_id || actor.tenantId || 'tenant-delhi-central';
    const pwd = payload.password || 'GovSecure@2026';
    const password_hash = hashPassword(pwd);

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email: payload.email.toLowerCase().trim() } });
    if (existing) {
      throw new ValidationError(`User with email '${payload.email}' already exists.`);
    }

    const user = await prisma.user.create({
      data: {
        tenant_id: tenantId,
        full_name: payload.full_name,
        email: payload.email.toLowerCase().trim(),
        role: payload.role as any,
        password_hash,
        stakeholder_id: payload.stakeholder_id || null,
        is_active: true,
      },
    });

    if (payload.role === 'LMO' || payload.role === 'SUPERVISOR' || payload.role === 'CONTROLLER') {
      const jurId = payload.jurisdiction_id || 'jur-dl-01';
      await prisma.lMOProfile.create({
        data: {
          user_id: user.user_id,
          tenant_id: tenantId,
          jurisdiction_id: jurId,
          designation: payload.designation || (
            payload.role === 'LMO'
              ? 'Legal Metrology Officer (Inspector)'
              : payload.role === 'SUPERVISOR'
              ? 'Senior Metrology Supervisor'
              : 'Controller of Legal Metrology'
          ),
          posting_order_number: payload.posting_order_number || `GOV-ORD-${Date.now().toString().slice(-6)}`,
          authorized_from: new Date(),
          digital_signature_cert_id: payload.digital_signature_cert_id || `HSM-DL-${user.user_id.slice(0, 4).toUpperCase()}`,
          is_active: true,
        },
      });
    }

    await writeAudit(actor, 'ADMIN_PROVISION_USER', 'user', user.user_id, {
      role: payload.role,
      email: payload.email,
      jurisdiction_id: payload.jurisdiction_id,
      hsm_key_slot: payload.digital_signature_cert_id,
    });

    return user;
  }

  // --- GATC ACCREDITED TEST CENTRE REGISTRATION ---
  async registerGATC(actor: AdminActor, payload: {
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
  }) {
    if (!payload.facility_name || !payload.approval_order_number) {
      throw new ValidationError('Facility name and statutory approval order number are required.');
    }
    const tenantId = payload.tenant_id || actor.tenantId || 'tenant-delhi-central';
    const jurId = payload.jurisdiction_id || 'jur-dl-01';

    // 1. Create or find Stakeholder for GATC Lab
    const stakeholder = await prisma.stakeholder.create({
      data: {
        tenant_id: tenantId,
        jurisdiction_id: jurId,
        legal_name: payload.facility_name,
        trade_name: `${payload.facility_name} (Accredited Test Centre)`,
        stakeholder_type: 'MANUFACTURER',
        email: `contact@${payload.facility_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.gov.in`,
        phone: '+91-11-23389000',
        address_line1: payload.address_line,
        city: payload.district,
        pincode: payload.pincode,
        is_active: true,
      },
    });

    // 2. Create Facility
    const facility = await prisma.facility.create({
      data: {
        tenant_id: tenantId,
        stakeholder_id: stakeholder.stakeholder_id,
        facility_name: payload.facility_name,
        address_line: payload.address_line,
        district: payload.district,
        pincode: payload.pincode,
        is_active: true,
      },
    });

    // 3. Create GATC Profile
    const validFrom = payload.valid_from ? new Date(payload.valid_from) : new Date();
    const validTo = payload.valid_to ? new Date(payload.valid_to) : new Date(Date.now() + 3 * 365 * 24 * 3600 * 1000);

    const gatc = await prisma.gATCProfile.create({
      data: {
        tenant_id: tenantId,
        facility_id: facility.facility_id,
        approval_order_number: payload.approval_order_number,
        approved_scope: JSON.stringify({
          max_capacity_kg: payload.max_capacity_kg || 50000,
          approved_classes: payload.approved_classes || ['Class II', 'Class III'],
        }),
        valid_from: validFrom,
        valid_to: validTo,
        status: 'ACTIVE',
      },
      include: { facility: true },
    });

    await writeAudit(actor, 'ADMIN_REGISTER_GATC', 'gatc_profiles', gatc.gatc_id, {
      facility_name: payload.facility_name,
      approval_order: payload.approval_order_number,
      max_capacity: payload.max_capacity_kg,
    });

    return gatc;
  }

  // --- STATUTORY MODEL APPROVAL REGISTRATION ---
  async registerModelApproval(actor: AdminActor, payload: {
    category?: string;
    subtype?: string;
    manufacturer_name: string;
    model_name: string;
    model_approval_number: string;
    accuracy_class: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII';
    min_capacity: number | string;
    max_capacity: number | string;
    capacity_unit?: string;
    verification_scale_interval_e: number | string;
    scale_interval_unit?: string;
    specifications?: Record<string, unknown>;
  }) {
    if (!payload.model_approval_number || !payload.model_name || !payload.manufacturer_name) {
      throw new ValidationError('Model approval number, model name, and manufacturer are required.');
    }

    const model = await prisma.instrumentModel.create({
      data: {
        category: payload.category || 'WEIGHING',
        subtype: payload.subtype || 'NON_AUTOMATIC',
        manufacturer_name: payload.manufacturer_name,
        model_name: payload.model_name,
        model_approval_number: payload.model_approval_number,
        accuracy_class: payload.accuracy_class as any,
        min_capacity: String(payload.min_capacity),
        max_capacity: String(payload.max_capacity),
        capacity_unit: payload.capacity_unit || 'kg',
        verification_scale_interval_e: String(payload.verification_scale_interval_e),
        scale_interval_unit: payload.scale_interval_unit || 'g',
        specifications: JSON.stringify(payload.specifications || {}),
        is_active: true,
      },
    });

    await writeAudit(actor, 'ADMIN_REGISTER_MODEL', 'instrument_models', model.model_id, {
      model_approval_number: payload.model_approval_number,
      model_name: payload.model_name,
    });

    return model;
  }

  // --- DUAL-CONTROL / MAKER-CHECKER WORKFLOW ---
  async createApprovalRequest(actor: AdminActor, payload: {
    tenant_id?: string;
    entity_type: 'USER_PROVISION' | 'GATC_REGISTRATION' | 'MODEL_APPROVAL' | 'STANDARD_REGISTER';
    title: string;
    payload: Record<string, unknown>;
  }) {
    const tenantId = payload.tenant_id || actor.tenantId || 'tenant-delhi-central';

    const req = await prisma.approvalRequest.create({
      data: {
        tenant_id: tenantId,
        entity_type: payload.entity_type,
        title: payload.title,
        payload: JSON.stringify(payload.payload),
        status: 'PENDING',
        requester_id: actor.userId,
        requester_name: actor.userName || actor.userId,
      },
    });

    await writeAudit(actor, 'MAKER_SUBMIT_APPROVAL', 'approval_requests', req.request_id, {
      entity_type: payload.entity_type,
      title: payload.title,
    });

    return req;
  }

  async listApprovals(status?: string) {
    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    return prisma.approvalRequest.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async reviewApproval(actor: AdminActor, requestId: string, action: 'APPROVE' | 'REJECT', notes?: string) {
    const req = await prisma.approvalRequest.findUnique({ where: { request_id: requestId } });
    if (!req) {
      throw new NotFoundError(`Approval request '${requestId}' not found.`);
    }
    if (req.status !== 'PENDING') {
      throw new ValidationError(`Approval request has already been ${req.status.toLowerCase()}.`);
    }

    let appliedResult: any = null;

    if (action === 'APPROVE') {
      const data = JSON.parse(req.payload);
      switch (req.entity_type) {
        case 'USER_PROVISION':
          appliedResult = await this.provisionUser(actor, data);
          break;
        case 'GATC_REGISTRATION':
          appliedResult = await this.registerGATC(actor, data);
          break;
        case 'MODEL_APPROVAL':
          appliedResult = await this.registerModelApproval(actor, data);
          break;
        default:
          appliedResult = { message: 'Approved and applied' };
      }
    }

    const updated = await prisma.approvalRequest.update({
      where: { request_id: requestId },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewer_id: actor.userId,
        reviewer_name: actor.userName || actor.userId,
        review_notes: notes || (action === 'APPROVE' ? 'Approved by Controller' : 'Rejected by Controller'),
        reviewed_at: new Date(),
      },
    });

    await writeAudit(actor, `CHECKER_${action}`, 'approval_requests', requestId, {
      action,
      notes,
      appliedResult,
    });

    return { approval: updated, appliedResult };
  }

  async listJurisdictions(tenantId = 'tenant-delhi-central') {
    return prisma.jurisdiction.findMany({
      where: { tenant_id: tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async listUsers(tenantId = 'tenant-delhi-central') {
    return prisma.user.findMany({
      where: { tenant_id: tenantId },
      include: { lmo_profile: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async listGATCCentres(tenantId = 'tenant-delhi-central') {
    return prisma.gATCProfile.findMany({
      where: { tenant_id: tenantId },
      include: { facility: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async listAuditLogs(
    actor: AdminActor,
    filter: {
      page?: number;
      pageSize?: number;
      actorId?: string;
      action?: string;
      entityType?: string;
      correlationId?: string;
      from?: string;
      to?: string;
    }
  ): Promise<any> {
    const page = filter.page || 1;
    const pageSize = Math.min(Math.max(filter.pageSize || 50, 1), 100);
    const where: Record<string, unknown> = {};

    if (filter.actorId) where.actor_id = filter.actorId;
    if (filter.action) where.action = filter.action;
    if (filter.entityType) where.entity_type = filter.entityType;
    if (filter.correlationId) where.correlation_id = filter.correlationId;

    if (filter.from || filter.to) {
      const ts: Record<string, Date> = {};
      if (filter.from) ts.gte = new Date(filter.from);
      if (filter.to) ts.lte = new Date(filter.to);
      where.recorded_at = ts;
    }

    const skip = (page - 1) * pageSize;
    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { recorded_at: 'desc' },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;
    return {
      items,
      total,
      page,
      page_size: pageSize,
      pageSize,
      total_pages: totalPages,
      totalPages,
    };
  }

  async overview(actor: AdminActor): Promise<any> {
    const whereTenant = actor.tenantId ? { tenant_id: actor.tenantId } : {};

    const [
      tenantCount, jurisdictionCount, stakeholderCount, facilityCount,
      userCount, instrumentModelCount, instrumentCount, applicationCount,
      sessionCount, certificateCount, standardCount,
      observationCount, stampCount, feeCount, auditCount, delegationCount,
      procedureCount, legalSourceCount, approvalCount,
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
      prisma.legalSourceRecord.count(), prisma.approvalRequest.count({ where: whereTenant }),
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
        approval_requests: approvalCount,
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
