import React, { useState } from 'react';
import {
  Scale,
  ShieldCheck,
  QrCode,
  UserCheck,
  Building2,
  LogOut,
  Menu,
  X,
  RotateCcw,
  Shield,
  User,
} from 'lucide-react';
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
  officer: 'Officer Workspace (LMO)',
  supervisor: 'Supervisor / SLA',
  gatc: 'GATC Testing Lab',
  admin: 'Admin & Governance',
  migration: 'Legacy Migration',
  public: 'Verify Public QR',
};

const TAB_ICONS: Record<TabId, React.ReactNode> = {
  trader: <Building2 className="h-4 w-4 shrink-0" />,
  officer: <ShieldCheck className="h-4 w-4 shrink-0" />,
  supervisor: <UserCheck className="h-4 w-4 shrink-0" />,
  gatc: <Scale className="h-4 w-4 shrink-0" />,
  admin: <Shield className="h-4 w-4 shrink-0" />,
  migration: <Building2 className="h-4 w-4 shrink-0" />,
  public: <QrCode className="h-4 w-4 shrink-0 text-amber-400" />,
};

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, allowedTabs, onLogout }) => {
  const { session } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = session?.user;

  // Filter tabs so 'public' can be accessed via the dedicated right button
  const primaryTabs = allowedTabs.filter((tab) => tab !== 'public');

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 select-none shadow-xs">
      {/* 1. LAYER 1: UTILITY BAR (Low-contrast, quiet institutional metadata) */}
      <div className="bg-slate-100/90 text-slate-500 text-[11px] border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">{t.govOfIndia}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 hidden md:inline">{t.ministryName}</span>
          <span className="text-slate-300 hidden md:inline">|</span>
          <span className="text-slate-500 hidden sm:inline">{t.deptName}</span>
        </div>

        <div className="flex items-center gap-3 text-slate-500 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500">
            <Building2 className="w-3 h-3 text-gov-blue" />
            <span>Jurisdiction: <strong>{user?.jurisdictionId || 'Delhi Central (JUR-DL-01)'}</strong></span>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-slate-400">
            <Shield className="w-3 h-3 text-emerald-600" />
            <span>NIC / MeitY Aligned</span>
          </span>
          <span className="text-slate-300 hidden md:inline">|</span>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
            <span className="cursor-pointer hover:text-slate-700 px-0.5">A-</span>
            <span className="cursor-pointer hover:text-slate-700 px-0.5 font-bold">A</span>
            <span className="cursor-pointer hover:text-slate-700 px-0.5">A+</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="px-1.5 py-0.5 text-gov-navy text-[10px] font-bold hover:underline transition-colors cursor-pointer"
              aria-label="Switch portal language"
            >
              {language === 'en' ? 'हिन्दी (HI)' : 'ENGLISH (EN)'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. LAYER 2: INSTITUTIONAL MASTHEAD */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 bg-white">
        <div className="flex items-center justify-between gap-3 lg:gap-6">
          {/* LEFT: Legal Metrology Emblem & Institutional Identity */}
          <div
            className="flex items-center gap-3 shrink-0 cursor-pointer"
            onClick={() => setActiveTab(allowedTabs[0] || 'trader')}
            title="Return to primary portal workspace"
          >
            <div className="w-11 h-11 rounded border border-amber-400/50 bg-amber-50 flex items-center justify-center shrink-0 shadow-2xs">
              <Scale className="h-6 w-6 text-amber-600" />
            </div>
            <div className="text-left leading-tight">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-gov-navy leading-none">
                {t.brandTitle}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">
                National Legal Metrology Verification System
              </div>
              <div className="text-[10px] text-slate-400 font-normal hidden sm:block">
                Statutory Portal under The Legal Metrology Act, 2009 &amp; General Rules, 2011
              </div>
            </div>
          </div>

          {/* RIGHT: User Profile Card & Header Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Logged in User Identification */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-left">
              <div className="w-7 h-7 rounded-full bg-gov-navy/10 border border-gov-navy/20 flex items-center justify-center text-gov-navy shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 truncate max-w-[160px]">
                    {user?.actorName || 'Authorized User'}
                  </span>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-xs uppercase shrink-0">
                    {user?.actorRole}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                  {user?.organizationName || user?.tenantId}
                </span>
              </div>
            </div>

            {/* Reset Data Button */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all demo & verification data back to a completely clean slate?')) {
                  api.system.resetAllData();
                }
              }}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors cursor-pointer"
              title="Wipe mock database and reset to clean state"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Reset Data</span>
            </button>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-1.5 sm:py-2 rounded bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-bold text-xs sm:text-sm shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Sign out of portal"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>{t.logoutButton || 'Sign Out'}</span>
            </button>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="xl:hidden p-2 rounded text-gov-navy hover:bg-slate-100 border border-slate-200"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 3. LAYER 3: CONVENTIONAL GOVERNMENT NAVIGATION STRIP (DEEP NAVY NTA-INSPIRED) */}
      <div className="bg-gov-navy text-white text-[15px] sm:text-base border-t border-slate-800 select-none shadow-sm relative z-20">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <nav className="flex items-center flex-wrap lg:flex-nowrap">
            {primaryTabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 sm:px-6 py-2.5 sm:py-3 font-bold flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-100 hover:text-amber-300 hover:bg-slate-800/70'
                  }`}
                >
                  {TAB_ICONS[tab]}
                  <span>{TAB_LABELS[tab]}</span>
                </button>
              );
            })}

            {/* Verify Public QR — Dedicated Public Service Link on Right */}
            <button
              type="button"
              onClick={() => setActiveTab('public')}
              className={`px-4 sm:px-5 py-2.5 sm:py-3 font-bold flex items-center gap-1.5 cursor-pointer ml-auto transition-colors ${
                activeTab === 'public'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-amber-300 hover:text-white hover:bg-slate-800/70'
              }`}
              title="Verify genuine scale digital certificates with Zero-PII QR scan"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Verify Public QR</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Mobile Accordion Dropdown */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-gov-navy border-t border-slate-800 px-4 py-2 space-y-1 animate-in fade-in duration-150">
          {allowedTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded text-xs font-semibold flex items-center justify-between ${
                activeTab === tab
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {TAB_ICONS[tab]}
                {TAB_LABELS[tab]}
              </span>
              {activeTab === tab && <span className="text-[10px] uppercase font-bold">Active</span>}
            </button>
          ))}
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{user?.actorName} ({user?.actorRole})</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all demo & verification data back to a clean slate?')) {
                  api.system.resetAllData();
                }
              }}
              className="text-amber-400 hover:underline"
            >
              Reset Data
            </button>
          </div>
        </div>
      )}
    </header>
  );
};