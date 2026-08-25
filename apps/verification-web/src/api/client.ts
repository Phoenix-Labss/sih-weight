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
} from './mock/mockService';
import {
  httpApplicationService,
  httpCertificateService,
  httpInstrumentService,
  httpPublicVerifyService,
  httpStampService,
  httpVerificationService,
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
};
