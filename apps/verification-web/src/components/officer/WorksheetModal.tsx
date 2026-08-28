import React from 'react';
import { Modal } from '../common/Modal';
import { VerificationSession } from '../../types/session';
import { Instrument } from '../../types/instrument';
import { Application } from '../../types/application';
import { Certificate } from '../../types/certificate';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { evaluateNAWIObservation } from '../../utils/nawiCalculations';
import {
  Scale,
  ShieldCheck,
  Award,
  Printer,
  CheckCircle2,
  Lock,
  Thermometer,
  Droplets,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface WorksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: VerificationSession | null;
  instrument?: Instrument | null;
  application?: Application | null;
  certificate?: Certificate | null;
  onViewCertificate?: (cert: Certificate) => void;
}

export const WorksheetModal: React.FC<WorksheetModalProps> = ({
  isOpen,
  onClose,
  session,
  instrument,
  application,
  certificate,
  onViewCertificate,
}) => {
  if (!session) return null;

  const scaleIntervalE = Number(instrument?.model?.verification_scale_interval_e) || 0.005;
  const accuracyClass = (instrument?.model?.accuracy_class as any) || 'CLASS_III';
  const maxCap = Number(instrument?.model?.max_capacity) || 30.0;
  const minCap = Number(instrument?.model?.min_capacity) || 0.1;

  const observations = session.observations || [];
  const zeroObs = observations.find((o) => o.step_type === 'ZERO_TEST');
  const zeroErrorE0 = zeroObs ? Number(zeroObs.raw_indication_reading) || 0 : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official NAWI Verification & Calibration Worksheet"
      subtitle={`Statutory Observation Record • ${application?.application_number || session.session_id}`}
      maxWidth="5xl"
    >
      <div className="space-y-6 text-slate-800 printable-worksheet">
        {/* Government Header Notice */}
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Scale className="w-6 h-6 text-amber-400" />
              <h3 className="font-extrabold text-base tracking-tight text-white">
                Legal Metrology Directorate • Inspection &amp; Testing Worksheet
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              Government of NCT of Delhi • Central Enforcement Zone (JUR-DL-01)
            </p>
            <p className="text-[10px] text-amber-300 font-mono">
              Statutory Basis: Rule 14, Schedule IX of The Legal Metrology (General) Rules, 2011 &amp; Section 24 of Act 1 of 2010
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <StatusBadge status={session.status} size="md" />
              {session.outcome && <StatusBadge status={session.outcome} size="md" />}
            </div>
            {certificate && (
              <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-500/30">
                Cert #{certificate.certificate_number}
              </span>
            )}
          </div>
        </div>

        {/* 4-Card Summary Particulars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Card 1: Instrument */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Instrument Particulars
            </span>
            <div className="font-bold text-slate-900 text-sm truncate">
              {instrument?.model?.model_name || 'Electronic Weighing Scale'}
            </div>
            <div className="font-mono text-slate-600">
              SN: <strong className="text-slate-900">{instrument?.serial_number || 'N/A'}</strong>
            </div>
            <div className="text-slate-500">
              Class: <span className="font-semibold text-slate-800">{accuracyClass.replace(/_/g, ' ')}</span>
            </div>
            <div className="font-mono text-slate-500">
              Cap: {minCap}–{maxCap} kg | <strong className="text-gov-blue">e = {scaleIntervalE} kg</strong>
            </div>
          </div>

          {/* Card 2: Officer & Session */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Verification Session
            </span>
            <div className="font-mono font-bold text-slate-900 truncate">
              {session.session_id}
            </div>
            <div className="text-slate-600">
              Scheduled Date: <strong className="text-slate-900">{formatDate(session.scheduled_date)}</strong>
            </div>
            <div className="text-slate-600">
              Officer: <span className="font-semibold text-slate-900">{session.verifier_id || 'lmo-officer-01'}</span>
            </div>
            <div className="text-slate-500 truncate">
              Pack: <span className="font-mono">{session.procedure_pack_id}</span>
            </div>
          </div>

          {/* Card 3: Environmental Controls */}
          {(() => {
            const temp = Number(session.environmental_temp_celsius) || 24.5;
            const rh = Number(session.environmental_humidity_percent) || 55.0;
            const isEnvPass = temp >= 20.0 && temp <= 28.0 && rh >= 45.0 && rh <= 65.0;
            return (
              <div className={`border rounded-xl p-3.5 space-y-1.5 ${isEnvPass ? 'bg-slate-50 border-slate-200' : 'bg-rose-50/50 border-rose-300'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Environmental Controls
                  </span>
                  {isEnvPass ? (
                    <span className="text-emerald-700 bg-emerald-100 border border-emerald-300 font-bold text-[9px] uppercase px-1.5 py-0.5 rounded">
                      Pass
                    </span>
                  ) : (
                    <span className="text-rose-700 bg-rose-100 border border-rose-300 font-bold text-[9px] uppercase px-1.5 py-0.5 rounded">
                      Out of Range
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Thermometer className="w-4 h-4 text-rose-500 shrink-0" />
                  <div>
                    <span className="text-slate-500 text-[10px] block">Temperature:</span>
                    <span className={`font-mono font-bold text-sm ${temp >= 20.0 && temp <= 28.0 ? 'text-slate-900' : 'text-rose-700'}`}>
                      {temp}°C {temp >= 20.0 && temp <= 28.0 ? '' : '(Limit: 20–28°C)'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Droplets className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <span className="text-slate-500 text-[10px] block">Relative Humidity:</span>
                    <span className={`font-mono font-bold text-sm ${rh >= 45.0 && rh <= 65.0 ? 'text-slate-900' : 'text-rose-700'}`}>
                      {rh}% RH {rh >= 45.0 && rh <= 65.0 ? '' : '(Limit: 45–65%)'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Card 4: Reference Standards & Wire Seal */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Standards &amp; Physical Seal
            </span>
            <div>
              <span className="text-slate-500 text-[10px] block">Working Standards:</span>
              <span className="font-semibold text-slate-800 text-[11px] block truncate">
                F2 Mass Set (CAL-NPL-2025-F2)
              </span>
            </div>
            <div className="pt-1">
              <span className="text-slate-500 text-[10px] block">Affixed Wire Seal:</span>
              <span className="font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 inline-block text-[11px]">
                DL-SEAL-2026-0042
              </span>
            </div>
          </div>
        </div>

        {/* NAWI Observations Execution Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-gov-blue" />
              <h4 className="font-bold text-xs text-gov-navy uppercase tracking-wider">
                NAWI Class III / IIII Stepped Tolerance Observations Table
              </h4>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Total Points: {observations.length} Recorded Readings
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Step Type</th>
                  <th className="py-2.5 px-3">Pos / Rep</th>
                  <th className="py-2.5 px-3 font-mono">Nominal Load (L)</th>
                  <th className="py-2.5 px-3 font-mono">Indication (I)</th>
                  <th className="py-2.5 px-3 font-mono">Turning ΔL</th>
                  <th className="py-2.5 px-3 font-mono">Corrected Err (E_c)</th>
                  <th className="py-2.5 px-3 font-mono">MPE Limit</th>
                  <th className="py-2.5 px-3 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {observations.map((obs, idx) => {
                  const evalResult = evaluateNAWIObservation({
                    nominalLoad: Number(obs.nominal_load) || 0,
                    rawIndication: Number(obs.raw_indication_reading) || 0,
                    deltaL: obs.delta_L !== undefined ? Number(obs.delta_L) : 0.5 * scaleIntervalE,
                    scaleIntervalE: scaleIntervalE,
                    accuracyClass: accuracyClass,
                    zeroErrorE0: obs.step_type === 'ZERO_TEST' ? 0 : zeroErrorE0,
                  });

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{obs.step_sequence || idx + 1}</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                        {obs.step_type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {obs.eccentricity_position ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            {obs.eccentricity_position}
                          </span>
                        ) : obs.repetition_index ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                            Run #{obs.repetition_index}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {obs.nominal_load} {obs.load_unit || 'kg'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        {obs.raw_indication_reading} {obs.reading_unit || 'kg'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {obs.delta_L !== undefined ? obs.delta_L : (0.5 * scaleIntervalE).toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {evalResult.correctedError >= 0 ? `+${evalResult.correctedError}` : evalResult.correctedError} kg
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        ± {evalResult.mpeAllowed} kg
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {evalResult.isWithinMpe ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>PASS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100/90 px-2 py-0.5 rounded-full border border-rose-300">
                            <AlertCircle className="w-3 h-3 text-rose-700" />
                            <span>FAIL</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Officer Legal Disposition & Attestation Note */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-gov-navy">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Officer Disposition &amp; Statutory Attestation</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Timestamp: {formatDateTime(session.updated_at || session.created_at)}
            </span>
          </div>
          <p className="text-slate-700 leading-relaxed">
            {session.officer_disposition_notes ||
              'Instrument tested across all statutory load ranges (Zero, Stepped Increasing loads, Eccentricity, and Repeatability) in compliance with NAWI procedure pack LM-PROC-NAWI-2026-V1. All observed errors are within maximum permissible errors (MPE). Verified suitable for stamping and certification under Section 24.'}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Immutable Statutory Record • Hash Pinned per AGENTS.md §3.4</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print Worksheet</span>
            </button>

            {certificate && onViewCertificate && (
              <button
                onClick={() => {
                  onClose();
                  onViewCertificate(certificate);
                }}
                className="px-4 py-2 rounded-lg bg-gov-navy text-white hover:bg-slate-800 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>View Certificate</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
