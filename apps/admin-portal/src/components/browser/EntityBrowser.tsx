import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { adminService } from '../../api/adminService';
import { AdminEntityMeta, Paginated } from '../../types/admin';
import { RecordDrawer } from './RecordDrawer';
import { MasterDataEditor } from '../master/MasterDataEditor';

const PAGE_SIZE = 20;

export const EntityBrowser: React.FC = () => {
  const [entities, setEntities] = useState<AdminEntityMeta[]>([]);
  const [selected, setSelected] = useState<string>('user');
  const [data, setData] = useState<Paginated<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [editorState, setEditorState] = useState<{ existing?: Record<string, unknown> } | null>(null);

  useEffect(() => {
    adminService
      .listEntities()
      .then((list) => {
        setEntities(list);
        if (!list.some((e) => e.slug === selected) && list.length) setSelected(list[0].slug);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const load = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminService.browse(selected, page, PAGE_SIZE));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const meta = entities.find((e) => e.slug === selected);

  useEffect(() => {
    if (selected) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const legalEntities = entities.filter((e) => e.kind === 'legal');
  const masterEntities = entities.filter((e) => e.kind === 'master');

  const openRecord = async (id: unknown) => {
    if (!meta) return;
    try {
      setDetail(await adminService.getRecord(meta.slug, String(id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const idVal = (row: Record<string, unknown>) => (meta?.idField ? row[meta.idField] : row.audit_id || row.id);
  const samples = data?.items[0] ? Object.keys(data.items[0]).slice(0, 6) : [];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-64 shrink-0">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Entity</p>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">LEGAL / READ-ONLY</p>
            {legalEntities.map((e) => (
              <button
                key={e.slug}
                onClick={() => setSelected(e.slug)}
                className={`block w-full text-left rounded px-3 py-1.5 text-sm ${
                  selected === e.slug ? 'bg-slate-200 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-700 mb-1">MASTER DATA</p>
            {masterEntities.map((e) => (
              <button
                key={e.slug}
                onClick={() => setSelected(e.slug)}
                className={`block w-full text-left rounded px-3 py-1 text-sm ${
                  selected === e.slug ? 'bg-emerald-100 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gov-navy">{meta?.label}</h2>
            <p className="text-xs text-slate-500">
              {data ? `${data.total.toLocaleString()} records` : '…'} · page {data?.page ?? 1}/{data?.total_pages ?? 1}
            </p>
          </div>
          <div className="flex gap-2">
            {meta?.kind === 'master' && (
              <button
                onClick={() => setEditorState({})}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" /> Create
              </button>
            )}
            <button
              onClick={() => load(data?.page ?? 1)}
              className="inline-flex items-center gap-1 rounded-md border border-gov-border bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="overflow-hidden rounded-xl border border-gov-border bg-white shadow-sm">
          <table className="gov-table">
            <thead>
              <tr>
                {samples.map((k) => (
                  <th key={k} className="text-left">{k}</th>
                ))}
                {meta?.kind === 'master' && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="">
              {(data?.items ?? []).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  {samples.map((k) => (
                    <td key={k} className="px-3 py-2 text-slate-700 font-mono max-w-[200px] truncate">
                      {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '—')}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => openRecord(idVal(row))} className="text-xs font-semibold text-gov-blue hover:underline">
                      View
                    </button>
                    {meta?.kind === 'master' && (
                      <button
                        onClick={() => setEditorState({ existing: row })}
                        className="ml-3 inline-flex items-center text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        <Pencil className="h-3 w-3 mr-0.5" /> Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="p-3 text-sm text-slate-400">Loading…</p>}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            disabled={!data || data.page <= 1}
            onClick={() => load((data?.page ?? 1) - 1)}
            className="inline-flex items-center gap-1 rounded border border-gov-border bg-white px-3 py-1.5 text-xs disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            disabled={!data || data.page >= data.total_pages}
            onClick={() => load((data?.page ?? 1) + 1)}
            className="inline-flex items-center gap-1 rounded border border-gov-border bg-white px-3 py-1.5 text-xs disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {detail && meta && <RecordDrawer meta={meta} record={detail} onClose={() => setDetail(null)} />}
      {editorState !== null && meta && (
        <MasterDataEditor
          meta={meta}
          existing={editorState.existing}
          onClose={() => setEditorState(null)}
          onSaved={() => load(data?.page ?? 1)}
        />
      )}
    </div>
  );
};