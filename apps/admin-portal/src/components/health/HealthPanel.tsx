import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { adminService } from '../../api/adminService';
import { HealthData } from '../../types/admin';

export const HealthPanel: React.FC = () => {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    adminService.health().then(setData).catch((e: Error) => setError(e.message));
  };

  useEffect(load, []);

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={load}
          className="inline-flex items-center gap-1 rounded-md border border-gov-border bg-white px-3 py-1.5 text-xs text-slate-600"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Re-check
        </button>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {data && (
        <div className="rounded-xl border border-gov-border bg-white shadow-sm divide-y divide-slate-100">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gov-navy">Status</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                data.status === 'HEALTHY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}
            >
              <ShieldCheck className="h-3 w-3" />
              {data.status}
            </span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between border-t border-gov-border">
            <span className="text-sm font-medium text-gov-navy">Database connectivity</span>
            <span className="font-mono text-sm">{data.database_connectivity ? 'CONNECTED' : 'DOWN'}</span>
          </div>
          {data.database_error && (
            <div className="px-4 py-3 border-t border-gov-border text-xs text-red-600 font-mono">{data.database_error}</div>
          )}
          <div className="px-4 py-3 border-t border-gov-border text-xs text-slate-500">Checked at {new Date(data.checked_at).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
};