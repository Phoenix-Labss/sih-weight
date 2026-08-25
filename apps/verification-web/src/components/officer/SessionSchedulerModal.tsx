import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Application, ApplicationScheduleRequest } from '../../types/application';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { Calendar, Clock, UserCheck, ShieldCheck } from 'lucide-react';

interface SessionSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: Application | null;
  onScheduled: (app: Application) => void;
}

export const SessionSchedulerModal: React.FC<SessionSchedulerModalProps> = ({
  isOpen,
  onClose,
  application,
  onScheduled,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
  );
  const [timeSlot, setTimeSlot] = useState<string>('10:00-12:00');
  const [assignedOfficer, setAssignedOfficer] = useState<string>('lmo-officer-01');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!application) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const [startHour, endHour] = timeSlot.split('-');
      const slotStart = `${scheduledDate}T${startHour}:00Z`;
      const slotEnd = `${scheduledDate}T${endHour}:00Z`;

      const payload: ApplicationScheduleRequest = {
        slot_start: slotStart,
        slot_end: slotEnd,
        assigned_lmo_id: assignedOfficer,
      };

      const updated = await api.applications.scheduleApplication(
        user.tenantId,
        application.application_id,
        payload
      );

      notify('success', 'Verification Session Scheduled', `Scheduled for ${scheduledDate} (${timeSlot}).`);
      onScheduled(updated);
      onClose();
    } catch (err) {
      notify('error', 'Scheduling Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Physical Inspection & Testing Slot"
      subtitle={`Application: ${application.application_number} | Allocate Metrology Officer Slot`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Inspection Date *
          </label>
          <div className="relative">
            <input
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 pl-9 focus:ring-2 focus:ring-gov-blue"
            />
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Inspection Time Window *
          </label>
          <div className="relative">
            <select
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 pl-9 bg-white focus:ring-2 focus:ring-gov-blue"
            >
              <option value="10:00-12:00">Morning Slot: 10:00 AM – 12:00 PM</option>
              <option value="12:30-14:30">Afternoon Slot: 12:30 PM – 02:30 PM</option>
              <option value="15:00-17:00">Evening Slot: 03:00 PM – 05:00 PM</option>
            </select>
            <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Assign Inspecting Officer / Verifier *
          </label>
          <div className="relative">
            <select
              value={assignedOfficer}
              onChange={(e) => setAssignedOfficer(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 pl-9 bg-white focus:ring-2 focus:ring-gov-blue"
            >
              <option value="lmo-officer-01">Inspector Amit Sharma (LMO Central Zone)</option>
              <option value="lmo-officer-02">Inspector Rajesh Verma (LMO North Zone)</option>
              <option value="gatc-verifier-01">Dr. Priya Nair (GATC Technical Lead)</option>
            </select>
            <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Creates an active verification session ready for guided NAWI testing execution.</span>
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
            className="px-5 py-2 rounded-lg bg-gov-blue text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Scheduling...' : 'Confirm & Allocate Slot'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
