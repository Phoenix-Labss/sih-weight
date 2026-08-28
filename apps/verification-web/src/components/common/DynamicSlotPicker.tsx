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

    let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    let badgeText = `${slot.remainingSlots} / ${slot.totalCapacity} Open`;
    let StatusIcon = CheckCircle;

    if (isFull) {
      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
      badgeText = 'Fully Booked (0 left)';
      StatusIcon = XCircle;
    } else if (isFillingFast) {
      badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
      badgeText = `Filling Fast (${slot.remainingSlots} left)`;
      StatusIcon = AlertTriangle;
    }

    return (
      <button
        key={slot.slotId}
        type="button"
        disabled={isFull}
        onClick={() => onSelectSlot(slot.slotId)}
        className={`p-3 rounded-xl border text-left transition-all relative cursor-pointer ${
          isSelected
            ? 'border-gov-blue bg-blue-50/70 ring-2 ring-gov-blue/30 shadow-xs'
            : isFull
            ? 'border-slate-200 bg-slate-100/60 opacity-60 cursor-not-allowed'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
        }`}
      >
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-gov-blue' : 'text-slate-500'}`} />
            <span>{slot.label}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            {slot.period} (1.5 hrs)
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${badgeColor}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            <span>{badgeText}</span>
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Capacity Header Overview */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <Users className="w-4 h-4 text-gov-blue" />
          <span>
            Area: <strong className="text-slate-900">{jurisdictionName}</strong> (<strong>{totalFleetSize}</strong> certified inspectors)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono">
            Daily Capacity: <strong className="text-gov-navy">{totalDailyRemaining} / {totalDailyCapacity}</strong> slots open (60 slots/day)
          </span>
        </div>
      </div>

      {/* Morning Shift (09:00 - 12:00) */}
      <div>
        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <span>Morning Inspection Shift (09:00 AM – 12:00 PM)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {morningSlots.map(renderSlotCard)}
        </div>
      </div>

      {/* Departmental Lunch & Recess (12:00 - 13:00) */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
            <Coffee className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-amber-950">12:00 PM – 01:00 PM: Official Lunch &amp; Calibration Recess</div>
            <div className="text-[11px] text-amber-800">
              Departmental testing &amp; field inspection paused for reference standard thermal equilibrium &amp; lunch.
            </div>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded bg-amber-200/70 text-amber-900 text-[10px] font-extrabold uppercase tracking-wide shrink-0">
          1 Hr Recess
        </span>
      </div>

      {/* Afternoon & Evening Shift (13:00 - 19:00) */}
      <div>
        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <span>Afternoon &amp; Evening Inspection Shift (01:00 PM – 07:00 PM)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2.5">
          {postLunchSlots.map(renderSlotCard)}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 italic">
        * Standard departmental verification sessions run for 1.5 hours per instrument. 6 daily slot windows across 10 certified inspectors provide a maximum quota of 60 verification slots per day for this zone.
      </p>
    </div>
  );
};
