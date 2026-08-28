import React, { useState } from 'react';
import { Scale, ShieldCheck, QrCode, UserCheck, Building2, LogOut, Menu, X, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { TabId } from '../../App';
import { api } from '../../api/client';

interface NavbarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  allowedTabs: TabId[];
  onLogout: () => void;
}

const TAB_LABELS: Record<TabId, string> = {
  trader: 'Trader Portal',
  officer: 'Officer Workspace',
  supervisor: 'Supervisor / SLA',
  gatc: 'GATC Centers',
  migration: 'Legacy Migration',
  public: 'Public QR Verify',
};

const TAB_ICONS: Record<TabId, React.ReactNode> = {
  trader: <Building2 className="h-4 w-4" />,
  officer: <ShieldCheck className="h-4 w-4" />,
  supervisor: <UserCheck className="h-4 w-4" />,
  gatc: <Scale className="h-4 w-4" />,
  migration: <Building2 className="h-4 w-4" />,
  public: <QrCode className="h-4 w-4" />,
};

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, allowedTabs, onLogout }) => {
  const { session } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 bg-gov-navy text-white shadow-lg border-b border-slate-800/80 select-none">
      <div className="bg-slate-950/70 px-4 sm:px-6 lg:px-8 py-1 text-[11px] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-400">{t.govOfIndia}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300 hidden sm:inline">{t.ministryName}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-300 shrink-0">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px]">{user?.tenantId}</span>
          </div>
          <button
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 text-[10px] font-bold hover:bg-slate-700"
          >
            {language === 'en' ? 'HINDI' : 'EN'}
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab(allowedTabs[0] || 'public')}>
            <Scale className="w-6 h-6 text-amber-400" />
            <div className="hidden sm:block">
              <span className="font-bold text-sm tracking-tight">{t.brandTitle}</span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">{t.brandSubtitle}</span>
            </div>
          </div>
          <nav className="hidden xl:flex items-center gap-1">
            {allowedTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === tab
                    ? 'bg-gov-blue text-white font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {TAB_ICONS[tab]}
                {TAB_LABELS[tab]}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
              {user?.actorRole}
            </span>
            <span className="text-slate-400">{user?.actorName}</span>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Reset all demo & verification data back to a completely clean slate?')) {
                api.system.resetAllData();
              }
            }}
            className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
            title="Wipe mock database and reset to clean state"
          >
            <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
            <span>Reset Data</span>
          </button>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1 rounded-lg bg-red-700/80 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.logoutButton}</span>
          </button>
          <button
            className="xl:hidden p-1.5 rounded hover:bg-slate-800"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="xl:hidden bg-slate-900/95 border-t border-white/10 px-4 py-2 space-y-1">
          {allowedTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setMobileMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2 rounded text-xs font-medium ${
                activeTab === tab ? 'bg-gov-blue/20 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {TAB_ICONS[tab]}
                {TAB_LABELS[tab]}
              </span>
            </button>
          ))}
          <div className="border-t border-slate-700 pt-2 mt-2 text-xs text-slate-400">
            {user?.actorRole} - {user?.actorName}
          </div>
        </div>
      )}
    </header>
  );
};