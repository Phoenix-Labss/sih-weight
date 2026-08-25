import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { SessionDispositionRequest, VerificationOutcome, VerificationSession } from '../../types/session';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { CheckCircle2, XCircle, AlertTriangle, FileQuestion, ShieldCheck } from 'lucide-react';

interface DispositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: VerificationSession | null;
  onDispositionRecorded: (session: VerificationSession) => void;
}

export const DispositionModal: React.FC<DispositionModalProps> = ({
  isOpen,
  onClose,
  session,
  onDispositionRecorded,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [outcome, setOutcome] = useState<VerificationOutcome>(
    'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
  );
  const [dispositionNotes, setDispositionNotes] = useState(
    'All statutory test points (Zero, Stepped Load, Eccentricity, Repeatability) verified strictly within Maximum Permissible Error (MPE) limits. Physical tamper-evident lead wire seal affixed.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: SessionDispositionRequest = {
        outcome: outcome,
        disposition_notes: dispositionNotes.trim() || undefined,
      };

      const result = await api.verification.recordDisposition(
        user.tenantId,
        session.session_id,
        payload
      );

      notify(
        outcome === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
          ? 'success'
          : outcome === 'VERIFICATION_FAILED'
          ? 'error'
          : 'warning',
        'Official Disposition Finalized',
        `Recorded disposition: ${outcome}`
      );

      onDispositionRecorded(result);
      onClose();
    } catch (err) {
      notify('error', 'Disposition Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Legal Metrology Statutory Disposition"
      subtitle={`Session: ${session.session_id} | Verifier Authority: ${user.actorName} (${user.actorRole})`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Outcome Choices */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Statutory Legal Disposition Outcome *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                id: 'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
                title: 'Verification Passed (Ready for Cert)',
                icon: CheckCircle2,
                desc: 'All test observations within statutory MPE limits',
                color: 'emerald',
              },
              {
                id: 'VERIFICATION_FAILED',
                title: 'Verification Failed (Rejected)',
                icon: XCircle,
                desc: 'Instrument out of permissible tolerance',
                color: 'rose',
              },
              {
                id: 'NEEDS_REVIEW',
                title: 'Needs Supervisory Review',
                icon: AlertTriangle,
                desc: 'Borderline anomaly requiring Senior Inspector check',
                color: 'amber',
              },
              {
                id: 'INCOMPLETE_VERIFICATION',
                title: 'Incomplete / Aborted Test',
                icon: FileQuestion,
                desc: 'Testing interrupted by environmental or equipment fault',
                color: 'slate',
              },
            ].map((o) => {
              const Icon = o.icon;
              const isSelected = outcome === o.id;
              return (
                <div
                  key={o.id}
                  onClick={() => setOutcome(o.id as VerificationOutcome)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? o.id === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
                        : o.id === 'VERIFICATION_FAILED'
                        ? 'border-rose-500 bg-rose-50 text-rose-950 ring-1 ring-rose-500'
                        : o.id === 'NEEDS_REVIEW'
                        ? 'border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-500'
                        : 'border-slate-400 bg-slate-100 text-slate-900 ring-1 ring-slate-400'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-1 ${
                      isSelected
                        ? o.id === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
                          ? 'text-emerald-600'
                          : o.id === 'VERIFICATION_FAILED'
                          ? 'text-rose-600'
                          : o.id === 'NEEDS_REVIEW'
                          ? 'text-amber-600'
                          : 'text-slate-600'
                        : 'text-slate-400'
                    }`}
                  />
                  <div className="text-xs font-bold">{o.title}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{o.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Officer Statutory Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Formal Statutory Officer Notes *
          </label>
          <textarea
            required
            rows={3}
            value={dispositionNotes}
            onChange={(e) => setDispositionNotes(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-gov-blue"
          />
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gov-blue flex-shrink-0" />
          <span>Disposition will finalize the test session and lock all raw observations against modification.</span>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-gov-navy text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Recording...' : 'Finalize Legal Disposition'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
