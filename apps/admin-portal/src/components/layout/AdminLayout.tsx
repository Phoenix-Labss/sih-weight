import React from 'react';
import { LayoutDashboard, Database, Activity, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { env } from '../../config/env';

export type AdminView = 'overview' | 'database' | 'audit' | 'health';

const NAV: { key: AdminView; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> },
  { key: 'database', label: 'Database Browser', icon: <Database className="h-4 w-4" aria-hidden="true" /> },
  { key: 'audit', label: 'Audit Trail', icon: <Activity className="h-4 w-4" aria-hidden="true" /> },
  { key: 'health', label: 'Backend Health', icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" /> },
];

export const AdminLayout: React.FC<{ view: AdminView; onNavigate: (v: AdminView) => void; children: React.ReactNode }> = ({
  view, onNavigate, children,
}) => {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Utility bar — institutional metadata */}
      <div className="border-b border-slate-800 bg-slate-900 px-4 py-1.5 text-xs text-slate-400 sm:px-6">
        Government of India&nbsp;&nbsp;|&nbsp;&nbsp;Department of Consumer Affairs&nbsp;&nbsp;|&nbsp;&nbsp;Legal Metrology Division
      </div>

      {/* Masthead */}
      <header className="bg-gov-navy text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Administration Control Plane</h1>
            <p className="text-xs text-slate-300">National Legal Metrology Verification &amp; Digital Certification Platform</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="flex items-center justify-end gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" /> ADMIN
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-300">{user.actorId} · {user.tenantId}</p>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation + content */}
      <div className="flex flex-1 flex-col lg:flex-row">
        <nav aria-label="Primary" className="border-b border-gov-border bg-white lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
          {/* Horizontal scrollable tabs on mobile, vertical sidebar on desktop */}
          <div className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:py-4">
            {NAV.map((item) => {
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-gov-navy text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="hidden border-t border-gov-border px-4 py-3 text-xs leading-relaxed text-slate-500 lg:block">
            Actions are role-gated server-side and every privileged call is appended to the immutable audit trail.
          </div>
        </nav>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            {children}
            <footer className="mt-10 border-t border-gov-border pt-4 text-xs text-slate-500">
              {env.APP_NAME} · {env.PORTAL_VERSION} · Access restricted to authorised system administrators. Every action is audited.
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
};