import { env } from '../config/env';
import { PaginatedResponse } from '../types/api';
import { Instrument, InstrumentModel, InstrumentRegisterRequest } from '../types/instrument';
import { mockModels } from './mock/mockFixtures';
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
import {
  IApplicationService,
  ICertificateService,
  IInstrumentService,
  IPublicVerifyService,
  IStampService,
  IVerificationService,
} from './client';

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${env.API_BASE_URL}${endpoint}`;
  
  let activeRole = 'OWNER';
  let activeActorId = 'usr-trader-01';
  let activeTenant = env.DEFAULT_TENANT_ID;

  try {
    activeRole = localStorage.getItem('auth_role') || 'OWNER';
    activeActorId = localStorage.getItem('auth_actor_id') || (activeRole === 'LMO' ? 'lmo-officer-01' : 'usr-trader-01');
    activeTenant = localStorage.getItem('auth_tenant_id') || env.DEFAULT_TENANT_ID;
  } catch {
    // Ignore
  }

  const explicitHeaders = (options.headers || {}) as Record<string, string>;
  const finalRole = explicitHeaders['X-Actor-Role'] || explicitHeaders['X-Test-Role'] || activeRole;
  const finalActorId = explicitHeaders['X-Actor-Id'] || explicitHeaders['X-Test-User-Id'] || (finalRole === 'LMO' ? 'lmo-officer-01' : activeActorId);
  const finalTenant = explicitHeaders['X-Tenant-Id'] || explicitHeaders['X-Test-Tenant-Id'] || activeTenant;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Actor-Id': finalActorId,
    'X-Test-User-Id': finalActorId,
    'X-Actor-Role': finalRole,
    'X-Test-Role': finalRole,
    'X-Jurisdiction-Id': env.DEFAULT_JURISDICTION_ID,
    'X-Test-Jurisdiction-Id': env.DEFAULT_JURISDICTION_ID,
    'X-Tenant-Id': finalTenant,
    'X-Test-Tenant-Id': finalTenant,
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...explicitHeaders,
    },
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || JSON.stringify(errorJson);
    } catch {
      // Ignore
    }
    throw new HttpError(response.status, `API error (${response.status}): ${errorDetail}`);
  }

  return response.json();
}

export const httpInstrumentService: IInstrumentService = {
  async listInstruments(tenantId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<Instrument>> {
    return request<PaginatedResponse<Instrument>>(`/tenants/${tenantId}/instruments?page=${page}&page_size=${pageSize}`);
  },
  async getInstrument(tenantId: string, id: string): Promise<Instrument> {
    return request<Instrument>(`/tenants/${tenantId}/instruments/${id}`);
  },
  async registerInstrument(tenantId: string, payload: InstrumentRegisterRequest): Promise<Instrument> {
    return request<Instrument>(`/tenants/${tenantId}/instruments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async listModels(): Promise<InstrumentModel[]> {
    try {
      const activeTenant = localStorage.getItem('auth_tenant_id') || env.DEFAULT_TENANT_ID;
      const res = await request<InstrumentModel[]>(`/tenants/${activeTenant}/instruments/models`);
      return res && res.length > 0 ? res : mockModels;
    } catch {
      return mockModels;
    }
  },
};

