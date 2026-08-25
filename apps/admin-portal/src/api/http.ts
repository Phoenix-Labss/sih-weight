import { env } from '../config/env';
import { getAccessToken, setAccessToken } from '../context/AuthContext';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const API = env.API_BASE_URL.replace(/\/+$/, '');
let _refreshPromise: Promise<boolean> | null = null;

async function trySilentRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;
      const body = await res.json();
      if (body.accessToken) { setAccessToken(body.accessToken); return true; }
      return false;
    } catch { return false; }
    finally { _refreshPromise = null; }
  })();
  return _refreshPromise;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API}${path}`;
  const token = getAccessToken();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Dev fallback for backward compatibility
    headers['X-Actor-Id'] = env.ADMIN_ACTOR_ID;
    headers['X-Actor-Role'] = 'ADMIN';
    headers['X-Tenant-Id'] = env.DEFAULT_TENANT_ID;
    headers['X-Jurisdiction-Id'] = env.DEFAULT_JURISDICTION_ID;
  }

  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) as Record<string, string> } });

  if (response.status === 401 && token) {
    const refreshed = await trySilentRefresh();
    if (refreshed) {
      const nt = getAccessToken();
      if (nt) {
        headers['Authorization'] = `Bearer ${nt}`;
        const retry = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) as Record<string, string> } });
        if (retry.ok) return retry.json();
        let d = retry.statusText;
        try { const j = await retry.json(); d = j.detail || JSON.stringify(j); } catch { /* */ }
        throw new ApiError(retry.status, d);
      }
    }
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  if (!response.ok) {
    let detail = response.statusText;
    try { const j = await response.json(); detail = j.detail || JSON.stringify(j); } catch { /* */ }
    throw new ApiError(response.status, detail);
  }

  return response.json();
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}