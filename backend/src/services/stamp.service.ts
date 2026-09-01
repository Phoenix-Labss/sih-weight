import { PhysicalStampAction } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import { SecurityContext, PhysicalSealActionEnum, SealTypeEnum } from '../core/types.js';

export interface PhysicalStampRecordInput {
  instrument_id?: string;
  action_type?: PhysicalSealActionEnum | string;
  seal_type?: SealTypeEnum | string;
  seal_identification_number: string;
  seal_position: string;
  photo_evidence_hash?: string;
  photo_storage_path?: string;
  notes?: string;
}

export class StampService {
  /**
   * Records a physical stamping or sealing action for a session
   */
  async recordStampAction(
    tenantId: string,
    sessionId: string,
    input: PhysicalStampRecordInput,
    actor: SecurityContext
  ): Promise<any> {
    if (!input.seal_identification_number || !input.seal_position) {
      throw new ValidationError('seal_identification_number and seal_position are required');
    }

    if (input.photo_evidence_hash) {
      const normalized = input.photo_evidence_hash.trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(normalized)) {
        throw new ValidationError('photo_evidence_hash must be a valid 64-character hexadecimal SHA-256 digest.');
      }
      input.photo_evidence_hash = normalized;
    }

    const session = await prisma.verificationSession.findFirst({
      where: { tenant_id: tenantId, session_id: sessionId },
    });
    if (!session) {
      throw new NotFoundError(`Verification session '${sessionId}' not found`);
    }

    const instrumentId = input.instrument_id || session.instrument_id;
    const cleanSealNumber = input.seal_identification_number.trim();

    // Check for existing seal to prevent duplicate recording
    const existingSeal = await prisma.physicalStampAction.findFirst({
      where: {
        tenant_id: tenantId,
        session_id: sessionId,
        seal_identification_number: cleanSealNumber,
      },
    });
    if (existingSeal) {
      return this.formatStamp(existingSeal);
    }

    const created = await prisma.physicalStampAction.create({
      data: {
        tenant_id: tenantId,
        session_id: sessionId,
        instrument_id: instrumentId,
        verifier_id: actor.userId || session.verifier_id,
        action_type: (input.action_type as any) || 'SEAL_APPLIED',
        seal_type: (input.seal_type as any) || 'LEAD_WIRE_SEAL',
        seal_identification_number: input.seal_identification_number,
        seal_position: input.seal_position,
        photo_evidence_hash: input.photo_evidence_hash || null,
        photo_storage_path: input.photo_storage_path || null,
        notes: input.notes || 'Official statutory lead wire seal affixed.',
      },
    });

    return this.formatStamp(created);
  }

  /**
   * Lists physical stamps recorded for a session
   */
  async listStampsForSession(tenantId: string, sessionId: string): Promise<any[]> {
    const raw = await prisma.physicalStampAction.findMany({
      where: { tenant_id: tenantId, session_id: sessionId },
      orderBy: { action_timestamp: 'desc' },
    });

    return (raw as PhysicalStampAction[]).map((s: PhysicalStampAction) => this.formatStamp(s));
  }

  public formatStamp(s: PhysicalStampAction | any): any {
    return {
      stamp_action_id: s.stamp_action_id,
      tenant_id: s.tenant_id,
      session_id: s.session_id,
      instrument_id: s.instrument_id,
      verifier_id: s.verifier_id,
      action_type: s.action_type,
      seal_type: s.seal_type,
      seal_identification_number: s.seal_identification_number,
      seal_position: s.seal_position,
      photo_evidence_hash: s.photo_evidence_hash || undefined,
      photo_storage_path: s.photo_storage_path || undefined,
      action_timestamp: s.action_timestamp?.toISOString(),
      notes: s.notes || undefined,
      created_at: s.action_timestamp?.toISOString(),
    };
  }
}

export const stampService = new StampService();
