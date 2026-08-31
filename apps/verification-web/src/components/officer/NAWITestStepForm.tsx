import React from 'react';
import { ObservationItemInput } from '../../types/session';
import { evaluateNAWIObservation } from '../../utils/nawiCalculations';
import { CheckCircle2, XCircle } from 'lucide-react';

interface NAWITestStepFormProps {
  observation: ObservationItemInput;
  scaleIntervalE: number;
  accuracyClass: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII';
  zeroErrorE0: number;
  readOnly?: boolean;
  onChange: (updated: ObservationItemInput) => void;
}

export const NAWITestStepForm: React.FC<NAWITestStepFormProps> = ({
  observation,
  scaleIntervalE,
  accuracyClass,
  zeroErrorE0,
  readOnly = false,
  onChange,
}) => {
  const evalResult = evaluateNAWIObservation({
    nominalLoad: observation.nominal_load,
    rawIndication: observation.raw_indication_reading,
    deltaL: observation.delta_L,
    scaleIntervalE: scaleIntervalE,
    accuracyClass: accuracyClass,
    zeroErrorE0: observation.step_type === 'ZERO_TEST' ? 0 : zeroErrorE0,
  });

  return (
    <div className={`p-3.5 rounded-xl border transition-all text-xs ${
      evalResult.isWithinMpe ? 'border-slate-200 bg-white' : 'border-red-300 bg-red-50/40'
    }`}>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
        {/* Step Sequence & Type */}
        <div className="md:col-span-2 space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xs text-slate-700">
              {observation.step_sequence}
            </span>
            <span>{observation.step_type.replace(/_/g, ' ')}</span>
            {observation.eccentricity_position && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                {observation.eccentricity_position}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Nominal Load (L): {observation.nominal_load} {observation.load_unit || 'kg'}
          </div>
        </div>

        {/* Raw Indication Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Indication (I) [{observation.reading_unit || 'kg'}]
          </label>
          <input
            type="number"
            step="any"
            disabled={readOnly}
            value={observation.raw_indication_reading}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              onChange({
                ...observation,
                raw_indication_reading: val,
              });
            }}
            className="w-full text-xs font-mono font-bold rounded-lg border border-slate-300 px-2.5 py-1.5 focus:ring-2 focus:ring-gov-blue disabled:bg-slate-100 disabled:text-slate-900 disabled:cursor-not-allowed"
          />
        </div>

        {/* Delta L (Small weights) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Turning ΔL [{observation.reading_unit || 'kg'}]
          </label>
          <input
            type="number"
            step="any"
            disabled={readOnly}
            placeholder={`0.5e = ${(0.5 * scaleIntervalE).toFixed(4)}`}
            value={observation.delta_L !== undefined ? observation.delta_L : (0.5 * scaleIntervalE)}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChange({
                ...observation,
                delta_L: isNaN(val) ? 0 : val,
              });
            }}
            className="w-full text-xs font-mono rounded-lg border border-slate-300 px-2.5 py-1.5 focus:ring-2 focus:ring-gov-blue disabled:bg-slate-100 disabled:text-slate-900 disabled:cursor-not-allowed"
          />
        </div>

        {/* Live Calculation Output */}
        <div className="space-y-0.5 font-mono text-xs">
          <div className="text-slate-500 text-xs">
            Error E_c: <span className="font-bold text-slate-900">{evalResult.correctedError >= 0 ? `+${evalResult.correctedError}` : evalResult.correctedError} kg</span>
          </div>
          <div className="text-slate-500 text-xs">
            MPE Limit: <span className="font-semibold text-slate-700">± {evalResult.mpeAllowed} kg</span>
          </div>
        </div>

        {/* Live Pass/Fail Status */}
        <div className="flex justify-end md:justify-center">
          {evalResult.isWithinMpe ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>PASS</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              <XCircle className="w-3.5 h-3.5" />
              <span>FAIL (Out of MPE)</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
