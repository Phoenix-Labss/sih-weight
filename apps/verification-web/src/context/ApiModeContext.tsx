import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiMode, setApiMode as setClientApiMode } from '../api/client';
import { env } from '../config/env';

export type ApiMode = 'mock' | 'api';

interface ApiModeContextType {
  mode: ApiMode;
  setMode: (mode: ApiMode) => void;
  toggleMode: () => void;
  version: number;
}

const ApiModeContext = createContext<ApiModeContextType>({
  mode: 'mock',
  setMode: () => {},
  toggleMode: () => {},
  version: 0,
});

export const ApiModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ApiMode>(() => {
    try {
      const stored = localStorage.getItem('api_mode') as ApiMode | null;
      if (stored === 'mock' || stored === 'api') return stored;
    } catch {
      // Ignore
    }
    return getApiMode();
  });
  const [version, setVersion] = useState(0);

  const setMode = (newMode: ApiMode) => {
    setClientApiMode(newMode);
    setModeState(newMode);
    setVersion((v) => v + 1);
    try {
      localStorage.setItem('api_mode', newMode);
    } catch {
      // Ignore
    }
  };

  const toggleMode = () => {
    const next = mode === 'mock' ? 'api' : 'mock';
    setMode(next);
  };

  useEffect(() => {
    setClientApiMode(mode);
  }, [mode]);

  // Auto-detect a reachable backend on first visit. If the user has not made
  // an explicit Mock/Live choice (no stored preference), prefer the live API
  // so statutory actions persist to the real control plane instead of the
  // in-memory mock, which resets on reload.
  useEffect(() => {
    let explicit = false;
    try {
      explicit = localStorage.getItem('api_mode') === 'mock' || localStorage.getItem('api_mode') === 'api';
    } catch {
      // Ignore
    }
    if (explicit) return;

    const probe = `${env.API_BASE_URL.replace(/\/+$/, '')}/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch(probe, { signal: controller.signal })
      .then((res) => {
        clearTimeout(timer);
        if (res.ok) setMode('api');
      })
      .catch(() => {
        // Backend unreachable - stay in mock mode
      });
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ApiModeContext.Provider value={{ mode, setMode, toggleMode, version }}>
      {children}
    </ApiModeContext.Provider>
  );
};

export const useApiMode = () => useContext(ApiModeContext);
