import React, { useMemo } from 'react';
import { Clock, CheckCircle, AlertTriangle, XCircle, Users } from 'lucide-react';

export interface TimeSlotOption {
  slotId: string;
  startTime: string; // "09:00"
  endTime: string;   // "11:00"
  label: string;     // "09:00 AM – 11:00 AM"
  period: 'Morning' | 'Afternoon' | 'Evening';
  totalCapacity: number; // e.g. 10
  bookedCount: number;
  remainingSlots: number;
  isAvailable: boolean;
}

interface DynamicSlotPickerProps {
  selectedSlot: string; // e.g. "09:00-11:00"
  onSelectSlot: (slotId: string) => void;
  selectedDate: string; // "YYYY-MM-DD"
  jurisdictionName?: string;
  totalFleetSize?: number;
  bookedSlotCounts?: Record<string, number>; // slotId -> count
}

export const STANDARD_SLOTS: Omit<TimeSlotOption, 'bookedCount' | 'remainingSlots' | 'isAvailable'>[] = [
  {
    slotId: '09:00-11:00',
    startTime: '09:00',
    endTime: '11:00',
    label: '09:00 AM – 11:00 AM',
    period: 'Morning',
    totalCapacity: 10,
  },
  {
    slotId: '11:00-13:00',
    startTime: '11:00',
    endTime: '13:00',
    label: '11:00 AM – 01:00 PM',
    period: 'Morning',
    totalCapacity: 10,
  },
  {
    slotId: '13:00-15:00',
    startTime: '13:00',
    endTime: '15:00',
    label: '01:00 PM – 03:00 PM',
    period: 'Afternoon',
    totalCapacity: 10,
  },
  {
    slotId: '15:00-17:00',
    startTime: '15:00',
    endTime: '17:00',
    label: '03:00 PM – 05:00 PM',
    period: 'Afternoon',
    totalCapacity: 10,
  },
  {
    slotId: '17:00-19:00',
    startTime: '17:00',
    endTime: '19:00',
    label: '05:00 PM – 07:00 PM',
    period: 'Evening',
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

  const totalDailyCapacity = totalFleetSize * STANDARD_SLOTS.length;
  const totalDailyBooked = Object.values(bookedSlotCounts).reduce((a, b) => a + b, 0);
  const totalDailyRemaining = Math.max(0, totalDailyCapacity - totalDailyBooked);

  return (
    <div className="space-y-3">
      {/* Capacity Header Overview */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <Users className="w-4 h-4 text-gov-blue" />
          <span>
            Area: <strong className="text-slate-900">{jurisdictionName}</strong> (<strong>{totalFleetSize}</strong> certified inspectors on duty)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono">
            Daily Capacity: <strong>{totalDailyRemaining} / {totalDailyCapacity}</strong> slots open
          </span>
        </div>
      </div>

      {/* Slots List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {calculatedSlots.map((slot) => {
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
                  {slot.period} Window (2 hrs)
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${badgeColor}`}>
                  <StatusIcon className="w-2.5 h-2.5" />
                  <span>{badgeText}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 italic">
        * Standard departmental verification slots run in 2-hour inspection windows between 09:00 AM and 07:00 PM. Each area capacity is enforced dynamically by inspector fleet availability.
      </p>
    </div>
  );
};
