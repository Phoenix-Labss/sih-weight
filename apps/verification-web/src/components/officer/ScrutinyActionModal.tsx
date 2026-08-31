import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Application, ApplicationScrutinyRequest } from '../../types/application';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';

interface ScrutinyActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: Application | null;
  onActionCompleted: (app: Application) => void;
}

export const ScrutinyActionModal: React.FC<ScrutinyActionModalProps> = ({
  isOpen,
  onClose,
  application,
  onActionCompleted,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [actionType, setActionType] = useState<'ACCEPT' | 'QUERY' | 'REJECT'>('ACCEPT');
  const [notes, setNotes] = useState('');
  const [queryText, setQueryText] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!application) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionType === 'QUERY' && !queryText.trim()) {
      notify('error', 'Query Text Required', 'Please enter the specific deficiency or query note.');
      return;
    }
    if (actionType === 'REJECT' && !rejectionReason.trim()) {
      notify('error', 'Rejection Reason Required', 'Statutory ground for rejection is mandatory.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ApplicationScrutinyRequest = {
        action: actionType,
        notes: notes.trim() || undefined,
        query_text: actionType === 'QUERY' ? queryText.trim() : undefined,
        rejection_reason: actionType === 'REJECT' ? rejectionReason.trim() : undefined,
      };

      const updated = await api.applications.scrutinizeApplication(
        user.tenantId,
        application.application_id,
        payload
      );

      notify(
        actionType === 'ACCEPT' ? 'success' : actionType === 'QUERY' ? 'warning' : 'error',
        `Scrutiny Action: ${actionType}`,
        actionType === 'ACCEPT'
          ? 'Application accepted! Statutory fee notice generated. Switch to Trader Portal to pay fee, or click Schedule Slot / Testing Grid to proceed.'
          : actionType === 'QUERY'
          ? 'Clarification query transmitted to applicant.'
          : 'Application rejected.'
      );

      onActionCompleted(updated);
      onClose();
    } catch (err) {
      notify('error', 'Scrutiny Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Departmental Application Scrutiny"
      subtitle={`Application: ${application.application_number} | Official Evaluation`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Scrutiny Action Choice */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Officer Scrutiny Determination *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'ACCEPT',
                name: 'Accept & Assess Fee',
                icon: CheckCircle2,
                desc: 'Approve for fee assessment & scheduling',
                color: 'emerald',
              },
              {
                id: 'QUERY',
                name: 'Raise Deficiency Query',
                icon: AlertTriangle,
                desc: 'Request additional documentation',
                color: 'amber',
              },
              {
                id: 'REJECT',
                name: 'Reject Application',
                icon: XCircle,
                desc: 'Reject under statutory provisions',
                color: 'rose',
              },
            ].map((a) => {
              const Icon = a.icon;
              const isSelected = actionType === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => setActionType(a.id as 'ACCEPT' | 'QUERY' | 'REJECT')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? a.id === 'ACCEPT'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
                        : a.id === 'QUERY'
                        ? 'border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-500'
                        : 'border-red-500 bg-red-50 text-red-950 ring-1 ring-red-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-1.5 ${
                      isSelected
                        ? a.id === 'ACCEPT'
                          ? 'text-emerald-700'
                          : a.id === 'QUERY'
                          ? 'text-amber-700'
                          : 'text-red-600'
                        : 'text-slate-400'
                    }`}
                  />
                  <div className="text-xs font-bold">{a.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{a.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Query Input */}
        {actionType === 'QUERY' && (
          <div>
            <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5">
              Specific Query / Required Rectification *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Model approval certificate plate photo illegible; please upload clear specification plate photo..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="w-full text-xs rounded-lg border border-amber-300 p-3 focus:ring-2 focus:ring-amber-500 bg-amber-50/40"
            />
          </div>
        )}

        {/* Rejection Input */}
        {actionType === 'REJECT' && (
          <div>
            <label className="block text-xs font-bold text-red-900 uppercase tracking-wider mb-1.5">
              Statutory Ground for Rejection *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Instrument model is not approved for commercial trade under Section 22..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full text-xs rounded-lg border border-red-300 p-3 focus:ring-2 focus:ring-red-500 bg-red-50/40"
            />
          </div>
        )}

        {/* General Officer Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Internal Departmental Notes
          </label>
          <input
            type="text"
            placeholder="Optional internal remarks for audit file..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-gov-blue"
          />
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gov-blue flex-shrink-0" />
          <span>Action will be recorded under LMO Actor ID: <strong className="font-mono text-slate-900">{user.actorRole === 'LMO' ? user.actorId : 'lmo-officer-01'}</strong></span>
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
            className={`px-5 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${
              actionType === 'ACCEPT'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : actionType === 'QUERY'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isSubmitting ? 'Recording...' : `Confirm ${actionType}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};
