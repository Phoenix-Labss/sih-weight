import React from 'react';
import { InstrumentSummaryPublic } from '../../types/public';
import { Scale, Shield, Building, Tag, CheckSquare } from 'lucide-react';

interface InstrumentSummaryCardProps {
  summary: InstrumentSummaryPublic;
  issuingAuthority: string;
}

export const InstrumentSummaryCard: React.FC<InstrumentSummaryCardProps> = ({
  summary,
  issuingAuthority,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-gov-blue" />
          <h3 className="font-bold text-gov-navy uppercase tracking-wider text-xs">
            Technical Particulars (Public Verification)
          </h3>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          Zero-PII Protected
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <span className="text-slate-500 block text-[11px]">Instrument Category:</span>
          <span className="font-semibold text-slate-900">{summary.category}</span>
        </div>

        <div>
          <span className="text-slate-500 block text-[11px]">Model & Type:</span>
          <span className="font-semibold text-slate-900">{summary.model_name || summary.subtype}</span>
        </div>

        <div>
          <span className="text-slate-500 block text-[11px]">Accuracy Class:</span>
          <span className="font-bold text-gov-navy text-xs">{summary.accuracy_class}</span>
        </div>

        <div>
          <span className="text-slate-500 block text-[11px]">Physical Serial Number:</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-900 text-sm">{summary.masked_serial_number}</span>
            <span className="text-[10px] text-slate-400 font-sans">(Masked for Privacy)</span>
          </div>
        </div>

        <div>
          <span className="text-slate-500 block text-[11px]">Maximum Capacity (Max):</span>
          <span className="font-bold text-slate-800">
            {summary.max_capacity} {summary.capacity_unit}
          </span>
        </div>

        <div>
          <span className="text-slate-500 block text-[11px]">Verification Scale Interval (e):</span>
          <span className="font-semibold text-slate-800">
            {summary.scale_interval_e} {summary.scale_interval_unit}
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100">
        <span className="text-slate-500 block text-[11px] mb-0.5">Issuing Legal Metrology Authority:</span>
        <span className="font-semibold text-slate-800 leading-tight block">
          {issuingAuthority}
        </span>
      </div>
    </div>
  );
};
