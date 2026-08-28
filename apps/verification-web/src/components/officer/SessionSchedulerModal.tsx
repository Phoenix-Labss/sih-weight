import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Application, ApplicationScheduleRequest } from '../../types/application';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { mockApplicationService } from '../../api/mock/mockService';
import { DynamicSlotPicker } from '../common/DynamicSlotPicker';
import { Calendar, UserCheck, ShieldCheck, MapPin, Building } from 'lucide-react';

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

  // Tomorrow by default
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  const [selectedSlot, setSelectedSlot] = useState<string>('09:00-10:30');
  const [assignedOfficer, setAssignedOfficer] = useState<string>('lmo-officer-01');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedSlotCounts, setBookedSlotCounts] = useState<Record<string, number>>({});
  const [jurisdictionName, setJurisdictionName] = useState<string>('Central Delhi Zone (JUR-DL-01)');

  const isOfficer =
    user.actorRole === 'LMO' ||
    user.actorRole === 'SUPERVISOR' ||
    user.actorRole === 'CONTROLLER' ||
    user.actorRole === 'ADMIN' ||
    user.actorRole === 'GATC_VERIFIER';

  // Fetch slot availability when date or application changes
  useEffect(() => {
    if (!isOpen || !application) return;

    const fetchAvailability = async () => {
      try {
        if (api.applications.getSlotAvailability) {
          const res = await api.applications.getSlotAvailability(
            user.tenantId,
            application.jurisdiction_id || 'JUR-DL-01',
            scheduledDate
          );
          if (res) {
            setJurisdictionName(res.jurisdiction_name);
            const counts: Record<string, number> = {};
            res.slots.forEach((s) => {
              counts[s.slot_id] = s.booked_count;
            });
            setBookedSlotCounts(counts);
          }
        }
      } catch (e) {
        console.error('Failed to fetch slot availability', e);
      }
    };

    fetchAvailability();
  }, [isOpen, application, scheduledDate, user.tenantId]);

  if (!application) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const [startHour, endHour] = selectedSlot.split('-');
      const slotStart = `${scheduledDate}T${startHour}:00Z`;
      const slotEnd = `${scheduledDate}T${endHour}:00Z`;

      const payload: ApplicationScheduleRequest = {
        slot_start: slotStart,
        slot_end: slotEnd,
        assigned_lmo_id: assignedOfficer || 'lmo-officer-01',
      };

      let updated: Application;
      try {
        updated = await api.applications.scheduleApplication(
          application.tenant_id || user.tenantId,
          application.application_id || application.application_number,
          payload
        );
      } catch (scheduleErr) {
        // If HTTP API throws (e.g. application is in mockDb or offline), update in mock service
        updated = await mockApplicationService.scheduleApplication(
          application.tenant_id || user.tenantId,
          application.application_id || application.application_number,
          payload
        );
      }

      notify(
        'success',
        isOfficer ? 'Verification Slot Allocated' : 'Verification Slot Confirmed',
        `Scheduled for ${scheduledDate} (${selectedSlot}) with Departmental Inspectorate.`
      );
      onScheduled(updated);
      onClose();
    } catch (err) {
      notify('error', 'Scheduling Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isOfficer ? "Allocate Departmental Inspection Slot" : "Schedule Inspection & Verification Slot"}
      subtitle={`Application: ${application.application_number} • ${application.service_mode.replace(/_/g, ' ')}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Jurisdiction & Service Mode Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Building className="w-4 h-4 text-gov-navy shrink-0" />
            <div>
              <div className="font-bold text-gov-navy">{jurisdictionName}</div>
              <div className="text-[11px] text-slate-500">Service Mode: {application.service_mode.replace(/_/g, ' ')}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Statutory Fee Reconciled</span>
          </div>
        </div>

        {/* Date Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            1. Select Inspection Date *
          </label>
          <div className="relative">
            <input
              type="date"
              required
              min={minDateStr}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 pl-9 focus:ring-2 focus:ring-gov-blue bg-white font-medium"
            />
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Dynamic Slot Selection (09:00 - 19:00, 2 hr windows) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            2. Choose 2-Hour Time Window (Live Area Fleet Capacity) *
          </label>
          <DynamicSlotPicker
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => setSelectedSlot(slot)}
            selectedDate={scheduledDate}
            jurisdictionName={jurisdictionName}
            totalFleetSize={10}
            bookedSlotCounts={bookedSlotCounts}
          />
        </div>

        {/* Officer Assignment (For LMO/Officer view) */}
        {isOfficer ? (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              3. Assign Inspecting Officer / Verifier *
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
        ) : (
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gov-blue shrink-0" />
            <span>
              An authorized Legal Metrology Officer from <strong>{jurisdictionName}</strong> will be automatically allocated for this time window.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
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
            className="px-5 py-2 rounded-lg bg-gov-blue text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Confirming Slot...' : 'Confirm & Schedule Appointment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
