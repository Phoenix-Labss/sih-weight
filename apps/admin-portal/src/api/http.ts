import { env } from '../config/env';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Sends only ADMIN role headers; the backend independently rejects every non-ADMIN call. */
function adminHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Actor-Id': env.ADMIN_ACTOR_ID,
    'X-Actor-Role': 'ADMIN',
    'X-Tenant-Id': env.DEFAULT_TENANT_ID,
    'X-Jurisdiction-Id': env.DEFAULT_JURISDICTION_ID,
  };
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${env.API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: { ...adminHeaders(), ...(options.headers || {}) },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (body && typeof body.detail === 'string') detail = body.detail;
      else if (body && body.error) detail = `${body.error}: ${detail}`;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}