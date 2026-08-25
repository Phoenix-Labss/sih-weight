import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { AdminEntityMeta } from '../../types/admin';
import { adminService } from '../../api/adminService';

interface Props {
  meta: AdminEntityMeta;
  /** When provided the editor updates this record; otherwise it creates a new one. */
  existing?: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
}

/** Heuristic coercion for generic master-data inputs. Keeps ids/status/enum as strings. */
function coerce(field: string, raw: string): unknown {
  if (field === 'is_active') return raw === 'true';
  if (raw === '') return undefined;
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true';
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (!Number.isNaN(Number(raw)) && /^\d+(\.\d+)?$/.test(raw) && !/^0+$/.test(raw)) {
    return Number(raw);
  }
  return raw;
}

export const MasterDataEditor: React.FC<Props> = ({ meta, existing, onClose, onSaved }) => {
  const idField = meta.idField || 'id';
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of meta.writable) {
      const existingValue = existing ? (existing as Record<string, unknown>)[f] : undefined;
      if (existingValue === undefined || existingValue === null) {
        init[f] = '';
      } else if (typeof existingValue === 'object') {
        init[f] = JSON.stringify(existingValue);
      } else {
        init[f] = String(existingValue);
      }
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (f: string, v: string) => setValues((prev) => ({ ...prev, [f]: v }));

  const submit = async () => {
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of meta.writable) {
        const coerced = coerce(f, values[f]);
        if (coerced !== undefined) payload[f] = coerced;
      }
      if (existing) {
        await adminService.updateMaster(meta.slug, String(existing[idField]), payload);
      } else {
        await adminService.createMaster(meta.slug, payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gov-navy">
            {existing ? `Edit ${meta.label}` : `Create ${meta.label}`}
          </h2>
          <button onClick={onClose} className="inline-flex p-2 rounded hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Master data only. Legal/transactional records cannot be edited from the admin console.
        </p>

        <div className="space-y-3">
          {meta.writable.map((f) => (
            <label key={f} className="block">
              <span className="text-xs font-medium text-slate-600">{f}</span>
              {f === 'is_active' ? (
                <select
                  className="mt-1 w-full rounded-lg border border-gov-border px-3 py-2 text-sm"
                  value={values[f]}
                  onChange={(e) => setField(f, e.target.value)}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  className="mt-1 w-full rounded-lg border border-gov-border px-3 py-2 text-sm font-mono"
                  value={values[f]}
                  onChange={(e) => setField(f, e.target.value)}
                  placeholder={f.endsWith('_id') ? 'identifier' : 'value'}
                />
              )}
            </label>
          ))}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gov-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {submitting ? 'Saving…' : existing ? 'Save changes' : 'Create record'}
        </button>
      </div>
    </div>
  );
};