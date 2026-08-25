import React from 'react';
import { LayoutDashboard, Database, ScrollText, Activity, ShieldCheck } from 'lucide-react';
import { useAdminSession } from '../../context/AuthContext';

export type AdminView = 'overview' | 'database' | 'audit' | 'health';

const NAV: { key: AdminView; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-5 w-5" /> },
  { key: 'database', label: 'Database Browser', icon: <Database className="h-5 w-5" /> },
  { key: 'audit', label: 'Audit Trail', icon: <Activity className="h-5 w-5" /> },
  { key: 'health', label: 'Backend Health', icon: <ShieldCheck className="h-5 w-5" /> },
];

export const AdminLayout: React.FC<{ view: AdminView; onNavigate: (v: AdminView) => void; children: React.ReactNode }> = ({
  view,
  onNavigate,
  children,
}) => {
  const session = useAdminSession();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gov-navy text-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Administration Control Plane</h1>
            <p className="text-xs text-slate-300">National Legal Metrology Verification &amp; Digital Certification Platform</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="inline-flex items-center gap-1 rounded-full bg-gov-gold px-2 py-0.5 text-[11px] font-semibold text-white">
                <ShieldCheck className="h-3 w-3" /> ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">{session.actorId} · {session.tenantId}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-56 shrink-0 bg-white border-r border-gov-border">
          <nav className="py-4 px-3 space-y-1">
            {NAV.map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  view === item.key ? 'bg-gov-blue text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
          <div className="px-4 py-3 text-[11px] text-slate-400 border-t border-gov-border">
            Actions are role-gated server-side and every privileged call is appended to the immutable audit trail.
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
};