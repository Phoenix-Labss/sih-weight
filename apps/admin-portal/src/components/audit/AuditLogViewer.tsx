import React, { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { adminService } from '../../api/adminService';
import { AuditFilter, AuditLogEntry, Paginated } from '../../types/admin';

const PAGE_SIZE = 20;

export const AuditLogViewer: React.FC = () => {
  const [entries, setEntries] = useState<Paginated<AuditLogEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AuditFilter>({ page: 1, page_size: PAGE_SIZE });

  const load = async (next: AuditFilter) => {
    setError(null);
    try {
      setEntries(await adminService.auditLogs(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (patch: Partial<AuditFilter>) => {
    const next = { ...filter, ...patch, page: 1 };
    setFilter(next);
    load(next);
  };

  const goPage = (page: number) => {
    const next = { ...filter, page };
    setFilter(next);
    load(next);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <label className="block">
          <span className="text-xs text-slate-500">Actor ID</span>
          <input
            className="mt-1 rounded-md border border-gov-border px-3 py-2 text-sm w-52"
            value={filter.actor_id ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, actor_id: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Entity Type</span>
          <input
            className="mt-1 rounded-md border border-gov-border px-3 py-2 text-sm w-44"
            value={filter.entity_type ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, entity_type: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Action</span>
          <input
            className="mt-1 rounded-md border border-gov-border px-3 py-2 text-sm w-44"
            value={filter.action ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value }))}
          />
        </label>
        <button
          onClick={() => apply({ actor_id: filter.actor_id, entity_type: filter.entity_type, action: filter.action })}
          className="mt-5 inline-flex items-center gap-1 rounded-lg bg-gov-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
        >
          <Search className="h-3.5 w-3.5" /> Apply
        </button>
        <button
          onClick={() => { setFilter({ page: 1, page_size: PAGE_SIZE }); load({ page: 1, page_size: PAGE_SIZE }); }}
          className="mt-5 inline-flex items-center gap-1 rounded-md border border-gov-border bg-white px-3 py-1.5 text-xs text-slate-600"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reset
        </button>
        <span className="ml-auto mt-5 text-sm text-slate-500">{entries?.total.toLocaleString()} audit entries</span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gov-border bg-white shadow-sm">
        <table className="gov-table">
          <thead>
            <tr>
              {['Action', 'Entity', 'Entity ID', 'Actor', 'Correlation ID', 'Recorded At'].map((h) => (
                <th key={h} className="text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="">
            {(entries?.items ?? []).map((row) => (
              <tr key={row.audit_id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs text-gov-blue">{row.action}</td>
                <td className="px-3 py-2 text-slate-700">{row.entity_type}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.entity_id || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{row.actor_id} <span className="text-xs text-slate-400">({row.actor_role})</span></td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.correlation_id}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{new Date(row.recorded_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          disabled={!entries || entries.page <= 1}
          onClick={() => goPage((entries?.page ?? 1) - 1)}
          className="rounded border border-gov-border bg-white px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-xs text-slate-500">Page {entries?.page ?? 1}/{entries?.total_pages ?? 1}</span>
        <button
          disabled={!entries || entries.page >= entries.total_pages}
          onClick={() => goPage((entries?.page ?? 1) + 1)}
          className="rounded border border-gov-border bg-white px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
};