import { InstrumentModel, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import { generateInstrumentToken } from '../security/qr-token.js';
import { PaginatedResult } from '../core/types.js';

type InstrumentWithRelations = Prisma.InstrumentGetPayload<{
  include: {
    model: true;
    facility: true;
    owner: true;
  };
}>;

export interface RegisterInstrumentInput {
  jurisdiction_id?: string;
  model_id: string;
  owner_id: string;
  facility_id?: string;
  serial_number: string;
  year_of_manufacture?: number;
  intended_use?: string;
  installation_location_notes?: string;
}

function parseJsonSafe(val: unknown): Record<string, unknown> {
  if (typeof val === 'object' && val !== null) {
    return val as Record<string, unknown>;
  }
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  return {};
}

export class InstrumentService {
  /**
   * Lists instruments for a tenant with pagination and optional owner filtering
   */
  async listInstruments(
    tenantId: string,
    page = 1,
    pageSize = 50,
    ownerId?: string
  ): Promise<PaginatedResult<any>> {
    const skip = (Math.max(1, page) - 1) * pageSize;
    const where: any = { tenant_id: tenantId };
    if (ownerId) {
      // Check if ownerId matches stakeholder_id or user_id
      const user = await prisma.user.findUnique({ where: { user_id: ownerId } });
      if (user && user.stakeholder_id) {
        where.owner_id = user.stakeholder_id;
      } else {
        where.owner_id = ownerId;
      }
    }

    const [total, rawItems] = await Promise.all([
      prisma.instrument.count({ where }),
      prisma.instrument.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          model: true,
          facility: true,
          owner: true,
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const items = (rawItems as InstrumentWithRelations[]).map((inst: InstrumentWithRelations) => this.formatInstrument(inst));
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      items,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      pages: totalPages,
    };
  }

  /**
   * Gets an instrument by ID or Public Instrument Token
   */
  async getInstrumentById(tenantId: string, idOrToken: string): Promise<any> {
    const raw = await prisma.instrument.findFirst({
      where: {
        tenant_id: tenantId,
        OR: [{ instrument_id: idOrToken }, { public_instrument_token: idOrToken }],
      },
      include: {
        model: true,
        facility: true,
        owner: true,
      },
    });

    if (!raw) {
      throw new NotFoundError(`Instrument '${idOrToken}' not found in tenant '${tenantId}'`);
    }

    return this.formatInstrument(raw);
  }

  /**
   * Registers a new instrument unit under a tenant
   */
  async registerInstrument(tenantId: string, data: RegisterInstrumentInput): Promise<any> {
    if (!data.serial_number || !data.model_id) {
      throw new ValidationError('serial_number and model_id are required');
    }

    // Verify model exists
    const model = await prisma.instrumentModel.findUnique({
      where: { model_id: data.model_id },
    });
    if (!model) {
      throw new NotFoundError(`Instrument model '${data.model_id}' not found`);
    }

    // Resolve owner_id (could be stakeholder_id or user_id)
    let stakeholderId = data.owner_id || 'stk-trader-01';
    const stakeholder = await prisma.stakeholder.findUnique({
      where: { stakeholder_id: stakeholderId },
    });
    if (!stakeholder) {
      const user = await prisma.user.findUnique({
        where: { user_id: stakeholderId },
      });
      if (user && user.stakeholder_id) {
        stakeholderId = user.stakeholder_id;
      } else {
        const defaultStakeholder = await prisma.stakeholder.findFirst({
          where: { tenant_id: tenantId },
        });
        if (defaultStakeholder) {
          stakeholderId = defaultStakeholder.stakeholder_id;
        }
      }
    }

    // Resolve facility_id
    let facilityId = data.facility_id || 'fac-retail-01';
    const facility = await prisma.facility.findUnique({
      where: { facility_id: facilityId },
    });
    if (!facility) {
      const defaultFacility = await prisma.facility.findFirst({
        where: { tenant_id: tenantId },
      });
      if (defaultFacility) {
        facilityId = defaultFacility.facility_id;
      }
    }

    // Resolve jurisdiction_id
    let jurisdictionId = data.jurisdiction_id || 'jur-dl-01';
    const jur = await prisma.jurisdiction.findUnique({
      where: { jurisdiction_id: jurisdictionId },
    });
    if (!jur) {
      const defaultJur = await prisma.jurisdiction.findFirst({
        where: { tenant_id: tenantId },
      });
      if (defaultJur) {
        jurisdictionId = defaultJur.jurisdiction_id;
      }
    }

    // Check unique model + serial number
    const existing = await prisma.instrument.findFirst({
      where: {
        model_id: data.model_id,
        serial_number: data.serial_number,
      },
    });
    if (existing) {
      throw new ValidationError(
        `Instrument with model '${data.model_id}' and serial '${data.serial_number}' is already registered`
      );
    }

    const publicToken = generateInstrumentToken();

    const created = await prisma.instrument.create({
      data: {
        tenant_id: tenantId,
        jurisdiction_id: jurisdictionId,
        model_id: data.model_id,
        owner_id: stakeholderId,
        facility_id: facilityId,
        serial_number: data.serial_number,
        year_of_manufacture: Number(data.year_of_manufacture) || new Date().getFullYear(),
        intended_use: data.intended_use || 'Commercial trade weighing',
        installation_location_notes: data.installation_location_notes || null,
        public_instrument_token: publicToken,
        current_status: 'UNVERIFIED',
      },
      include: {
        model: true,
        facility: true,
        owner: true,
      },
    });

    return this.formatInstrument(created);
  }

  /**
   * Lists approved instrument models
   */
  async listModels(_tenantId: string): Promise<any[]> {
    const rawModels = await prisma.instrumentModel.findMany({
      where: { is_active: true },
      orderBy: { model_name: 'asc' },
    });

    return (rawModels as InstrumentModel[]).map((m: InstrumentModel) => this.formatModel(m));
  }

  public formatInstrument(inst: InstrumentWithRelations | any): any {
    return {
      instrument_id: inst.instrument_id,
      public_instrument_token: inst.public_instrument_token,
      tenant_id: inst.tenant_id,
      jurisdiction_id: inst.jurisdiction_id,
      model_id: inst.model_id,
      owner_id: inst.owner_id,
      facility_id: inst.facility_id,
      serial_number: inst.serial_number,
      year_of_manufacture: inst.year_of_manufacture,
      intended_use: inst.intended_use || undefined,
      installation_location_notes: inst.installation_location_notes || undefined,
      current_status: inst.current_status,
      latest_certificate_id: inst.latest_certificate_id || undefined,
      verification_due_date: inst.verification_due_date ? inst.verification_due_date.toISOString().split('T')[0] : undefined,
      legacy_trust: inst.legacy_trust || undefined,
      model: inst.model ? this.formatModel(inst.model) : undefined,
      components: [],
      created_at: inst.created_at?.toISOString(),
      updated_at: inst.updated_at?.toISOString(),
    };
  }

  public formatModel(m: InstrumentModel | any): any {
    return {
      model_id: m.model_id,
      category: m.category,
      subtype: m.subtype,
      manufacturer_name: m.manufacturer_name,
      model_name: m.model_name,
      model_approval_number: m.model_approval_number,
      accuracy_class: m.accuracy_class,
      verification_scale_interval_e: Number(m.verification_scale_interval_e),
      scale_interval_unit: m.scale_interval_unit,
      min_capacity: Number(m.min_capacity),
      max_capacity: Number(m.max_capacity),
      capacity_unit: m.capacity_unit,
      number_of_intervals_n: m.number_of_intervals_n ?? undefined,
      specifications: parseJsonSafe(m.specifications),
      is_active: m.is_active,
      created_at: m.created_at?.toISOString(),
      updated_at: m.updated_at?.toISOString(),
    };
  }
}

export const instrumentService = new InstrumentService();
