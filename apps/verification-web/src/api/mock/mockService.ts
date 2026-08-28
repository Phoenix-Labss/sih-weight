import {
  IApplicationService,
  ICertificateService,
  IInstrumentService,
  IPublicVerifyService,
  IStampService,
  IVerificationService,
  IEvidenceService,
} from '../client';
import { PaginatedResponse } from '../../types/api';
import { Instrument, InstrumentModel, InstrumentRegisterRequest } from '../../types/instrument';
import {
  Application,
  ApplicationCorrectionRequest,
  ApplicationCreateRequest,
  ApplicationScheduleRequest,
  ApplicationScrutinyRequest,
  FeeAssessmentCreate,
  PaymentReconcileRequest,
} from '../../types/application';
import {
  PhysicalStamp,
  PhysicalStampRecordRequest,
} from '../../types/stamp';
import {
  SessionCreateRequest,
  SessionDispositionRequest,
  SessionObservationSubmitRequest,
  VerificationSession,
} from '../../types/session';
import {
  Certificate,
  CertificateIssueRequest,
  CertificateStatusUpdateRequest,
} from '../../types/certificate';
import { PublicCertificateVerifyResponse } from '../../types/public';
import { mockDb } from './mockDb';

function paginate<T>(items: T[], page = 1, pageSize = 50): PaginatedResponse<T> {
  const total = items.length;
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);
  const pages = Math.ceil(total / pageSize) || 0;
  return {
    items: paged,
    total,
    page,
    page_size: pageSize,
    pages,
  };
}

export const mockInstrumentService: IInstrumentService = {
  async listInstruments(tenantId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<Instrument>> {
    const list = mockDb.getInstruments(tenantId);
    return paginate(list, page, pageSize);
  },
  async getInstrument(_tenantId: string, id: string): Promise<Instrument> {
    const inst = mockDb.getInstrument(id);
    if (!inst) throw new Error('Instrument not found');
    return inst;
  },
  async registerInstrument(tenantId: string, payload: InstrumentRegisterRequest): Promise<Instrument> {
    return mockDb.registerInstrument(tenantId, payload);
  },
  async listModels(): Promise<InstrumentModel[]> {
    return mockDb.getModels();
  },
};

export const mockApplicationService: IApplicationService = {
  async listApplications(tenantId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<Application>> {
    const list = mockDb.getApplications(tenantId);
    return paginate(list, page, pageSize);
  },
  async getApplication(_tenantId: string, id: string): Promise<Application> {
    const app = mockDb.getApplication(id);
    if (!app) throw new Error('Application not found');
    return app;
  },
  async createApplication(tenantId: string, payload: ApplicationCreateRequest): Promise<Application> {
    return mockDb.createApplication(tenantId, payload);
  },
  async submitApplication(_tenantId: string, id: string): Promise<Application> {
    return mockDb.submitApplication(id);
  },
  async scrutinizeApplication(_tenantId: string, id: string, payload: ApplicationScrutinyRequest): Promise<Application> {
    return mockDb.scrutinizeApplication(id, payload);
  },
  async submitCorrection(_tenantId: string, id: string, payload: ApplicationCorrectionRequest): Promise<Application> {
    return mockDb.submitCorrection(id, payload);
  },
  async assessFee(_tenantId: string, id: string, payload: FeeAssessmentCreate): Promise<Application> {
    return mockDb.assessFee(id, payload);
  },
  async reconcilePayment(_tenantId: string, id: string, payload: PaymentReconcileRequest): Promise<Application> {
    return mockDb.reconcilePayment(id, payload);
  },
  async scheduleApplication(_tenantId: string, id: string, payload: ApplicationScheduleRequest): Promise<Application> {
    return mockDb.scheduleApplication(id, payload);
  },
  async getSlotAvailability(tenantId: string, jurisdictionId: string, dateStr: string) {
    return mockDb.getSlotAvailability(tenantId, jurisdictionId, dateStr);
  },
};

export const mockVerificationService: IVerificationService = {
  async listSessions(tenantId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<VerificationSession>> {
    const list = mockDb.getSessions(tenantId);
    return paginate(list, page, pageSize);
  },
  async getSession(_tenantId: string, id: string): Promise<VerificationSession> {
    const sess = mockDb.getSession(id);
    if (!sess) throw new Error('Session not found');
    return sess;
  },
  async createSession(tenantId: string, payload: SessionCreateRequest): Promise<VerificationSession> {
    return mockDb.createSession(tenantId, payload);
  },
  async confirmIdentity(_tenantId: string, id: string, serialVerified: boolean): Promise<VerificationSession> {
    return mockDb.confirmIdentity(id, serialVerified);
  },
  async startSession(_tenantId: string, id: string): Promise<VerificationSession> {
    return mockDb.startSession(id);
  },
  async submitObservations(
    _tenantId: string,
    id: string,
    payload: SessionObservationSubmitRequest
  ): Promise<VerificationSession> {
    return mockDb.submitObservations(
      id,
      payload.reference_standard_ids,
      payload.observations,
      payload.environmental_temp_celsius,
      payload.environmental_humidity_percent
    );
  },
  async recordDisposition(_tenantId: string, id: string, payload: SessionDispositionRequest): Promise<VerificationSession> {
    return mockDb.recordDisposition(id, payload);
  },
};

export const mockStampService: IStampService = {
  async recordStampAction(tenantId: string, sessionId: string, payload: PhysicalStampRecordRequest): Promise<PhysicalStamp> {
    return mockDb.recordStamp(tenantId, sessionId, payload);
  },
  async listSessionStamps(_tenantId: string, sessionId: string): Promise<PhysicalStamp[]> {
    return mockDb.getStamps(sessionId);
  },
};

export const mockCertificateService: ICertificateService = {
  async listCertificates(tenantId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<Certificate>> {
    const list = mockDb.getCertificates(tenantId);
    return paginate(list, page, pageSize);
  },
  async getCertificate(_tenantId: string, id: string): Promise<Certificate> {
    const cert = mockDb.getCertificate(id);
    if (!cert) throw new Error('Certificate not found');
    return cert;
  },
  async issueCertificate(tenantId: string, payload: CertificateIssueRequest): Promise<Certificate> {
    return mockDb.issueCertificate(tenantId, payload);
  },
  async updateStatus(_tenantId: string, id: string, payload: CertificateStatusUpdateRequest): Promise<Certificate> {
    return mockDb.updateCertificateStatus(id, payload);
  },
};

export const mockPublicVerifyService: IPublicVerifyService = {
  async verifyCertificate(qrReference: string): Promise<PublicCertificateVerifyResponse> {
    return mockDb.verifyPublic(qrReference);
  },
};

export const mockEvidenceService: IEvidenceService = {
  async verifyAndIngestEvidence(tenantId, payload) {
    return mockDb.verifyAndIngestEvidence(tenantId, payload);
  },
};
