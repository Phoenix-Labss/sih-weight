import { prisma } from '../db/prisma.js';
import { NotFoundError, ValidationError, GuardConditionFailedError } from '../core/errors.js';
import { CertificateStateMachine } from '../core/state-machines/certificate.machine.js';
import { sha256Hex } from '../security/crypto.js';
import { hsmDscProvider } from '../security/hsm-dsc.provider.js';
import { generateOpaqueQrToken } from '../security/qr-token.js';
import { generateCertificatePdf } from '../security/pdf-generator.js';
import { PaginatedResult, SecurityContext, CertificateStatusEnum } from '../core/types.js';

export interface CertificateIssueInput {
  session_id: string;
  validity_months?: number;
  signer_notes?: string;
}

export interface CertificateStatusUpdateInput {
  action: 'SUSPEND' | 'REINSTATE' | 'REVOKE' | 'SUPERSEDE' | 'EXPIRE';
  reason: string;
  statutory_authority_reference?: string;
  superseding_certificate_id?: string;
}

export class CertificateService {
  /**
   * Lists certificates for a tenant with pagination and optional owner filtering
   */
  async listCertificates(
    tenantId: string,
    page = 1,
    pageSize = 50,
    ownerId?: string
  ): Promise<PaginatedResult<any>> {
    const skip = (Math.max(1, page) - 1) * pageSize;
    const where: any = { tenant_id: tenantId };
    if (ownerId) {
      // Resolve ownerId against user_id -> stakeholder_id so OWNER-scoped
      // listings match records stored under the resolved stakeholder id,
      // mirroring registerInstrument's owner resolution.
      const user = await prisma.user.findUnique({ where: { user_id: ownerId } });
      if (user && user.stakeholder_id) {
        where.owner_id = user.stakeholder_id;
      } else {
        where.owner_id = ownerId;
      }
    }

    const [total, rawItems] = await Promise.all([
      prisma.certificate.count({ where }),
      prisma.certificate.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          status_events: { orderBy: { event_timestamp: 'asc' } },
          instrument: { include: { model: true } },
          verifier: true,
          signer: true,
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const items = rawItems.map((c) => this.formatCertificate(c));
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
   * Gets a certificate by ID or Public Verification Token
   */
  async getCertificateById(tenantId: string, idOrToken: string): Promise<any> {
    const raw = await prisma.certificate.findFirst({
      where: {
        tenant_id: tenantId,
        OR: [{ certificate_id: idOrToken }, { public_verification_token: idOrToken }],
      },
      include: {
        status_events: { orderBy: { event_timestamp: 'asc' } },
        instrument: { include: { model: true } },
        verifier: true,
        signer: true,
      },
    });

    if (!raw) {
      throw new NotFoundError(`Certificate '${idOrToken}' not found in tenant '${tenantId}'`);
    }

    return this.formatCertificate(raw);
  }

  /**
   * Issues and cryptographically signs a digital statutory certificate
   */
  async issueCertificate(
    tenantId: string,
    input: CertificateIssueInput,
    actor: SecurityContext
  ): Promise<any> {
    if (!input.session_id) {
      throw new ValidationError('session_id is required');
    }

    // 1. Fetch verification session
    const session = await prisma.verificationSession.findFirst({
      where: { tenant_id: tenantId, session_id: input.session_id },
      include: {
        reference_standards: true,
        instrument: { include: { model: true } },
      },
    });

    if (!session) {
      throw new NotFoundError(`Verification session '${input.session_id}' not found`);
    }

    // Guard: Verification must be finalized and passed
    if (
      session.outcome !== 'VERIFICATION_PASSED_PENDING_AUTHORIZATION' &&
      session.automated_evaluation_flag !== true
    ) {
      throw new GuardConditionFailedError(
        'Cannot issue certificate: Verification session did not pass statutory metrological evaluation'
      );
    }

    const instrument = session.instrument;
    if (!instrument || !instrument.model) {
      throw new NotFoundError('Associated instrument and model specifications required');
    }

    // 2. Generate unique certificate number & opaque QR token
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const certNumber = `CERT-2026-DL-${randomDigits}`;
    const qrToken = generateOpaqueQrToken('formatted');

    // 3. Compute statutory validity dates
    const validityMonths = input.validity_months || 12;
    const issueDate = new Date();
    const validUntil = new Date(issueDate);
    validUntil.setMonth(validUntil.getMonth() + validityMonths);
    validUntil.setDate(validUntil.getDate() - 1); // Exact 1 year minus 1 day

    // 4. Construct canonical JCS payload snapshot
    const canonicalSnapshot = {
      certificate_number: certNumber,
      instrument: {
        accuracy_class: instrument.model.accuracy_class,
        category: instrument.model.category,
        max_capacity: instrument.model.max_capacity.toString(),
        min_capacity: instrument.model.min_capacity.toString(),
        model_approval_number: instrument.model.model_approval_number,
        model_name: instrument.model.model_name,
        scale_interval_e: instrument.model.verification_scale_interval_e.toString(),
        serial_number: instrument.serial_number,
        subtype: instrument.model.subtype,
        unit: instrument.model.capacity_unit,
      },
      reference_standards: session.reference_standards.map((rs) => ({
        certificate: rs.snapshot_calibration_certificate,
        standard_id: rs.standard_id,
        valid_until: rs.snapshot_valid_until.toISOString().split('T')[0],
      })),
      session: {
        outcome: session.outcome || 'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
        procedure_pack_checksum: session.procedure_pack_checksum,
        procedure_pack_id: session.procedure_pack_id,
        session_id: session.session_id,
      },
      tenant_id: tenantId,
      validity: {
        issue_date: issueDate.toISOString().split('T')[0],
        valid_until: validUntil.toISOString().split('T')[0],
      },
      verifier: {
        jurisdiction_id: instrument.jurisdiction_id,
        officer_id: actor.userId || session.verifier_id,
        role: actor.role || 'LMO',
      },
    };

    // 5. Compute SHA-256 Digest & Ed25519 DSC Signature
    const sha256Digest = sha256Hex(canonicalSnapshot);
    const signatureResult = await hsmDscProvider.signHash(sha256Digest, {
      signer_id: actor.userId || session.verifier_id,
      signer_role: actor.role || 'LMO',
      jurisdiction_id: instrument.jurisdiction_id,
      signer_name: actor.fullName,
    });

    const qrPayload = JSON.stringify({
      cert: certNumber,
      token: qrToken,
      hash: sha256Digest,
      valid_until: validUntil.toISOString().split('T')[0],
    });

    // 6. Create Certificate record
    const certificate = await prisma.certificate.create({
      data: {
        certificate_number: certNumber,
        public_verification_token: qrToken,
        tenant_id: tenantId,
        session_id: session.session_id,
        instrument_id: instrument.instrument_id,
        owner_id: instrument.owner_id,
        procedure_pack_id: session.procedure_pack_id,
        verifier_id: session.verifier_id,
        signer_id: actor.userId || session.verifier_id,
        issue_date: issueDate,
        valid_until: validUntil,
        certificate_status: 'ISSUED',
        certificate_bytes_sha256: sha256Digest,
        digital_signature_reference: signatureResult.digital_signature_reference,
        signature_timestamp: new Date(signatureResult.signed_at_utc),
        qr_code_payload: qrPayload,
      },
      include: {
        status_events: true,
        instrument: { include: { model: true } },
      },
    });

    // 7. Append initial status event
    await prisma.certificateStatusEvent.create({
      data: {
        certificate_id: certificate.certificate_id,
        previous_status: 'DRAFT',
        new_status: 'ISSUED',
        actor_id: actor.userId || session.verifier_id,
        reason: input.signer_notes || 'Statutory digital certificate issued and digitally signed.',
        statutory_authority_reference: 'Section 24 of The Legal Metrology Act, 2009',
      },
    });

    // 8. Update instrument status to VERIFIED and set due date
    await prisma.instrument.update({
      where: { instrument_id: instrument.instrument_id },
      data: {
        current_status: 'VERIFIED',
        latest_certificate_id: certificate.certificate_id,
        verification_due_date: validUntil,
      },
    });

    const refetched = await prisma.certificate.findUnique({
      where: { certificate_id: certificate.certificate_id },
      include: {
        status_events: { orderBy: { event_timestamp: 'asc' } },
        instrument: { include: { model: true } },
      },
    });

    return this.formatCertificate(refetched);
  }

  /**
   * Updates certificate lifecycle status (Suspend, Reinstate, Revoke, Supersede, Expire)
   */
  async updateCertificateStatus(
    tenantId: string,
    certificateId: string,
    input: CertificateStatusUpdateInput,
    actor: SecurityContext
  ): Promise<any> {
    const cert = await prisma.certificate.findFirst({
      where: {
        tenant_id: tenantId,
        OR: [{ certificate_id: certificateId }, { certificate_number: certificateId }],
      },
    });

    if (!cert) {
      throw new NotFoundError(`Certificate '${certificateId}' not found`);
    }

    const stateCtx = {
      certificate_id: cert.certificate_id,
      tenant_id: cert.tenant_id,
      certificate_status: cert.certificate_status as any,
      session_id: cert.session_id,
    };

    let nextStatus: CertificateStatusEnum;
    switch (input.action) {
      case 'SUSPEND':
        nextStatus = CertificateStateMachine.suspend(stateCtx, actor, input.reason);
        break;
      case 'REINSTATE':
        nextStatus = CertificateStateMachine.reinstate(stateCtx, actor, input.reason);
        break;
      case 'REVOKE':
        nextStatus = CertificateStateMachine.revoke(stateCtx, actor, input.reason);
        break;
      case 'SUPERSEDE':
        nextStatus = CertificateStateMachine.supersede(stateCtx, actor, input.superseding_certificate_id);
        break;
      case 'EXPIRE':
        nextStatus = CertificateStateMachine.expire(stateCtx, actor);
        break;
      default:
        throw new ValidationError(`Unknown status action: ${input.action}`);
    }

    // Record status event
    await prisma.certificateStatusEvent.create({
      data: {
        certificate_id: cert.certificate_id,
        previous_status: cert.certificate_status,
        new_status: nextStatus,
        actor_id: actor.userId,
        reason: input.reason,
        statutory_authority_reference: input.statutory_authority_reference || 'Statutory regulatory action',
      },
    });

    // Update Certificate
    const updated = await prisma.certificate.update({
      where: { certificate_id: cert.certificate_id },
      data: {
        certificate_status: nextStatus,
        superseding_certificate_id: input.superseding_certificate_id || null,
      },
      include: {
        status_events: { orderBy: { event_timestamp: 'asc' } },
        instrument: { include: { model: true } },
      },
    });

    // If revoked, update instrument status
    if (nextStatus === 'REVOKED') {
      await prisma.instrument.update({
        where: { instrument_id: cert.instrument_id },
        data: { current_status: 'REJECTED' },
      });
    } else if (nextStatus === 'SUSPENDED') {
      await prisma.instrument.update({
        where: { instrument_id: cert.instrument_id },
        data: { current_status: 'SEALED_OUT_OF_SERVICE' },
      });
    }

    return this.formatCertificate(updated);
  }

  /**
   * Generates PDF binary bytes for a certificate
   */
  async getCertificatePdfBytes(tenantId: string, certificateId: string): Promise<{ buffer: Buffer; filename: string }> {
    const cert = await prisma.certificate.findFirst({
      where: {
        tenant_id: tenantId,
        OR: [{ certificate_id: certificateId }, { certificate_number: certificateId }],
      },
      include: {
        instrument: { include: { model: true } },
        verifier: true,
        session: {
          include: {
            stamp_actions: true,
          },
        },
      },
    });

    if (!cert) {
      throw new NotFoundError(`Certificate '${certificateId}' not found`);
    }

    const sealAction = cert.session.stamp_actions[0];

    const pdfBuffer = generateCertificatePdf({
      certificateNumber: cert.certificate_number,
      qrToken: cert.public_verification_token,
      issueDate: cert.issue_date.toISOString().split('T')[0],
      validUntil: cert.valid_until.toISOString().split('T')[0],
      status: cert.certificate_status,
      instrument: {
        category: cert.instrument.model.category,
        subtype: cert.instrument.model.subtype,
        modelName: cert.instrument.model.model_name,
        serialNumber: cert.instrument.serial_number,
        accuracyClass: cert.instrument.model.accuracy_class,
        maxCapacity: Number(cert.instrument.model.max_capacity),
        minCapacity: Number(cert.instrument.model.min_capacity),
        scaleIntervalE: Number(cert.instrument.model.verification_scale_interval_e),
        unit: cert.instrument.model.capacity_unit,
      },
      authority: 'Office of the Controller of Legal Metrology, Government of NCT of Delhi',
      officerName: cert.verifier.full_name,
      officerDesignation: 'Legal Metrology Officer',
      sha256Hash: cert.certificate_bytes_sha256 || undefined,
      digitalSignatureRef: cert.digital_signature_reference || undefined,
      sealNumber: sealAction?.seal_identification_number,
      isPublicRedacted: false,
    });

    return {
      buffer: pdfBuffer,
      filename: `Certificate-${cert.certificate_number}.pdf`,
    };
  }

  public formatCertificate(c: any): any {
    return {
      certificate_id: c.certificate_id,
      certificate_number: c.certificate_number,
      public_verification_token: c.public_verification_token,
      tenant_id: c.tenant_id,
      session_id: c.session_id,
      instrument_id: c.instrument_id,
      owner_id: c.owner_id,
      procedure_pack_id: c.procedure_pack_id,
      verifier_id: c.verifier_id,
      signer_id: c.signer_id || undefined,
      issue_date: c.issue_date?.toISOString().split('T')[0],
      valid_until: c.valid_until?.toISOString().split('T')[0],
      certificate_status: c.certificate_status,
      certificate_bytes_sha256: c.certificate_bytes_sha256 || undefined,
      pdf_storage_path: c.pdf_storage_path || undefined,
      digital_signature_reference: c.digital_signature_reference || undefined,
      signature_timestamp: c.signature_timestamp?.toISOString(),
      qr_code_payload: c.qr_code_payload,
      superseding_certificate_id: c.superseding_certificate_id || undefined,
      status_events: (c.status_events || []).map((se: any) => ({
        status_event_id: se.status_event_id,
        certificate_id: se.certificate_id,
        previous_status: se.previous_status,
        new_status: se.new_status,
        actor_id: se.actor_id,
        reason: se.reason,
        statutory_authority_reference: se.statutory_authority_reference || undefined,
        event_timestamp: se.event_timestamp?.toISOString(),
      })),
      created_at: c.created_at?.toISOString(),
      updated_at: c.updated_at?.toISOString(),
    };
  }
}

export const certificateService = new CertificateService();
