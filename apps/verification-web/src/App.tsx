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
  GATC_VERIFIER: ['gatc', 'public'],
  SUPERVISOR: ['supervisor', 'gatc', 'public'],
  CONTROLLER: ['supervisor', 'gatc', 'public'],
  ADMIN: ['trader', 'officer', 'supervisor', 'gatc', 'migration', 'public'],
};

function allowedTabs(role: RoleType): TabId[] {
  return ROLE_TABS[role] || ['public'];
}

function defaultTab(role: RoleType): TabId {
  switch (role) {
    case 'GATC_VERIFIER':
      return 'gatc';
    case 'LMO':
      return 'officer';
    case 'SUPERVISOR':
    case 'CONTROLLER':
      return 'supervisor';
    case 'OWNER':
    case 'APPLICANT':
      return 'trader';
    case 'ADMIN':
      return 'officer';
    default: {
      const tabs = allowedTabs(role);
      return tabs[0] || 'public';
    }
  }
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

  // Handle URL hash & query navigation (e.g. #public?token=..., ?token=..., #/verify/...)
  useEffect(() => {
    const handleNavigation = () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      // Check query params in search (?token=... or ?qr=...)
      const urlParams = new URLSearchParams(search);
      let extractedToken = urlParams.get('token') || urlParams.get('qr');

      // Check query params inside hash (#public?token=... or #/public?token=... or #verify?token=...)
      if (!extractedToken && hash.includes('?')) {
        const hashQuery = hash.substring(hash.indexOf('?'));
        const hashParams = new URLSearchParams(hashQuery);
        extractedToken = hashParams.get('token') || hashParams.get('qr');
      }

      const cleanHash = hash.split('?')[0];

      if (extractedToken) {
        setPublicToken(decodeURIComponent(extractedToken));
        setActiveTab('public');
        return;
      }

      if (cleanHash.startsWith('#/verify/') || cleanHash.startsWith('#verify/')) {
        const token = cleanHash.replace(/^#\/verify\//, '').replace(/^#verify\//, '');
        if (token) {
          setPublicToken(decodeURIComponent(token));
          setActiveTab('public');
        }
      } else if (cleanHash === '#officer') {
        setActiveTab('officer');
      } else if (cleanHash === '#trader') {
        setActiveTab('trader');
      } else if (cleanHash === '#supervisor') {
        setActiveTab('supervisor');
      } else if (cleanHash === '#gatc') {
        setActiveTab('gatc');
      } else if (cleanHash === '#migration') {
        setActiveTab('migration');
      } else if (cleanHash === '#public' || cleanHash === '#/public') {
        setActiveTab('public');
      }
    };

    handleNavigation();
    window.addEventListener('hashchange', handleNavigation);
    window.addEventListener('popstate', handleNavigation);
    return () => {
      window.removeEventListener('hashchange', handleNavigation);
      window.removeEventListener('popstate', handleNavigation);
    };
  }, []);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'public') {
      window.location.hash = '#public?token=' + encodeURIComponent(publicToken);
    } else {
      window.location.hash = '#' + tab;
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-slate-100'>
        <div className='text-slate-500 text-sm font-semibold'>Loading e-Metrology Portal...</div>
      </div>
    );
  }

  // 1. If public verification tab is active and user is NOT logged in, show standalone public layout
  if (activeTab === 'public' && !session) {
    return (
      <div className='min-h-screen flex flex-col bg-slate-100/70 text-slate-900 selection:bg-amber-500 selection:text-slate-950 font-sans'>
        {/* Public National Header */}
        <header className='bg-gov-navy text-white border-b border-slate-700 shadow-md sticky top-0 z-30'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center font-serif text-amber-400 font-bold text-lg'>
                ⚖
              </div>
              <div>
                <h1 className='text-sm font-bold text-white leading-tight flex items-center gap-1.5'>
                  <span>e-Metrology Public Verification</span>
                  <span className='text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-400/30 font-semibold'>
                    OFFICIAL
                  </span>
                </h1>
                <p className='text-[11px] text-slate-300'>Department of Legal Metrology • Government of India</p>
              </div>
            </div>

            <div className='flex items-center gap-2.5'>
              <button
                onClick={() => {
                  window.location.hash = '#trader';
                  setActiveTab('trader');
                }}
                className='px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-xs font-bold text-slate-950 shadow-xs transition-colors'
              >
                Sign In / Portal Login
              </button>
            </div>
          </div>
        </header>

        <main className='flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6'>
          <PublicVerificationPage initialToken={publicToken} />
        </main>
        <Footer />
        <ToastContainer />
      </div>
    );
  }

  // 2. If authenticated portal tabs are requested without session, show Login Page
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
