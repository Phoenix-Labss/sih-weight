import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { ToastContainer } from './components/common/Toast';
import { TraderDashboard } from './components/trader/TraderDashboard';
import { OfficerWorkspace } from './components/officer/OfficerWorkspace';
import { PublicVerificationPage } from './components/public/PublicVerificationPage';
import { SupervisorDashboard } from './components/supervisor/SupervisorDashboard';
import { GATCManagement } from './components/gatc/GATCManagement';
import { LegacyMigrationConsole } from './components/migration/LegacyMigrationConsole';

const AppContent: React.FC = () => {
  const { user, switchRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'trader' | 'officer' | 'public' | 'database' | 'supervisor' | 'gatc' | 'migration'>('trader');
  const [publicToken, setPublicToken] = useState<string>('TOKEN_VALID_2026');

  // Handle URL hash navigation & deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/verify/') || hash.startsWith('#verify/')) {
        const token = hash.replace(/^#\/?verify\//, '');
        if (token) {
          setPublicToken(decodeURIComponent(token));
          setActiveTab('public');
        }
      } else if (hash === '#officer') {
        setActiveTab('officer');
        if (user.actorRole !== 'LMO') switchRole('LMO');
      } else if (hash === '#trader') {
        setActiveTab('trader');
        if (user.actorRole !== 'OWNER' && user.actorRole !== 'APPLICANT') switchRole('OWNER');
      } else if (hash === '#supervisor') {
        setActiveTab('supervisor');
        if (user.actorRole !== 'SUPERVISOR') switchRole('SUPERVISOR');
      } else if (hash === '#gatc') {
        setActiveTab('gatc');
        if (user.actorRole !== 'GATC_VERIFIER') switchRole('GATC_VERIFIER');
      } else if (hash === '#migration') {
        setActiveTab('migration');
        if (user.actorRole !== 'ADMIN') switchRole('ADMIN');
      } else if (hash === '#public') {
        setActiveTab('public');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user.actorRole, switchRole]);

  const handleTabChange = (tab: 'trader' | 'officer' | 'public' | 'database' | 'supervisor' | 'gatc' | 'migration') => {
    setActiveTab(tab);
    if (tab === 'officer' || tab === 'database') {
      if (user.actorRole !== 'LMO') switchRole('LMO');
    } else if (tab === 'trader') {
      if (user.actorRole !== 'OWNER' && user.actorRole !== 'APPLICANT') switchRole('OWNER');
    } else if (tab === 'supervisor') {
      if (user.actorRole !== 'SUPERVISOR') switchRole('SUPERVISOR');
    } else if (tab === 'gatc') {
      if (user.actorRole !== 'GATC_VERIFIER') switchRole('GATC_VERIFIER');
    } else if (tab === 'migration') {
      if (user.actorRole !== 'ADMIN') switchRole('ADMIN');
    }

    if (tab === 'public') {
      window.location.hash = `#/verify/${publicToken}`;
    } else {
      window.location.hash = `#${tab}`;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 text-slate-900 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <Navbar activeTab={activeTab} setActiveTab={handleTabChange} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'trader' && <TraderDashboard />}
        {activeTab === 'officer' && <OfficerWorkspace />}
        {activeTab === 'supervisor' && <SupervisorDashboard />}
        {activeTab === 'gatc' && <GATCManagement />}
        {activeTab === 'migration' && <LegacyMigrationConsole />}
        {activeTab === 'public' && <PublicVerificationPage initialToken={publicToken} />}
        {activeTab === 'database' && <OfficerWorkspace />}
      </main>

      <Footer />
      <ToastContainer />
    </div>
  );
};

import { I18nProvider } from './i18n';
import { ApiModeProvider } from './context/ApiModeContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

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
