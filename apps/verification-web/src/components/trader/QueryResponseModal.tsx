import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Application, ApplicationCorrectionRequest } from '../../types/application';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { AlertTriangle, Send } from 'lucide-react';

interface QueryResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: Application | null;
  onQueryResponded: (app: Application) => void;
}

export const QueryResponseModal: React.FC<QueryResponseModalProps> = ({
  isOpen,
  onClose,
  application,
  onQueryResponded,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [responseNotes, setResponseNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!application) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseNotes.trim()) {
      notify('error', 'Response Required', 'Please enter your clarification response notes.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ApplicationCorrectionRequest = {
        correction_notes: responseNotes.trim(),
      };
      const updated = await api.applications.submitCorrection(
        user.tenantId,
        application.application_id,
        payload
      );
      notify('success', 'Correction Submitted', 'Your response has been sent to the inspecting officer.');
      onQueryResponded(updated);
      onClose();
    } catch (err) {
      notify('error', 'Submission Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Respond to Scrutiny Deficiency Query"
      subtitle={`Application: ${application.application_number} | Official Clarification`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Officer's Query Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>Official Scrutiny Query Raised by Department</span>
          </div>
          <p className="text-slate-800 bg-white p-3 rounded-lg border border-amber-200 font-medium">
            "{application.active_query || 'Please clarify instrument specifications and model approval details.'}"
          </p>
        </div>

        {/* Trader's Clarification Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Your Clarification & Correction Notes *
          </label>
          <textarea
            required
            rows={4}
            placeholder="Provide specific technical clarifications, model approval plate numbers, or confirmation of rectified items..."
            value={responseNotes}
            onChange={(e) => setResponseNotes(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-gov-blue"
          />
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
            className="px-5 py-2 rounded-lg bg-gov-blue text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Submitting...' : 'Submit Clarification'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
