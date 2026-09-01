import React, { useMemo } from 'react';
import { Clock, CheckCircle, AlertTriangle, XCircle, Users, Coffee } from 'lucide-react';

export interface TimeSlotOption {
  slotId: string;
  startTime: string; // "09:00"
  endTime: string;   // "10:30"
  label: string;     // "09:00 AM – 10:30 AM"
  period: 'Morning' | 'Afternoon' | 'Evening';
  durationMinutes: number; // 90
  totalCapacity: number;   // 10
  bookedCount: number;
  remainingSlots: number;
  isAvailable: boolean;
}

interface DynamicSlotPickerProps {
  selectedSlot: string; // e.g. "09:00-10:30"
  onSelectSlot: (slotId: string) => void;
  selectedDate: string; // "YYYY-MM-DD"
  jurisdictionName?: string;
  totalFleetSize?: number;
  bookedSlotCounts?: Record<string, number>; // slotId -> count
}

export const STANDARD_SLOTS: Omit<TimeSlotOption, 'bookedCount' | 'remainingSlots' | 'isAvailable'>[] = [
  {
    slotId: '09:00-10:30',
    startTime: '09:00',
    endTime: '10:30',
    label: '09:00 AM – 10:30 AM',
    period: 'Morning',
    durationMinutes: 90,
    totalCapacity: 10,
  },
  {
    slotId: '10:30-12:00',
    startTime: '10:30',
    endTime: '12:00',
    label: '10:30 AM – 12:00 PM',
    period: 'Morning',
    durationMinutes: 90,
    totalCapacity: 10,
  },
  {
    slotId: '13:00-14:30',
    startTime: '13:00',
    endTime: '14:30',
    label: '01:00 PM – 02:30 PM',
    period: 'Afternoon',
    durationMinutes: 90,
    totalCapacity: 10,
  },
  {
    slotId: '14:30-16:00',
    startTime: '14:30',
    endTime: '16:00',
    label: '02:30 PM – 04:00 PM',
    period: 'Afternoon',
    durationMinutes: 90,
    totalCapacity: 10,
  },
  {
    slotId: '16:00-17:30',
    startTime: '16:00',
    endTime: '17:30',
    label: '04:00 PM – 05:30 PM',
    period: 'Evening',
    durationMinutes: 90,
    totalCapacity: 10,
  },
  {
    slotId: '17:30-19:00',
    startTime: '17:30',
    endTime: '19:00',
    label: '05:30 PM – 07:00 PM',
    period: 'Evening',
    durationMinutes: 90,
    totalCapacity: 10,
  },
];

