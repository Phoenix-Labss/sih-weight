import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { adminService } from '../../api/adminService';
import { OverviewData, StatusCount } from '../../types/admin';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white border border-gov-border p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gov-navy">{value.toLocaleString()}</p>
    </div>
  );
}

function Distribution({ title, data }: { title: string; data: StatusCount[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gov-border bg-white p-4">
        <p className="text-sm font-semibold text-gov-navy">{title}</p>
        <p className="mt-2 text-sm text-slate-400">No records</p>
      </div>
    );
  }
  const total = data.reduce((acc, d) => acc + d.count, 0);
  return (
    <div className="rounded-lg border border-gov-border bg-white p-4">
      <p className="text-sm font-semibold text-gov-navy">{title}</p>
      <ul className="mt-3 space-y-2">
        {data.map((d) => (
          <li key={d.status}>
            <div className="flex justify-between text-xs text-slate-600">
              <span>{d.status}</span>
              <span className="font-mono">{d.count}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-gov-blue"
                style={{ width: `${total ? Math.max(1, (d.count / total) * 100) : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const OverviewDashboard: React.FC = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminService
      .overview()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load overview: {error}
      </div>
    );
  }
  if (!data) {
    return <p className="text-sm text-slate-500">Loading overview…</p>;
  }

  const totals = data.totals;
  const ordered = [
    ['Applications', totals.applications],
    ['Instruments', totals.instruments],
    ['Certificates', totals.certificates],
    ['Sessions', totals.sessions],
    ['Users', totals.users],
    ['Stakeholders', totals.stakeholders],
    ['Reference Standards', totals.reference_standards],
    ['Fee Assessments', totals.fee_assessments],
    ['Audit Entries', totals.audit_logs],
    ['Tenants', totals.tenants],
    ['Procedure Packs', totals.procedure_packs],
    ['Legal Sources', totals.legal_sources],
  ] as const;

  return (
    <div>
      <div className="flex items-center gap-2 text-slate-500 mb-4">
        <Activity className="h-4 w-4" />
        <span className="text-xs">Snapshot generated at {new Date(data.generated_at).toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {ordered.map(([label, value]) => (
          <StatCard key={label} label={label} value={typeof value === 'number' ? value : 0} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Distribution title="Applications by Status" data={data.applications_by_status} />
        <Distribution title="Certificates by Status" data={data.certificates_by_status} />
        <Distribution title="Sessions by Status" data={data.sessions_by_status} />
        <Distribution title="Instruments by Status" data={data.instruments_by_status} />
        <Distribution title="Payments by Status" data={data.payments_by_status} />
        <Distribution title="Standards by Calibration" data={data.standards_by_status} />
      </div>
    </div>
  );
};