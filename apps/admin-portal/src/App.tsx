import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminLayout, AdminView } from './components/layout/AdminLayout';
import { OverviewDashboard } from './components/overview/OverviewDashboard';
import { EntityBrowser } from './components/browser/EntityBrowser';
import { AuditLogViewer } from './components/audit/AuditLogViewer';
import { HealthPanel } from './components/health/HealthPanel';
import { LoginPage } from './components/LoginPage';
import { env } from './config/env';

function AppContent() {
  const { loading, isAuthenticated } = useAuth();
  const [view, setView] = useState<AdminView>('overview');

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100"><div className="text-slate-500 text-sm">Loading...</div></div>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AdminLayout view={view} onNavigate={setView}>
      {view === 'overview' && <OverviewDashboard />}
      {view === 'database' && <EntityBrowser />}
      {view === 'audit' && <AuditLogViewer />}
      {view === 'health' && <HealthPanel />}
    </AdminLayout>
  );
}

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AuthProvider>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(err: unknown) { return { error: err instanceof Error ? err.message : String(err) }; }
  render() {
    if (this.state.error) return <div className="p-8 text-sm text-red-700">Unexpected error: {this.state.error}</div>;
    return this.props.children;
  }
}

export default App;