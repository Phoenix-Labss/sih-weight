import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { RoleType, UserContextData } from '../types/api';
import { env } from '../config/env';

// Module-level token storage so http.ts can read the current access token
let _currentAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return _currentAccessToken;
}

export function setAccessToken(token: string | null) {
  _currentAccessToken = token;
}

export interface AuthSession {
  user: UserContextData;
  accessToken: string;
}

export interface AuthContextType {
  session: AuthSession | null;
  user: UserContextData;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const API = env.API_BASE_URL.replace(/\/+$/, '');
const AuthContext = createContext<AuthContextType | undefined>(undefined);
let refreshPromise: Promise<string | null> | null = null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setSession(null);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return null;
        const body = await res.json();
        if (body.accessToken) {
          setAccessToken(body.accessToken);
          if (body.user) {
            setSession({
              accessToken: body.accessToken,
              user: {
                actorId: body.user.id,
                actorRole: body.user.role,
                actorName: body.user.fullName,
                tenantId: body.user.tenantId,
                jurisdictionId: body.user.jurisdictionId || env.DEFAULT_JURISDICTION_ID,
                organizationName: body.user.organizationName || '',
              },
            });
          }
          return body.accessToken;
        }
        return null;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  }, [API]);

  const schedulePreemptiveRefresh = useCallback((token: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      const ttl = exp - Date.now();
      if (ttl <= 0) return;
      const refreshIn = Math.min(ttl - 30000, ttl * 0.75);
      if (refreshIn <= 0) return;
      refreshTimer.current = setTimeout(async () => {
        const newToken = await refreshToken();
        if (newToken) schedulePreemptiveRefresh(newToken);
        else clearSession();
      }, refreshIn);
    } catch {
      // ignore parse errors
    }
  }, [refreshToken, clearSession]);

  useEffect(() => {
    (async () => {
      const token = await refreshToken();
      if (token) schedulePreemptiveRefresh(token);
      setLoading(false);
    })();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [refreshToken, schedulePreemptiveRefresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || 'Login failed');
    const ns: AuthSession = {
      accessToken: body.accessToken,
      user: {
        actorId: body.user.id,
        actorRole: body.user.role,
        actorName: body.user.fullName,
        tenantId: body.user.tenantId,
        jurisdictionId: body.user.jurisdictionId || env.DEFAULT_JURISDICTION_ID,
        organizationName: '',
      },
    };
    setAccessToken(ns.accessToken);
    setSession(ns);
    schedulePreemptiveRefresh(ns.accessToken);
  }, [API, schedulePreemptiveRefresh]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // ignore
    }
    clearSession();
  }, [API, clearSession]);

  return (
    <AuthContext.Provider value={{ session, loading, login, logout, refreshToken, user: session?.user || { actorId: '', actorRole: 'PUBLIC' as RoleType, actorName: '', tenantId: '', jurisdictionId: '', organizationName: '' } }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}