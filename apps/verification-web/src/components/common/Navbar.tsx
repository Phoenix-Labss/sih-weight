import React, { useState } from 'react';
import {
  Scale,
  ShieldCheck,
  QrCode,
  UserCheck,
  Database,
  Building2,
  ChevronDown,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RoleType } from '../../types/api';
import { useNotification } from '../../context/NotificationContext';
import { useApiMode } from '../../context/ApiModeContext';
import { mockDb } from '../../api/mock/mockDb';
import { useTranslation, Language } from '../../i18n';

interface NavbarProps {
  activeTab: 'trader' | 'officer' | 'public' | 'database' | 'supervisor' | 'gatc' | 'migration';
  setActiveTab: (tab: 'trader' | 'officer' | 'public' | 'database' | 'supervisor' | 'gatc' | 'migration') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, switchRole } = useAuth();
  const { notify } = useNotification();
  const { language, setLanguage, t } = useTranslation();
  const { mode: apiModeState, toggleMode } = useApiMode();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const handleToggleApiMode = () => {
    const nextMode = apiModeState === 'mock' ? 'api' : 'mock';
    toggleMode();
    notify(
      'info',
      `Switched to ${nextMode.toUpperCase()} Mode`,
      nextMode === 'mock'
        ? 'Using reactive client-side mock metrology database'
        : 'Connecting directly to FastAPI control plane at http://localhost:8000/api/v1'
    );
  };

  const handleResetMockDb = () => {
    mockDb.resetToDefaults();
    notify('success', 'Mock Database Reset', 'Re-initialized sample instruments, applications and certificates.');
    window.location.reload();
  };

  const roles: { role: RoleType; label: string; desc: string }[] = [
    { role: 'OWNER', label: 'Trader / Instrument Owner', desc: 'Self-service registration & applications' },
    { role: 'APPLICANT', label: 'Authorized Dealer / Repairer', desc: 'Third-party representative' },
    { role: 'LMO', label: 'Legal Metrology Officer (LMO)', desc: 'Scrutiny, NAWI testing & physical stamping' },
    { role: 'GATC_VERIFIER', label: 'GATC Approved Verifier', desc: 'Government Approved Test Centre verifier' },
    { role: 'SUPERVISOR', label: 'Assistant Controller / Supervisor', desc: 'Inspection oversight & review' },
    { role: 'CONTROLLER', label: 'Controller of Legal Metrology', desc: 'Statutory enforcement & appeals' },
    { role: 'ADMIN', label: 'System Administrator', desc: 'Jurisdiction & tenant configurations' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-gov-navy text-white shadow-lg border-b border-slate-800/80 select-none">
      {/* Top Ministry Banner */}
      <div className="bg-slate-950/70 px-4 sm:px-6 lg:px-8 py-1 text-[11px] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="font-semibold text-amber-400">{t.govOfIndia}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300 hidden sm:inline">{t.ministryName}</span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-slate-300">{t.deptName}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-300 shrink-0">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400 hidden md:inline">{t.jurisdictionLabel}</span>
            <span className="font-mono text-amber-300 text-[11px]">NCT Delhi (Central Zone - JUR-DL-01)</span>
          </div>
          <button
            onClick={handleResetMockDb}
            title="Reset sample fixtures in mock database"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">{t.resetDemoDb}</span>
          </button>
        </div>
      </div>

      {/* Main Nav Bar */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[4.25rem] py-2 gap-3">
          {/* Brand / Logo */}
          <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => setActiveTab('trader')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-gov-navy rounded-[10px] flex items-center justify-center">
                <Scale className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white whitespace-nowrap leading-none">
                  {t.brandTitle}
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 whitespace-nowrap leading-none tracking-wider uppercase">
                  {t.nationalPlatform}
                </span>
              </div>
              <p className="text-[11px] text-slate-300/85 whitespace-nowrap font-normal leading-tight mt-1">
                {t.brandSubtitle}
              </p>
            </div>
          </div>

          {/* Primary View Navigation Tabs */}
          <nav className="hidden xl:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setActiveTab('trader')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'trader'
                  ? 'bg-gov-blue text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.navTrader}</span>
            </button>

            <button
              onClick={() => setActiveTab('officer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'officer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>{t.navOfficer}</span>
            </button>

            <button
              onClick={() => setActiveTab('supervisor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'supervisor'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-300" />
              <span>{t.navSupervisor}</span>
            </button>

            <button
              onClick={() => setActiveTab('gatc')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'gatc'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-teal-300" />
              <span>{t.navGATC}</span>
            </button>

            <button
              onClick={() => setActiveTab('migration')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'migration'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-blue-300" />
              <span>{t.navMigration}</span>
            </button>

            <button
              onClick={() => setActiveTab('public')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'public'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-white" />
              <span>{t.navPublicQR}</span>
            </button>
          </nav>

          {/* Right Controls: Language Switcher, Mode Toggle & Persona Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Language Switcher (EN | हिन्दी) */}
            <div className="flex items-center bg-slate-900 border border-white/15 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  language === 'en' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('hi')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  language === 'hi' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                हिन्दी
              </button>
            </div>

            {/* Live / Mock API Toggle */}
            <button
              onClick={handleToggleApiMode}
              title={`Toggle between Mock & Live FastAPI. Currently: ${apiModeState.toUpperCase()}`}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                apiModeState === 'api'
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                  : 'bg-amber-950/70 border-amber-500 text-amber-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${apiModeState === 'api' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{apiModeState === 'api' ? t.liveApi : t.mockPreview}</span>
            </button>

            {/* Role Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 border border-white/15 px-3 py-1.5 rounded-lg text-xs transition-all text-left shadow-sm"
              >
                <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="hidden sm:block">
                  <div className="font-bold text-white leading-tight">{user.actorName.split(' ')[0]}</div>
                  <div className="text-[10px] text-amber-300 font-mono">{user.actorRole}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {isRoleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      <span>{t.switchPersona}</span>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>

                  <div className="py-1">
                    {roles.map((r) => {
                      const isSelected = user.actorRole === r.role;
                      return (
                        <button
                          key={r.role}
                          onClick={() => {
                            switchRole(r.role);
                            setIsRoleDropdownOpen(false);
                            if (r.role === 'LMO' || r.role === 'GATC_VERIFIER') {
                              setActiveTab('officer');
                            } else if (r.role === 'OWNER' || r.role === 'APPLICANT') {
                              setActiveTab('trader');
                            }
                            notify('info', `Active Persona: ${r.label}`, r.desc);
                          }}
                          className={`w-full text-left px-4 py-2 text-xs flex flex-col gap-0.5 hover:bg-slate-100 transition-colors ${
                            isSelected ? 'bg-amber-50/80 font-bold text-gov-navy' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{r.label}</span>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                          </div>
                          <span className="text-[10px] text-slate-500 font-normal">{r.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Responsive Navigation Bar (for medium & smaller screens) */}
      <div className="xl:hidden flex items-center gap-1 bg-slate-900/95 px-3 py-1.5 border-t border-white/10 text-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('trader')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-all ${activeTab === 'trader' ? 'bg-gov-blue text-white font-bold' : 'text-slate-300 hover:text-white'}`}
        >
          {t.navTrader}
        </button>
        <button
          onClick={() => setActiveTab('officer')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-all ${activeTab === 'officer' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:text-white'}`}
        >
          {t.navOfficer}
        </button>
        <button
          onClick={() => setActiveTab('supervisor')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-all ${activeTab === 'supervisor' ? 'bg-purple-600 text-white font-bold' : 'text-slate-300 hover:text-white'}`}
        >
          {t.navSupervisor}
        </button>
        <button
          onClick={() => setActiveTab('gatc')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-all ${activeTab === 'gatc' ? 'bg-teal-600 text-white font-bold' : 'text-slate-300 hover:text-white'}`}
        >
          {t.navGATC}
        </button>
        <button
          onClick={() => setActiveTab('migration')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-all ${activeTab === 'migration' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'}`}
        >
          {t.navMigration}
        </button>
        <button
          onClick={() => setActiveTab('public')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-all ${activeTab === 'public' ? 'bg-amber-600 text-white font-bold' : 'text-slate-300 hover:text-white'}`}
        >
          {t.navPublicQR}
        </button>
      </div>
    </header>
  );
};
