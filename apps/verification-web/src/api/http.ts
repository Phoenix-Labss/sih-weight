import { env } from '../config/env';
import { getAccessToken, setAccessToken } from '../context/AuthContext';
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

const API = env.API_BASE_URL.replace(/\/+$/, '');
let _refreshPromise: Promise<boolean> | null = null;

async function trySilentRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;
      const body = await res.json();
      if (body.accessToken) {
        setAccessToken(body.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API}${endpoint}`;
  const token = getAccessToken();
  const explicitHeaders = (options.headers || {}) as Record<string, string>;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  } else {
    // Dev fallback for backward compatibility
    let activeRole = 'OWNER';
    let activeActorId = 'usr-trader-01';
    let activeTenant = env.DEFAULT_TENANT_ID;
    try {
      activeRole = localStorage.getItem('auth_role') || 'OWNER';
      activeActorId = localStorage.getItem('auth_actor_id') || 'usr-trader-01';
      activeTenant = localStorage.getItem('auth_tenant_id') || env.DEFAULT_TENANT_ID;
    } catch { /* ignore */ }
    defaultHeaders['X-Actor-Id'] = explicitHeaders['X-Actor-Id'] || activeActorId;
    defaultHeaders['X-Actor-Role'] = explicitHeaders['X-Actor-Role'] || activeRole;
    defaultHeaders['X-Tenant-Id'] = explicitHeaders['X-Tenant-Id'] || activeTenant;
    defaultHeaders['X-Jurisdiction-Id'] = env.DEFAULT_JURISDICTION_ID;
  }

  const response = await fetch(url, { ...options, headers: { ...defaultHeaders, ...explicitHeaders } });

  if (response.status === 401 && token) {
    const refreshed = await trySilentRefresh();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        defaultHeaders['Authorization'] = `Bearer ${newToken}`;
        const retryRes = await fetch(url, { ...options, headers: { ...defaultHeaders, ...explicitHeaders } });
        if (retryRes.ok) return retryRes.json();
        let detail = retryRes.statusText;
        try { const ej = await retryRes.json(); detail = ej.detail || JSON.stringify(ej); } catch { /* */ }
        throw new HttpError(retryRes.status, `API error (${retryRes.status}): ${detail}`);
      }
    }
    throw new HttpError(401, 'Session expired. Please log in again.');
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const ej = await response.json();
      detail =
        ej.message ||
        ej.error_description ||
        ej.detail ||
        (typeof ej.error === 'string' ? ej.error : '') ||
        JSON.stringify(ej);
    } catch {
      /* ignore */
    }
    throw new HttpError(response.status, detail || `HTTP error ${response.status}`);
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
    return request<InstrumentModel[]>('/tenants/tenant-delhi-central/instruments/models');
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
      body: JSON.stringify({}),
    });
  },
  async scrutinizeApplication(tenantId: string, id: string, payload: ApplicationScrutinyRequest): Promise<Application> {
    return request<Application>(`/tenants/${tenantId}/applications/${id}/scrutiny`, {
      method: 'POST',
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
      body: JSON.stringify(payload),
    });
  },
  async confirmIdentity(tenantId: string, id: string, serialVerified: boolean): Promise<VerificationSession> {
    return request<VerificationSession>(`/tenants/${tenantId}/sessions/${id}/identity?serial_verified=${serialVerified}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
  async startSession(tenantId: string, id: string): Promise<VerificationSession> {
    return request<VerificationSession>(`/tenants/${tenantId}/sessions/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
  async submitObservations(tenantId: string, id: string, payload: SessionObservationSubmitRequest): Promise<VerificationSession> {
    return request<VerificationSession>(`/tenants/${tenantId}/sessions/${id}/observations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async recordDisposition(tenantId: string, id: string, payload: SessionDispositionRequest): Promise<VerificationSession> {
    return request<VerificationSession>(`/tenants/${tenantId}/sessions/${id}/disposition`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const httpStampService: IStampService = {
  async recordStampAction(tenantId: string, sessionId: string, payload: PhysicalStampRecordRequest): Promise<PhysicalStamp> {
    return request<PhysicalStamp>(`/tenants/${tenantId}/sessions/${sessionId}/stamps`, {
      method: 'POST',
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
      body: JSON.stringify(payload),
    });
  },
  async updateStatus(tenantId: string, id: string, payload: CertificateStatusUpdateRequest): Promise<Certificate> {
    return request<Certificate>(`/tenants/${tenantId}/certificates/${id}/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const httpPublicVerifyService: IPublicVerifyService = {
  async verifyCertificate(qrReference: string): Promise<PublicCertificateVerifyResponse> {
    return request<PublicCertificateVerifyResponse>(`/public/certificates/verify/${qrReference}`);
  },
};