export const httpApplicationService: IApplicationService = {
  async listApplications(tenantId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<Application>> {
    return request<PaginatedResponse<Application>>(`/tenants/${tenantId}/applications?page=${page}&page_size=${pageSize}`);
  },
  async getApplication(tenantId: string, id: string): Promise<Application> {
    return request<Application>(`/tenants/${tenantId}/applications/${id}`);
  },
  async createApplication(tenantId: string, payload: ApplicationCreateRequest): Promise<Application> {
    return request<Application>(`/tenants/${tenantId}/applications`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async submitApplication(tenantId: string, id: string): Promise<Application> {
    return request<Application>(`/tenants/${tenantId}/applications/${id}/submit`, {
      method: 'POST',
      // Fastify rejects a POST that carries Content-Type: application/json
      // with an empty body, so always send an explicit empty object.
      body: JSON.stringify({}),
    });
  },
  async scrutinizeApplication(tenantId: string, id: string, payload: ApplicationScrutinyRequest): Promise<Application> {
    return request<Application>(`/tenants/${tenantId}/applications/${id}/scrutiny`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify(payload),
    });
  },
  async submitCorrection(tenantId: string, id: string, payload: ApplicationCorrectionRequest): Promise<Application> {
    return request<Application>(`/tenants/${tenantId}/applications/${id}/correction`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async assessFee(tenantId: string, id: string, payload: FeeAssessmentCreate): Promise<Application> {
    return request<Application>(`/tenants/${tenantId}/applications/${id}/fee`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify(payload),
    });
  },
  async reconcilePayment(tenantId: string, id: string, payload: PaymentReconcileRequest): Promise<Application> {
    return request<Application>(`/tenants/${tenantId}/applications/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async scheduleApplication(tenantId: string, id: string, payload: ApplicationScheduleRequest): Promise<Application> {
    return request<Application>(`/tenants/${tenantId}/applications/${id}/schedule`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify(payload),
    });
  },
};

export const httpVerificationService: IVerificationService = {
  async listSessions(tenantId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<VerificationSession>> {
    return request<PaginatedResponse<VerificationSession>>(`/tenants/${tenantId}/sessions?page=${page}&page_size=${pageSize}`);
  },
  async getSession(tenantId: string, id: string): Promise<VerificationSession> {
    return request<VerificationSession>(`/tenants/${tenantId}/sessions/${id}`);
  },
  async createSession(tenantId: string, payload: SessionCreateRequest): Promise<VerificationSession> {
    return request<VerificationSession>(`/tenants/${tenantId}/sessions`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify(payload),
    });
  },
  async confirmIdentity(tenantId: string, id: string, serialVerified: boolean): Promise<VerificationSession> {
    return request<VerificationSession>(`/tenants/${tenantId}/sessions/${id}/identity?serial_verified=${serialVerified}`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify({}),
    });
  },
  async startSession(tenantId: string, id: string): Promise<VerificationSession> {
    return request<VerificationSession>(`/tenants/${tenantId}/sessions/${id}/start`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify({}),
    });
  },
  async submitObservations(
    tenantId: string,
    id: string,
    payload: SessionObservationSubmitRequest
  ): Promise<VerificationSession> {
    return request<VerificationSession>(`/tenants/${tenantId}/sessions/${id}/observations`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify(payload),
    });
  },
  async recordDisposition(tenantId: string, id: string, payload: SessionDispositionRequest): Promise<VerificationSession> {
    return request<VerificationSession>(`/tenants/${tenantId}/sessions/${id}/disposition`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify(payload),
    });
  },
};

export const httpStampService: IStampService = {
  async recordStampAction(tenantId: string, sessionId: string, payload: PhysicalStampRecordRequest): Promise<PhysicalStamp> {
    return request<PhysicalStamp>(`/tenants/${tenantId}/sessions/${sessionId}/stamps`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify(payload),
    });
  },
  async listSessionStamps(tenantId: string, sessionId: string): Promise<PhysicalStamp[]> {
    return request<PhysicalStamp[]>(`/tenants/${tenantId}/sessions/${sessionId}/stamps`);
  },
};

export const httpCertificateService: ICertificateService = {
  async listCertificates(tenantId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<Certificate>> {
    return request<PaginatedResponse<Certificate>>(`/tenants/${tenantId}/certificates?page=${page}&page_size=${pageSize}`);
  },
  async getCertificate(tenantId: string, id: string): Promise<Certificate> {
    return request<Certificate>(`/tenants/${tenantId}/certificates/${id}`);
  },
  async issueCertificate(tenantId: string, payload: CertificateIssueRequest): Promise<Certificate> {
    return request<Certificate>(`/tenants/${tenantId}/certificates/issue`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify(payload),
    });
  },
  async updateStatus(tenantId: string, id: string, payload: CertificateStatusUpdateRequest): Promise<Certificate> {
    return request<Certificate>(`/tenants/${tenantId}/certificates/${id}/status`, {
      method: 'POST',
      headers: { 'X-Actor-Role': 'LMO' },
      body: JSON.stringify(payload),
    });
  },
};

export const httpPublicVerifyService: IPublicVerifyService = {
  async verifyCertificate(qrReference: string): Promise<PublicCertificateVerifyResponse> {
    return request<PublicCertificateVerifyResponse>(`/public/certificates/verify/${qrReference}`);
  },
};
