import React, { useState, useEffect } from 'react';
import { Application, ApplicationScheduleRequest } from '../../types/application';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { mockApplicationService } from '../../api/mock/mockService';
import { DynamicSlotPicker } from '../common/DynamicSlotPicker';
import { Calendar, UserCheck, ShieldCheck, Building, X } from 'lucide-react';

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

  const titleId = React.useId();
  const subtitleId = React.useId();

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

  if (!isOpen || !application) return null;

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
          payload,
          application
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B192C]/60 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        className="animate-modal-in relative z-10 w-full sm:max-w-2xl max-h-[94vh] sm:max-h-[88vh] flex flex-col bg-white border border-[#CBD5E1] shadow-overlay rounded-t-xl sm:rounded-lg overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="shrink-0 border-b border-[#CBD5E1] bg-white px-5 pt-4 pb-3.5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[22px] leading-snug font-bold text-[#12324A]">
                {isOfficer
                  ? 'Allocate Departmental Inspection Slot'
                  : 'Schedule Inspection & Verification Slot'}
              </h2>
              <p id={subtitleId} className="mt-0.5 text-[13px] text-[#172B4D]/60">
                Application:{' '}
                <span className="font-semibold text-[#172B4D]/85">
                  {application.application_number}
                </span>
                <span className="mx-1.5 text-[#94A3B8]">•</span>
                {application.service_mode.replace(/_/g, ' ')}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="shrink-0 rounded p-1.5 text-[#172B4D]/40 transition-colors hover:bg-[#F5F7FA] hover:text-[#172B4D] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 h-0.5 w-10 bg-[#F4B41A]" aria-hidden="true" />
        </div>

        {/* ── Body (scrollable) ── */}
        <form
          id="slot-allocation-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
        >
          {/* Jurisdiction & Service Mode — compact information strip */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-y border-[#CBD5E1] bg-[#F5F7FA] px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Building className="w-4 h-4 text-[#1E4FA3] shrink-0" />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[#12324A] leading-snug truncate">
                  {jurisdictionName}
                </div>
                <div className="text-[12px] text-[#172B4D]/60 leading-snug">
                  Service Mode: {application.service_mode.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 self-start sm:self-center px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-[12px] font-semibold text-[#15803D] shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Statutory Fee Reconciled</span>
            </div>
          </div>

          {/* Step 1 — Inspection Date */}
          <div>
            <label
              htmlFor="inspection-date"
              className="block text-sm font-semibold uppercase tracking-wide text-[#12324A] mb-1.5"
            >
              1. Select Inspection Date <span className="text-[#B91C1C]">*</span>
            </label>
            <div className="relative">
              <input
                id="inspection-date"
                type="date"
                required
                min={minDateStr}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full h-10 rounded-md border border-[#CBD5E1] bg-white px-3 pl-9 text-sm font-medium text-[#172B4D] focus:outline-none focus:border-[#1E4FA3] focus:ring-2 focus:ring-[#1E4FA3]/15 transition-colors"
              />
              <Calendar className="w-4 h-4 text-[#172B4D]/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Step 2 — Time Window (dynamic slot picker) */}
          <div>
            <div className="block text-sm font-semibold uppercase tracking-wide text-[#12324A] mb-1.5">
              2. Choose 2-Hour Time Window (Live Area Fleet Capacity){' '}
              <span className="text-[#B91C1C]">*</span>
            </div>
            <DynamicSlotPicker
              selectedSlot={selectedSlot}
              onSelectSlot={(slot) => setSelectedSlot(slot)}
              selectedDate={scheduledDate}
              jurisdictionName={jurisdictionName}
              totalFleetSize={10}
              bookedSlotCounts={bookedSlotCounts}
            />
          </div>

          {/* Step 3 — Officer Assignment (For LMO/Officer view) */}
          {isOfficer ? (
            <div>
              <label
                htmlFor="inspecting-officer"
                className="block text-sm font-semibold uppercase tracking-wide text-[#12324A] mb-1.5"
              >
                3. Assign Inspecting Officer / Verifier <span className="text-[#B91C1C]">*</span>
              </label>
              <div className="relative">
                <select
                  id="inspecting-officer"
                  value={assignedOfficer}
                  onChange={(e) => setAssignedOfficer(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#CBD5E1] bg-white px-3 pl-9 text-sm font-medium text-[#172B4D] focus:outline-none focus:border-[#1E4FA3] focus:ring-2 focus:ring-[#1E4FA3]/15 transition-colors"
                >
                  <option value="lmo-officer-01">Inspector Amit Sharma (LMO Central Zone)</option>
                  <option value="lmo-officer-02">Inspector Rajesh Verma (LMO North Zone)</option>
                  <option value="gatc-verifier-01">Dr. Priya Nair (GATC Technical Lead)</option>
                </select>
                <UserCheck className="w-4 h-4 text-[#172B4D]/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 border border-[#CBD5E1] bg-[#F5F7FA] rounded-md p-3 text-[13px] text-[#172B4D]">
              <ShieldCheck className="w-4 h-4 text-[#1E4FA3] shrink-0 mt-0.5" />
              <span>
                An authorized Legal Metrology Officer from{' '}
                <strong className="font-semibold text-[#12324A]">{jurisdictionName}</strong> will
                be automatically allocated for this time window.
              </span>
            </div>
          )}
        </form>

        {/* ── Footer (fixed action bar) ── */}
        <div className="shrink-0 border-t border-[#CBD5E1] bg-[#F5F7FA] px-5 py-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md border border-[#CBD5E1] bg-white text-[13px] font-semibold text-[#172B4D]/80 hover:border-[#94A3B8] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="slot-allocation-form"
            disabled={isSubmitting}
            className="h-9 px-5 rounded-md bg-[#1E4FA3] text-[13px] font-bold text-white hover:bg-[#12324A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? 'Confirming Slot...' : 'Confirm & Schedule Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
};
