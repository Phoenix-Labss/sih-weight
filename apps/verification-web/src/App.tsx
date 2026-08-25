import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { ToastContainer } from './components/common/Toast';
import { LoginPage } from './components/common/LoginPage';
import { TraderDashboard } from './components/trader/TraderDashboard';
import { OfficerWorkspace } from './components/officer/OfficerWorkspace';
import { PublicVerificationPage } from './components/public/PublicVerificationPage';
import { SupervisorDashboard } from './components/supervisor/SupervisorDashboard';
import { GATCManagement } from './components/gatc/GATCManagement';
import { LegacyMigrationConsole } from './components/migration/LegacyMigrationConsole';
import { RoleType } from './types/api';
import { I18nProvider } from './i18n';
import { ApiModeProvider } from './context/ApiModeContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export type TabId = 'trader' | 'officer' | 'public' | 'supervisor' | 'gatc' | 'migration';

// Role-to-tab permission matrix: which tabs each role can see
const ROLE_TABS: Record<string, TabId[]> = {
  OWNER: ['trader', 'public'],
  APPLICANT: ['trader', 'public'],
  LMO: ['officer', 'public'],
  GATC_VERIFIER: ['officer', 'public'],
  SUPERVISOR: ['supervisor', 'public'],
  CONTROLLER: ['supervisor', 'public'],
  ADMIN: ['trader', 'officer', 'supervisor', 'gatc', 'migration', 'public'],
};

function allowedTabs(role: RoleType): TabId[] {
  return ROLE_TABS[role] || ['public'];
}

function defaultTab(role: RoleType): TabId {
  const tabs = allowedTabs(role);
  if (tabs.includes('trader')) return 'trader';
  if (tabs.includes('officer')) return 'officer';
  if (tabs.includes('supervisor')) return 'supervisor';
  return 'public';
}

const AppContent: React.FC = () => {
  const { session, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('trader');
  const [publicToken, setPublicToken] = useState<string>('TOKEN_VALID_2026');

  // When session loads, set default tab for the role
  useEffect(() => {
    if (session) {
      setActiveTab(defaultTab(session.user.actorRole));
    }
  }, [session]);

  // Handle URL hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/verify/') || hash.startsWith('#verify/')) {
        const token = hash.replace(/^#\/verify\//, '').replace(/^#verify\//, '');
        if (token) {
          setPublicToken(decodeURIComponent(token));
          setActiveTab('public');
        }
      } else if (hash === '#officer') {
        setActiveTab('officer');
      } else if (hash === '#trader') {
        setActiveTab('trader');
      } else if (hash === '#supervisor') {
        setActiveTab('supervisor');
      } else if (hash === '#gatc') {
        setActiveTab('gatc');
      } else if (hash === '#migration') {
        setActiveTab('migration');
      } else if (hash === '#public') {
        setActiveTab('public');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'public') {
      window.location.hash = '#/verify/' + publicToken;
    } else {
      window.location.hash = '#' + tab;
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-slate-100'>
        <div className='text-slate-500 text-sm'>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const role = session.user.actorRole;
  const tabs = allowedTabs(role);

  return (
    <div className='min-h-screen flex flex-col bg-slate-100/70 text-slate-900 selection:bg-amber-500 selection:text-slate-950 font-sans'>
      <Navbar activeTab={activeTab} setActiveTab={handleTabChange} allowedTabs={tabs} onLogout={logout} />
      <main className='flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6'>
        {activeTab === 'trader' && tabs.includes('trader') && <TraderDashboard />}
        {activeTab === 'officer' && tabs.includes('officer') && <OfficerWorkspace />}
        {activeTab === 'supervisor' && tabs.includes('supervisor') && <SupervisorDashboard />}
        {activeTab === 'gatc' && tabs.includes('gatc') && <GATCManagement />}
        {activeTab === 'migration' && tabs.includes('migration') && <LegacyMigrationConsole />}
        {activeTab === 'public' && <PublicVerificationPage initialToken={publicToken} />}
      </main>
      <Footer />
      <ToastContainer />
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ApiModeProvider>
          <NotificationProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </NotificationProvider>
        </ApiModeProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;
