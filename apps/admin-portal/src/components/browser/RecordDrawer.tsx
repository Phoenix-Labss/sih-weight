import React from 'react';
import { X } from 'lucide-react';
import { AdminEntityMeta } from '../../types/admin';

function displayValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export const RecordDrawer: React.FC<{
  meta: AdminEntityMeta;
  record: Record<string, unknown>;
  onClose: () => void;
}> = ({ meta, record, onClose }) => {
  const rows = Object.entries(record);
  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white h-full overflow-auto shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gov-navy">
            {meta.label} <span className="text-sm font-normal text-slate-400">({meta.slug})</span>
          </h2>
          <button onClick={onClose} className="inline-flex p-2 rounded hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            meta.kind === 'legal' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {meta.kind === 'legal' ? 'LEGAL / READ-ONLY' : 'MASTER DATA'}
        </span>

        <dl className="mt-4 divide-y divide-slate-100">
          {rows.map(([k, v]) => (
            <div key={k} className="py-2 grid grid-cols-3 gap-3">
              <dt className="text-xs font-medium text-slate-500 break-all">{k}</dt>
              <dd className="col-span-2 text-sm text-slate-800 font-mono break-all">{displayValue(v)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};