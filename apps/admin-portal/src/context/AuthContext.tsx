import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { env } from '../config/env';

let _currentAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return _currentAccessToken;
}

export function setAccessToken(token: string | null) {
  _currentAccessToken = token;
}

export interface AuthContextType {
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  user: { actorId: string; tenantId: string; email: string; fullName: string };
}

const API = env.API_BASE_URL.replace(/\/+$/, '');
const AuthContext = createContext<AuthContextType | undefined>(undefined);
let refreshPromise: Promise<string | null> | null = null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ actorId: string; tenantId: string; email: string; fullName: string } | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API}/auth/refresh`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return null;
        const body = await res.json();
        if (body.accessToken) {
          setAccessToken(body.accessToken);
          setIsAuthenticated(true);
          if (body.user) setUser({ actorId: body.user.id, tenantId: body.user.tenantId, email: body.user.email, fullName: body.user.fullName });
          return body.accessToken;
        }
        return null;
      } catch { return null; }
      finally { refreshPromise = null; }
    })();
    return refreshPromise;
  }, []);

  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const ttl = (payload.exp * 1000) - Date.now();
      if (ttl <= 0) return;
      const refreshIn = Math.min(ttl - 30000, ttl * 0.75);
      if (refreshIn <= 0) return;
      refreshTimer.current = setTimeout(async () => {
        const nt = await doRefresh();
        if (nt) scheduleRefresh(nt); else clearAuth();
      }, refreshIn);
    } catch { /* */ }
  }, [doRefresh, clearAuth]);

  useEffect(() => {
    (async () => {
      const token = await doRefresh();
      if (token) scheduleRefresh(token);
      setLoading(false);
    })();
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [doRefresh, scheduleRefresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) { const b = await res.json(); throw new Error(b.detail || 'Login failed'); }
    const body = await res.json();
    setAccessToken(body.accessToken);
    setIsAuthenticated(true);
    setUser({ actorId: body.user.id, tenantId: body.user.tenantId, email: body.user.email, fullName: body.user.fullName });
    scheduleRefresh(body.accessToken);
  }, [scheduleRefresh]);

  const logout = useCallback(async () => {
    try { await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }); } catch { /* */ }
    clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{ loading, login, logout, isAuthenticated, user: user || { actorId: '', tenantId: '', email: '', fullName: '' } }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}