export const DynamicSlotPicker: React.FC<DynamicSlotPickerProps> = ({
  selectedSlot,
  onSelectSlot,
  selectedDate,
  jurisdictionName = 'Central Delhi (JUR-DL-01)',
  totalFleetSize = 10,
  bookedSlotCounts = {},
}) => {
  const calculatedSlots: TimeSlotOption[] = useMemo(() => {
    return STANDARD_SLOTS.map((slot) => {
      const booked = bookedSlotCounts[slot.slotId] || 0;
      const capacity = totalFleetSize;
      const remaining = Math.max(0, capacity - booked);
      return {
        ...slot,
        totalCapacity: capacity,
        bookedCount: booked,
        remainingSlots: remaining,
        isAvailable: remaining > 0,
      };
    });
  }, [bookedSlotCounts, totalFleetSize]);

  const totalDailyCapacity = totalFleetSize * STANDARD_SLOTS.length; // 10 * 6 = 60 slots
  const totalDailyBooked = Object.values(bookedSlotCounts).reduce((a, b) => a + b, 0);
  const totalDailyRemaining = Math.max(0, totalDailyCapacity - totalDailyBooked);

  // Group by morning vs afternoon/evening
  const morningSlots = calculatedSlots.filter((s) => s.period === 'Morning');
  const postLunchSlots = calculatedSlots.filter((s) => s.period !== 'Morning');

  const renderSlotCard = (slot: TimeSlotOption) => {
    const isSelected = selectedSlot === slot.slotId;
    const isFull = !slot.isAvailable;
    const isFillingFast = slot.remainingSlots > 0 && slot.remainingSlots <= 3;

    let badgeColor = 'border-emerald-200 bg-emerald-50 text-[#15803D]';
    let badgeText = `${slot.remainingSlots} / ${slot.totalCapacity} Open`;
    let StatusIcon = CheckCircle;

    if (isFull) {
      badgeColor = 'border-red-200 bg-red-50 text-red-700';
      badgeText = 'Fully Booked (0 left)';
      StatusIcon = XCircle;
    } else if (isFillingFast) {
      badgeColor = 'border-amber-200 bg-amber-50 text-amber-800';
      badgeText = `Filling Fast (${slot.remainingSlots} left)`;
      StatusIcon = AlertTriangle;
    }

    return (
      <button
        key={slot.slotId}
        type="button"
        disabled={isFull}
        onClick={() => onSelectSlot(slot.slotId)}
        aria-pressed={isSelected}
        className={`relative rounded-md border text-left p-3 transition-colors cursor-pointer ${
          isSelected
            ? 'border-[#1E4FA3] bg-[#EFF6FF]'
            : isFull
            ? 'border-[#CBD5E1] bg-[#F5F7FA] opacity-60 cursor-not-allowed'
            : 'border-[#CBD5E1] bg-white hover:border-[#94A3B8]'
        }`}
      >
        {/* Slot time — strongest text in the card */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#1E4FA3]' : 'text-[#172B4D]/40'}`} />
            <span className="text-[15px] font-semibold text-[#12324A] leading-tight truncate">
              {slot.label}
            </span>
          </div>
          {isSelected && (
            <CheckCircle className="w-4 h-4 text-[#1E4FA3] shrink-0" aria-hidden="true" />
          )}
        </div>

        {/* Period + compact availability badge */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-[#172B4D]/60">
            {slot.period} · 1.5 hrs
          </span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-semibold shrink-0 ${badgeColor}`}
          >
            <StatusIcon className="w-3 h-3" aria-hidden="true" />
            <span>{badgeText}</span>
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Capacity summary — compact strip, strong numbers, no card nesting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 border-y border-[#CBD5E1] py-2.5">
        <div className="flex items-center gap-2 text-[13px] text-[#172B4D]/70 min-w-0">
          <Users className="w-4 h-4 text-[#1E4FA3] shrink-0" />
          <span className="min-w-0">
            Area: <strong className="font-semibold text-[#12324A]">{jurisdictionName}</strong>
            <span className="mx-1.5 text-[#CBD5E1]">·</span>
            <strong className="font-semibold text-[#12324A]">{totalFleetSize}</strong> certified
            inspectors
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] text-[#172B4D]/60">Daily Capacity</span>
          <span className="text-[16px] font-bold text-[#12324A] leading-none">
            {totalDailyRemaining}
            <span className="text-[13px] font-medium text-[#172B4D]/40"> / {totalDailyCapacity}</span>
          </span>
          <span className="text-[12px] text-[#172B4D]/60">slots/day</span>
        </div>
      </div>

      {/* Morning Shift (09:00 - 12:00) */}
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wide text-[#172B4D]/70 mb-1.5">
          Morning Inspection Shift (09:00 AM – 12:00 PM)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {morningSlots.map(renderSlotCard)}
        </div>
      </div>

      {/* Official Lunch & Calibration Recess (12:00 - 13:00) — compact informational notice */}
      <div className="border border-amber-200 bg-amber-50/60 rounded-md px-3 py-2 flex items-center gap-2.5">
        <Coffee className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-amber-900 leading-snug">
            12:00 PM – 01:00 PM · Official Lunch &amp; Calibration Recess
          </div>
          <div className="text-[12px] text-amber-800/80 leading-snug">
            Departmental testing &amp; field inspection paused.
          </div>
        </div>
        <span className="px-1.5 py-0.5 rounded border border-amber-300 bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wide shrink-0">
          1 Hr Recess
        </span>
      </div>

      {/* Afternoon & Evening Shift (13:00 - 19:00) */}
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wide text-[#172B4D]/70 mb-1.5">
          Afternoon &amp; Evening Inspection Shift (01:00 PM – 07:00 PM)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {postLunchSlots.map(renderSlotCard)}
        </div>
      </div>

      <p className="text-[11px] text-[#172B4D]/50 italic leading-relaxed">
        * Standard departmental verification sessions run for 1.5 hours per instrument. 6 daily
        slot windows across {totalFleetSize} certified inspectors provide a maximum quota of{' '}
        {totalDailyCapacity} verification slots per day for this zone.
      </p>
    </div>
  );
};
