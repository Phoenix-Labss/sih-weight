import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { SessionDispositionRequest, VerificationOutcome, VerificationSession } from '../../types/session';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { CheckCircle2, XCircle, AlertTriangle, FileQuestion, ShieldCheck, Stamp, Lock } from 'lucide-react';
import { PhysicalStampRecordRequest } from '../../types/stamp';

interface DispositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: VerificationSession | null;
  onDispositionRecorded: (session: VerificationSession) => void;
  onStampRecorded?: () => void;
}

export const DispositionModal: React.FC<DispositionModalProps> = ({
  isOpen,
  onClose,
  session,
  onDispositionRecorded,
  onStampRecorded,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [outcome, setOutcome] = useState<VerificationOutcome>(
    'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
  );
  const [dispositionNotes, setDispositionNotes] = useState(
    'All statutory test points (Zero, Stepped Load, Eccentricity, Repeatability) verified strictly within Maximum Permissible Error (MPE) limits. Physical tamper-evident lead wire seal affixed.'
  );

  // Integrated Physical Seal Affixation
  const [affixSealNow, setAffixSealNow] = useState(true);
  const [sealNumber, setSealNumber] = useState(
    () => `DL-SEAL-2026-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [sealPosition, setSealPosition] = useState('CALIBRATION_PORT_MAIN');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 1. If passing and seal affixation is selected, record the physical stamp
      if (outcome === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION' && affixSealNow && sealNumber.trim()) {
        try {
          const stampPayload: PhysicalStampRecordRequest = {
            instrument_id: session.instrument_id,
            action_type: 'SEAL_APPLIED',
            seal_type: 'LEAD_WIRE_SEAL',
            seal_identification_number: sealNumber.trim(),
            seal_position: sealPosition.trim(),
            notes: 'Official Legal Metrology lead wire seal embossed with department emblem upon verification pass.',
          };
          await api.stamps.recordStampAction(user.tenantId, session.session_id, stampPayload);
          onStampRecorded?.();
        } catch (stampErr) {
          console.warn('Physical stamp auto-record warning:', stampErr);
        }
      }

      // 2. Record statutory legal disposition
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
        outcome === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION' && affixSealNow
          ? `Disposition Passed. Physical Seal ${sealNumber.trim()} recorded in official ledger.`
          : `Recorded statutory disposition: ${outcome}`
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
      <form onSubmit={handleSubmit} className="space-y-4">
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
                desc: 'Borderline tolerance or reference standard anomaly',
                color: 'amber',
              },
              {
                id: 'INCOMPLETE_VERIFICATION',
                title: 'Incomplete Verification',
                icon: FileQuestion,
                desc: 'Aborted due to power outage or environmental shift',
                color: 'slate',
              },
            ].map((o) => {
              const isSelected = outcome === o.id;
              const Icon = o.icon;
              return (
                <div
                  key={o.id}
                  onClick={() => setOutcome(o.id as VerificationOutcome)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? o.id === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : o.id === 'VERIFICATION_FAILED'
                        ? 'border-rose-600 bg-rose-50/70 ring-2 ring-rose-500/20'
                        : 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-slate-300'
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

        {/* Physical Seal Affixation Option for Passed sessions */}
        {outcome === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION' && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-950">
                <input
                  type="checkbox"
                  checked={affixSealNow}
                  onChange={(e) => setAffixSealNow(e.target.checked)}
                  className="rounded border-amber-300 text-gov-navy focus:ring-gov-navy"
                />
                <Stamp className="w-4 h-4 text-amber-700" />
                <span>Simultaneously Record Physical Security Seal Affixation</span>
              </label>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200/70 text-amber-900 uppercase">
                Statutory Stamping
              </span>
            </div>

            {affixSealNow && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-amber-200/60 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                    Seal Identification Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={sealNumber}
                    onChange={(e) => setSealNumber(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-white rounded-lg border border-amber-300 px-3 py-1.5 focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. DL-SEAL-2026-4821"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                    Seal Position
                  </label>
                  <select
                    value={sealPosition}
                    onChange={(e) => setSealPosition(e.target.value)}
                    className="w-full text-xs bg-white rounded-lg border border-amber-300 px-3 py-1.5 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="CALIBRATION_PORT_MAIN">Main Calibration Port &amp; Enclosure</option>
                    <option value="CHASSIS_JUNCTION_BOX">Load Cell Junction Box</option>
                    <option value="DISPLAY_INDICATOR_HOUSING">Digital Display Housing</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Officer Statutory Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Formal Statutory Officer Notes *
          </label>
          <textarea
            required
            rows={2}
            value={dispositionNotes}
            onChange={(e) => setDispositionNotes(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-gov-blue"
          />
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gov-blue flex-shrink-0" />
          <span>Disposition will finalize the test session and unlock certificate authorization.</span>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-gov-navy text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Recording...' : 'Finalize Legal Disposition'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
