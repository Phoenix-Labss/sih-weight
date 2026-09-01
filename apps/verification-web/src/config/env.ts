export interface AppConfig {
  API_BASE_URL: string;
  API_MODE: 'mock' | 'api' | 'auto';
  DEFAULT_TENANT_ID: string;
  DEFAULT_JURISDICTION_ID: string;
  APP_NAME: string;
  PORTAL_VERSION: string;
}

function normalizeApiBaseUrl(raw?: string): string {
  if (!raw) return 'http://localhost:8000/api/v1';
  let url = raw.trim();
  url = url.replace(/([^:])\/{2,}/g, '$1/');
  url = url.replace(/\/+$/, '');
  return url;
}

export const env: AppConfig = {
  API_BASE_URL: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string),
  API_MODE: (import.meta.env.VITE_API_MODE as 'mock' | 'api' | 'auto') || 'auto',
  DEFAULT_TENANT_ID: (import.meta.env.VITE_DEFAULT_TENANT_ID as string) || 'tenant-delhi-central',
  DEFAULT_JURISDICTION_ID: (import.meta.env.VITE_DEFAULT_JURISDICTION_ID as string) || 'jur-dl-01',
  APP_NAME: 'National Legal Metrology Verification & Certification Portal',
  PORTAL_VERSION: 'v2.4.0-phase2',
};
