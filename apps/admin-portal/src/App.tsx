import React, { useState } from 'react';
import { AdminProvider } from './context/AuthContext';
import { AdminLayout, AdminView } from './components/layout/AdminLayout';
import { OverviewDashboard } from './components/overview/OverviewDashboard';
import { EntityBrowser } from './components/browser/EntityBrowser';
import { AuditLogViewer } from './components/audit/AuditLogViewer';
import { HealthPanel } from './components/health/HealthPanel';
import { env } from './config/env';

function AppContent() {
  const [view, setView] = useState<AdminView>('overview');
  const [globalError, setGlobalError] = useState<string | null>(null);

  // If the backend rejects the ADMIN role entirely (e.g. auth misconfig), show a clear gate.
  React.useEffect(() => {
    void apiProbe().then((ok) => {
      if (!ok) setGlobalError('This portal is restricted to the ADMIN role. Access denied by the server.');
    });
  }, []);

  return (
    <AdminLayout view={view} onNavigate={setView}>
      {globalError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{globalError}</div>
      ) : (
        <>
          {view === 'overview' && <OverviewDashboard />}
          {view === 'database' && <EntityBrowser />}
          {view === 'audit' && <AuditLogViewer />}
          {view === 'health' && <HealthPanel />}
        </>
      )}
      <footer className="mt-10 pt-4 border-t border-gov-border text-xs text-slate-400">
        {env.APP_NAME} · {env.PORTAL_VERSION} · Access restricted to authorized system administrators. Every action is audited.
      </footer>
    </AdminLayout>
  );
}

async function apiProbe(): Promise<boolean> {
  try {
    const res = await fetch(`${env.API_BASE_URL}/admin/health`, {
      headers: {
        'X-Actor-Role': 'ADMIN',
        'X-Actor-Id': env.ADMIN_ACTOR_ID,
        'X-Tenant-Id': env.DEFAULT_TENANT_ID,
      },
    });
    return true; // any response (even 403) means server reachable; admin UI shows 403 states per-call otherwise
  } catch {
    return false;
  }
}

export const App: React.FC = () => {
  return (
    <AdminProvider>
      <ApiErrorBoundary>
        <AppContent />
      </ApiErrorBoundary>
    </AdminProvider>
  );
};

// Lightweight error boundary so an unexpected render crash does not blank the page.
class ApiErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.error) {
      return <div className="p-8 text-sm text-red-700">Unexpected error: {this.state.error}</div>;
    }
    return this.props.children;
  }
}

export default App;