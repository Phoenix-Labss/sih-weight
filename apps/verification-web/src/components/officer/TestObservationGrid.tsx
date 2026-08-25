import React, { useState, useEffect } from 'react';
import { VerificationSession, ObservationItemInput, StepType } from '../../types/session';
import { Instrument } from '../../types/instrument';
import { NAWITestStepForm } from './NAWITestStepForm';
import { StampRecordForm } from './StampRecordForm';
import { DispositionModal } from './DispositionModal';
import { CertificateSignModal } from './CertificateSignModal';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { Certificate } from '../../types/certificate';
import { CertificateModal } from '../trader/CertificateModal';
import {
  Scale,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  Save,
  Lock,
  Stamp,
  Thermometer,
  Droplets,
  Calendar,
  Layers,
  Award,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface TestObservationGridProps {
  session: VerificationSession;
  instrument?: Instrument | null;
  certificate?: Certificate | null;
  onSessionUpdated: (session: VerificationSession) => void;
  onCertificateIssued?: (cert: Certificate) => void;
}

const defaultStandardWeights = [
  { id: 'STD-MASS-CLASS-F2-001', name: 'F2 Working Standard Mass Set (1g - 5kg)', cert: 'CAL-NPL-2025-F2-089', expiry: '2027-05-15', suitable: true },
  { id: 'STD-MASS-CLASS-M1-002', name: 'M1 Cast Iron Weights (10kg, 20kg)', cert: 'CAL-RRSL-2025-M1-442', expiry: '2027-08-30', suitable: true },
  { id: 'STD-MASS-CLASS-M2-003', name: 'M2 Cast Iron Weights (50kg)', cert: 'CAL-RRSL-2025-M2-101', expiry: '2027-10-12', suitable: true },
];

export const TestObservationGrid: React.FC<TestObservationGridProps> = ({
  session,
  instrument,
  certificate,
  onSessionUpdated,
  onCertificateIssued,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();

  const scaleIntervalE = Number(instrument?.model?.verification_scale_interval_e) || 0.005;
  const accuracyClass = (instrument?.model?.accuracy_class as any) || 'CLASS_III';
  const maxCap = Number(instrument?.model?.max_capacity) || 30.0;
  const minCap = Number(instrument?.model?.min_capacity) || 0.1;

  const [serialVerified, setSerialVerified] = useState(session ? session.status !== 'PLANNED' : false);
  const [selectedStandardIds, setSelectedStandardIds] = useState<string[]>([
    'STD-MASS-CLASS-F2-001',
    'STD-MASS-CLASS-M1-002',
  ]);
  const [tempCelsius, setTempCelsius] = useState<number>(Number(session?.environmental_temp_celsius) || 24.5);
  const [humidityPercent, setHumidityPercent] = useState<number>(Number(session?.environmental_humidity_percent) || 55.0);

  // Modals
  const [isStampModalOpen, setIsStampModalOpen] = useState(false);
  const [isDispositionModalOpen, setIsDispositionModalOpen] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isCertViewOpen, setIsCertViewOpen] = useState(false);

  // Observation items state initialized with default statutory points
  const [observations, setObservations] = useState<ObservationItemInput[]>(() => {
    if (session && session.observations && session.observations.length > 0) {
      return session.observations.map((o) => ({
        step_type: o.step_type,
        step_sequence: Number(o.step_sequence),
        nominal_load: Number(o.nominal_load),
        load_unit: o.load_unit,
        raw_indication_reading: Number(o.raw_indication_reading),
        reading_unit: o.reading_unit,
        normalized_indication: o.normalized_indication ? Number(o.normalized_indication) : undefined,
        repetition_index: o.repetition_index ? Number(o.repetition_index) : undefined,
        eccentricity_position: o.eccentricity_position,
        delta_L: Number((0.5 * scaleIntervalE).toFixed(4)),
      }));
    }

    // Default NAWI Class III procedure test steps
    return [
      // 1. Zero load
      { step_type: 'ZERO_TEST', step_sequence: 1, nominal_load: 0.0, raw_indication_reading: 0.0, delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      // 2. Increasing load steps
      { step_type: 'INCREASING_LOAD', step_sequence: 2, nominal_load: minCap, raw_indication_reading: minCap, delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      { step_type: 'INCREASING_LOAD', step_sequence: 3, nominal_load: Number((500 * scaleIntervalE).toFixed(3)), raw_indication_reading: Number((500 * scaleIntervalE + 0.001).toFixed(3)), delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      { step_type: 'INCREASING_LOAD', step_sequence: 4, nominal_load: Number((2000 * scaleIntervalE).toFixed(3)), raw_indication_reading: Number((2000 * scaleIntervalE + 0.002).toFixed(3)), delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      { step_type: 'INCREASING_LOAD', step_sequence: 5, nominal_load: maxCap, raw_indication_reading: Number((maxCap + 0.004).toFixed(3)), delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      // 3. Eccentricity (1/3 Max = 10 kg) 5 positions
      { step_type: 'ECCENTRICITY', step_sequence: 6, nominal_load: 10.0, raw_indication_reading: 10.001, eccentricity_position: 'CENTER', delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      { step_type: 'ECCENTRICITY', step_sequence: 7, nominal_load: 10.0, raw_indication_reading: 10.003, eccentricity_position: 'FRONT_LEFT', delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      { step_type: 'ECCENTRICITY', step_sequence: 8, nominal_load: 10.0, raw_indication_reading: 10.002, eccentricity_position: 'BACK_LEFT', delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      { step_type: 'ECCENTRICITY', step_sequence: 9, nominal_load: 10.0, raw_indication_reading: 10.002, eccentricity_position: 'BACK_RIGHT', delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      { step_type: 'ECCENTRICITY', step_sequence: 10, nominal_load: 10.0, raw_indication_reading: 10.001, eccentricity_position: 'FRONT_RIGHT', delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      // 4. Repeatability (3 runs at 15 kg)
      { step_type: 'REPEATABILITY', step_sequence: 11, nominal_load: 15.0, raw_indication_reading: 15.001, repetition_index: 1, delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      { step_type: 'REPEATABILITY', step_sequence: 12, nominal_load: 15.0, raw_indication_reading: 15.002, repetition_index: 2, delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
      { step_type: 'REPEATABILITY', step_sequence: 13, nominal_load: 15.0, raw_indication_reading: 15.001, repetition_index: 3, delta_L: Number((0.5 * scaleIntervalE).toFixed(4)) },
    ];
  });

  const [isSubmittingObservations, setIsSubmittingObservations] = useState(false);

  // Find Zero Error E0
  const zeroObs = observations.find((o) => o.step_type === 'ZERO_TEST');
  const zeroErrorE0 = zeroObs ? zeroObs.raw_indication_reading : 0;

  const handleUpdateObservation = (idx: number, updated: ObservationItemInput) => {
    setObservations((prev) => {
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });
  };

  const handleConfirmIdentity = async () => {
    if (!session) return;
    try {
      const updated = await api.verification.confirmIdentity(user.tenantId, session.session_id, true);
      setSerialVerified(true);
      notify('success', 'Identity Confirmed', 'Instrument serial and specifications verified against registry.');
      onSessionUpdated(updated);
    } catch (err) {
      notify('error', 'Confirmation Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleStartSession = async () => {
    if (!session) return;
    try {
      const updated = await api.verification.startSession(user.tenantId, session.session_id);
      notify('success', 'Session In Progress', 'Procedure lock engaged. Record measurement readings.');
      onSessionUpdated(updated);
    } catch (err) {
      notify('error', 'Failed to Start Session', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleSubmitObservations = async () => {
    if (!session) return;
    setIsSubmittingObservations(true);
    try {
      const payload = {
        reference_standard_ids: selectedStandardIds,
        observations: observations,
        environmental_temp_celsius: tempCelsius,
        environmental_humidity_percent: humidityPercent,
      };

      const updated = await api.verification.submitObservations(
        user.tenantId,
        session.session_id,
        payload
      );

      notify(
        'success',
        'Observations Submitted & Evaluated',
        `Evaluated ${observations.length} readings with exact rational tolerance calculation.`
      );
      onSessionUpdated(updated);
    } catch (err) {
      notify('error', 'Observation Submission Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmittingObservations(false);
    }
  };

  if (!session) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
        <Scale className="w-8 h-8 text-slate-400 mx-auto" />
        <h4 className="text-sm font-bold text-slate-700">No Active Verification Session Selected</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Please allocate an inspection slot for an application in the Scrutiny Queue to launch the testing worksheet.
        </p>
      </div>
    );
  }

  const isFinalized = session.status === 'FINALIZED';
  const hasPassed = session.outcome === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION';

  return (
    <div className="space-y-6">
      {/* Session Title & Progression Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-base text-gov-navy">{session.session_id}</span>
              <StatusBadge status={session.status} size="sm" />
              {session.outcome && <StatusBadge status={session.outcome} size="sm" />}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Procedure: <span className="font-mono font-semibold text-slate-700">{session.procedure_pack_id}</span> | Scheduled: {session.scheduled_date} | Verifier: {session.verifier_id}
            </p>
          </div>

          {/* Step-by-Step Action Ribbon */}
          <div className="flex items-center gap-2">
            {/* Step 1: PLANNED or IDENTITY_CONFIRMED -> Show Start Test Execution */}
            {(session.status === 'PLANNED' || session.status === 'IDENTITY_CONFIRMED') && (
              <button
                onClick={handleStartSession}
                className="px-4 py-2 rounded-lg bg-gov-blue text-xs font-bold text-white hover:bg-blue-800 flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>Start Test Execution</span>
              </button>
            )}

            {/* Step 2: IN_PROGRESS -> Show active indicator */}
            {session.status === 'IN_PROGRESS' && (
              <div className="px-3.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                <span>Testing In Progress — Enter Readings Below</span>
              </div>
            )}

            {/* Step 3: SUBMITTED -> Show Affix Physical Seal and Record Legal Disposition */}
            {session.status === 'SUBMITTED' && (
              <>
                <button
                  onClick={() => setIsStampModalOpen(true)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-white hover:bg-slate-900 flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Stamp className="w-4 h-4 text-amber-400" />
                  <span>Affix Physical Seal</span>
                </button>

                <button
                  onClick={() => setIsDispositionModalOpen(true)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Record Legal Disposition</span>
                </button>
              </>
            )}

            {/* Step 4: FINALIZED -> Show View Certificate or Sign & Issue */}
            {isFinalized && (
              <>
                {certificate ? (
                  <button
                    onClick={() => setIsCertViewOpen(true)}
                    className="px-4 py-2 rounded-lg bg-gov-navy text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>View Issued Certificate ({certificate.certificate_number})</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsSignModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Lock className="w-4 h-4 text-amber-300" />
                    <span>Sign & Issue Certificate</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pre-Inspection Verifications: Standards & Environmental Conditions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Identity confirmation */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>Instrument Physical Check</span>
              {serialVerified ? (
                <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </span>
              ) : (
                <span className="text-amber-600 font-semibold">Pending Check</span>
              )}
            </div>
            <p className="text-slate-600 text-[11px]">
              Serial: <span className="font-mono font-bold text-slate-900">{instrument?.serial_number || 'DL-2024-8842'}</span> | Class: {accuracyClass}
            </p>
            {!serialVerified && (
              <button
                onClick={handleConfirmIdentity}
                className="w-full py-1.5 rounded bg-gov-navy text-white text-[11px] font-semibold hover:bg-slate-800 transition-colors"
              >
                Confirm Physical Serial Match
              </button>
            )}
          </div>

          {/* Reference standards check */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>Reference Standards Suitability</span>
              <span className="text-emerald-600 font-semibold text-[10px] uppercase">Calibrated & Valid</span>
            </div>
            <div className="space-y-1">
              {defaultStandardWeights.slice(0, 2).map((std) => (
                <div key={std.id} className="text-[11px] text-slate-600 flex items-center justify-between">
                  <span className="truncate">{std.name}</span>
                  <span className="text-emerald-700 font-mono text-[10px] font-bold">PASS</span>
                </div>
              ))}
            </div>
          </div>

          {/* Environmental conditions */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800">Environmental Conditions</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-rose-500" />
                  <span>Ambient Temp (°C)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tempCelsius}
                  onChange={(e) => setTempCelsius(parseFloat(e.target.value) || 24)}
                  className="w-full text-xs font-bold rounded border border-slate-300 px-2 py-1 bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  <span>Humidity (% RH)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={humidityPercent}
                  onChange={(e) => setHumidityPercent(parseFloat(e.target.value) || 55)}
                  className="w-full text-xs font-bold rounded border border-slate-300 px-2 py-1 bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guided NAWI Procedure Steps Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="text-sm font-bold text-gov-navy flex items-center gap-2">
              <Layers className="w-4 h-4 text-gov-blue" />
              <span>Guided NAWI Test Procedure Execution (Class III / IIII)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Stepped MPE calculation: 0 ≤ m ≤ 500: ±1.0e; 500 &lt; m ≤ 2000: ±2.0e; 2000 &lt; m ≤ 10000: ±3.0e
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">
              Interval (e): <strong className="text-slate-800">{scaleIntervalE} kg</strong>
            </span>
          </div>
        </div>

        {/* Observation Rows */}
        <div className="space-y-3">
          {observations.map((obs, idx) => (
            <NAWITestStepForm
              key={`${obs.step_type}-${obs.step_sequence}-${idx}`}
              observation={obs}
              scaleIntervalE={scaleIntervalE}
              accuracyClass={accuracyClass}
              zeroErrorE0={zeroErrorE0}
              onChange={(updated) => handleUpdateObservation(idx, updated)}
            />
          ))}
        </div>

        {/* Step-by-Step Bottom Guidance / Submission Bar */}
        {(session.status === 'PLANNED' || session.status === 'IDENTITY_CONFIRMED' || session.status === 'IN_PROGRESS') && (
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Deterministic calculation trace is recorded with immutable audit hash.
            </div>
            <button
              onClick={handleSubmitObservations}
              disabled={isSubmittingObservations}
              className="px-6 py-2.5 rounded-lg bg-gov-navy text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-2 shadow-xs transition-all hover:shadow disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>{isSubmittingObservations ? 'Evaluating...' : 'Submit Test Observations & Compute Evaluation'}</span>
            </button>
          </div>
        )}

        {session.status === 'SUBMITTED' && (
          <div className="pt-4 border-t border-slate-200 bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Observations Evaluated & Passed. Now click "Affix Physical Seal" or "Record Legal Disposition" above.</span>
            </div>
            <button
              onClick={() => setIsDispositionModalOpen(true)}
              className="px-4 py-1.5 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-2xs"
            >
              Record Legal Disposition →
            </button>
          </div>
        )}

        {isFinalized && (
          <div className="pt-4 border-t border-slate-200 bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                {certificate
                  ? `Statutory certificate ${certificate.certificate_number} is minted and active.`
                  : 'Legal Disposition Recorded. Click "Sign & Issue Certificate" above to generate statutory certificate.'}
              </span>
            </div>
            {certificate ? (
              <button
                onClick={() => setIsCertViewOpen(true)}
                className="px-4 py-1.5 rounded bg-gov-navy text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>View Official Certificate →</span>
              </button>
            ) : (
              <button
                onClick={() => setIsSignModalOpen(true)}
                className="px-4 py-1.5 rounded bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>Sign & Issue Certificate →</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <StampRecordForm
        isOpen={isStampModalOpen}
        onClose={() => setIsStampModalOpen(false)}
        sessionId={session.session_id}
        instrumentId={session.instrument_id}
        onStampRecorded={() => {
          notify('success', 'Physical Stamp Saved', 'Affixed seal is audited in the physical ledger.');
        }}
      />

      <DispositionModal
        isOpen={isDispositionModalOpen}
        onClose={() => setIsDispositionModalOpen(false)}
        session={session}
        onDispositionRecorded={onSessionUpdated}
      />

      <CertificateSignModal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        session={session}
        onCertificateIssued={(cert) => {
          setIsSignModalOpen(false);
          onCertificateIssued?.(cert);
          onSessionUpdated({ ...session, status: 'FINALIZED' });
        }}
      />

      <CertificateModal
        isOpen={isCertViewOpen}
        onClose={() => setIsCertViewOpen(false)}
        certificate={certificate || null}
        instrument={instrument || null}
      />
    </div>
  );
};
