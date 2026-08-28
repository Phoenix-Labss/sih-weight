import { PaginatedResponse } from '../types/api';
import { Instrument, InstrumentModel, InstrumentRegisterRequest } from '../types/instrument';
import {
  Application,
  ApplicationCorrectionRequest,
  ApplicationCreateRequest,
  ApplicationScheduleRequest,
  ApplicationScrutinyRequest,
  FeeAssessmentCreate,
  PaymentReconcileRequest,
} from '../types/application';
import {
  SessionCreateRequest,
  SessionDispositionRequest,
  SessionObservationSubmitRequest,
  VerificationSession,
} from '../types/session';
import { PhysicalStamp, PhysicalStampRecordRequest } from '../types/stamp';
import { Certificate, CertificateIssueRequest, CertificateStatusUpdateRequest } from '../types/certificate';
import { PublicCertificateVerifyResponse } from '../types/public';
import { env } from '../config/env';
import {
  mockApplicationService,
  mockCertificateService,
  mockInstrumentService,
  mockPublicVerifyService,
  mockStampService,
  mockVerificationService,
  mockEvidenceService,
  mockDb,
} from './mock/mockService';
import {
  httpApplicationService,
  httpCertificateService,
  httpInstrumentService,
  httpPublicVerifyService,
  httpStampService,
  httpVerificationService,
  httpEvidenceService,
} from './http';

export interface IInstrumentService {
  listInstruments(tenantId: string, page?: number, pageSize?: number): Promise<PaginatedResponse<Instrument>>;
  getInstrument(tenantId: string, id: string): Promise<Instrument>;
  registerInstrument(tenantId: string, payload: InstrumentRegisterRequest): Promise<Instrument>;
  listModels?(): Promise<InstrumentModel[]>;
}

export interface IApplicationService {
  listApplications(tenantId: string, page?: number, pageSize?: number): Promise<PaginatedResponse<Application>>;
  getApplication(tenantId: string, id: string): Promise<Application>;
  createApplication(tenantId: string, payload: ApplicationCreateRequest): Promise<Application>;
  submitApplication(tenantId: string, id: string): Promise<Application>;
  scrutinizeApplication(tenantId: string, id: string, payload: ApplicationScrutinyRequest): Promise<Application>;
  submitCorrection(tenantId: string, id: string, payload: ApplicationCorrectionRequest): Promise<Application>;
  assessFee(tenantId: string, id: string, payload: FeeAssessmentCreate): Promise<Application>;
  reconcilePayment(tenantId: string, id: string, payload: PaymentReconcileRequest): Promise<Application>;
  scheduleApplication(tenantId: string, id: string, payload: ApplicationScheduleRequest): Promise<Application>;
  getSlotAvailability?(
    tenantId: string,
    jurisdictionId: string,
    dateStr: string
  ): Promise<{
    date: string;
    jurisdiction_id: string;
    jurisdiction_name: string;
    total_fleet_size: number;
    slots: Array<{
      slot_id: string;
      start_time: string;
      end_time: string;
      total_capacity: number;
      booked_count: number;
      remaining_slots: number;
      is_available: boolean;
    }>;
  }>;
}

export interface IVerificationService {
  listSessions(tenantId: string, page?: number, pageSize?: number): Promise<PaginatedResponse<VerificationSession>>;
  getSession(tenantId: string, id: string): Promise<VerificationSession>;
  createSession(tenantId: string, payload: SessionCreateRequest): Promise<VerificationSession>;
  confirmIdentity(tenantId: string, id: string, serialVerified: boolean): Promise<VerificationSession>;
  startSession(tenantId: string, id: string): Promise<VerificationSession>;
  submitObservations(
    tenantId: string,
    id: string,
    payload: SessionObservationSubmitRequest
  ): Promise<VerificationSession>;
  recordDisposition(tenantId: string, id: string, payload: SessionDispositionRequest): Promise<VerificationSession>;
}

export interface IStampService {
  recordStampAction(tenantId: string, sessionId: string, payload: PhysicalStampRecordRequest): Promise<PhysicalStamp>;
  listSessionStamps(tenantId: string, sessionId: string): Promise<PhysicalStamp[]>;
}

export interface ICertificateService {
  listCertificates(tenantId: string, page?: number, pageSize?: number): Promise<PaginatedResponse<Certificate>>;
  getCertificate(tenantId: string, id: string): Promise<Certificate>;
  issueCertificate(tenantId: string, payload: CertificateIssueRequest): Promise<Certificate>;
  updateStatus(tenantId: string, id: string, payload: CertificateStatusUpdateRequest): Promise<Certificate>;
}

export interface VerifiedEvidenceResponse {
  evidence_id: string;
  tenant_id: string;
  session_id?: string;
  instrument_id?: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  sha256_hash: string;
  claimed_sha256?: string;
  is_checksum_verified: boolean;
  server_verified_at: string;
  verifier_actor_id: string;
  digital_proof_signature: string;
  evidence_category: string;
}

export interface IEvidenceService {
  verifyAndIngestEvidence(
    tenantId: string,
    payload: {
      file_bytes_base64: string;
      file_name?: string;
      mime_type?: string;
      claimed_sha256?: string;
      session_id?: string;
      instrument_id?: string;
      evidence_category?: string;
    }
  ): Promise<VerifiedEvidenceResponse>;
}

export interface IPublicVerifyService {
  verifyCertificate(qrReference: string): Promise<PublicCertificateVerifyResponse>;
}

// Check runtime mode
let currentMode: 'mock' | 'api' = env.API_MODE === 'api' ? 'api' : 'mock';

export function setApiMode(mode: 'mock' | 'api') {
  currentMode = mode;
}

export function getApiMode(): 'mock' | 'api' {
  return currentMode;
}

// Wrapper that allows dynamic switching or auto-fallback
function createProxy<T extends object>(mockImpl: T, httpImpl: T): T {
  return new Proxy(mockImpl, {
    get(target, prop, receiver) {
      if (currentMode === 'api') {
        const httpMethod = (httpImpl as Record<string | symbol, unknown>)[prop];
        if (typeof httpMethod === 'function') {
          return async (...args: unknown[]) => {
            try {
              return await (httpMethod as (...a: unknown[]) => unknown).apply(httpImpl, args);
            } catch (err) {
              if (env.API_MODE === 'auto') {
                console.warn(`[API Auto Fallback] Live backend call failed for ${String(prop)}, falling back to mock:`, err);
                const mockMethod = (mockImpl as Record<string | symbol, unknown>)[prop];
                if (typeof mockMethod === 'function') {
                  return (mockMethod as (...a: unknown[]) => unknown).apply(mockImpl, args);
                }
              }
              throw err;
            }
          };
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export const api = {
  instruments: createProxy(mockInstrumentService, httpInstrumentService),
  applications: createProxy(mockApplicationService, httpApplicationService),
  verification: createProxy(mockVerificationService, httpVerificationService),
  stamps: createProxy(mockStampService, httpStampService),
  certificates: createProxy(mockCertificateService, httpCertificateService),
  publicVerify: createProxy(mockPublicVerifyService, httpPublicVerifyService),
  evidence: createProxy(mockEvidenceService, httpEvidenceService),
  system: {
    resetAllData: async () => {
      try {
        await fetch(`${env.API_BASE_URL.replace('/api/v1', '')}/api/v1/system/reset-database`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        // Ignore backend unreachable in purely offline mode
      }
      mockDb.resetToDefaults();
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore
      }
      window.location.reload();
    },
  },
};
