function normalizeApiBaseUrl(raw?: string): string {
  if (!raw) return 'http://127.0.0.1:8000/api/v1';
  let url = raw.trim();
  url = url.replace(/([^:])\/{2,}/g, '$1/');
  url = url.replace(/\/+$/, '');
  return url;
}

export const env = {
  API_BASE_URL: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string),
  DEFAULT_TENANT_ID: (import.meta.env.VITE_DEFAULT_TENANT_ID as string) || 'tenant-delhi-central',
  DEFAULT_JURISDICTION_ID: (import.meta.env.VITE_DEFAULT_JURISDICTION_ID as string) || 'jur-dl-01',
  ADMIN_ACTOR_ID: (import.meta.env.VITE_ADMIN_ACTOR_ID as string) || 'adm-system-01',
  APP_NAME: 'e-Metrology Admin Control Plane',
  PORTAL_VERSION: 'v1.0.0-admin',
};