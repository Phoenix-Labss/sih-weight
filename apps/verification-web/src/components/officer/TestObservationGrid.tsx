import React, { useState, useEffect } from 'react';
import {
  VerificationSession,
  ObservationItemInput,
  StepType,
  SessionStatus,
  VerificationOutcome,
} from '../../types/session';
import { Application } from '../../types/application';
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
import { PhysicalSerialMatchModal } from './PhysicalSerialMatchModal';
import { PhysicalStamp } from '../../types/stamp';
import { generateStatutoryNAWITestSteps } from '../../utils/nawiCalculations';
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
  application?: Application | null;
  certificate?: Certificate | null;
  onSessionUpdated: (session: VerificationSession) => void;
  onCertificateIssued?: (cert: Certificate) => void;
  onNavigateToLedger?: () => void;
}

const defaultStandardWeights = [
  { id: 'STD-MASS-CLASS-F2-001', name: 'F2 Working Standard Mass Set (1g - 5kg)', cert: 'CAL-NPL-2025-F2-089', expiry: '2027-05-15', suitable: true },
  { id: 'STD-MASS-CLASS-M1-002', name: 'M1 Cast Iron Weights (10kg, 20kg)', cert: 'CAL-RRSL-2025-M1-442', expiry: '2027-08-30', suitable: true },
  { id: 'STD-MASS-CLASS-M2-003', name: 'M2 Cast Iron Weights (50kg)', cert: 'CAL-RRSL-2025-M2-101', expiry: '2027-10-12', suitable: true },
];

export const TestObservationGrid: React.FC<TestObservationGridProps> = ({
  session,
  instrument,
  application,
  certificate,
  onSessionUpdated,
  onCertificateIssued,
  onNavigateToLedger,
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

  // Physical Stamps Tracking
  const [recordedStamps, setRecordedStamps] = useState<PhysicalStamp[]>([]);

  const loadStamps = async () => {
    if (!session) return;
    try {
      const stamps = await api.stamps.listSessionStamps(user.tenantId, session.session_id);
      const uniqueStamps: PhysicalStamp[] = [];
      const seen = new Set<string>();
      for (const s of stamps || []) {
        const id = (s.seal_identification_number || '').trim().toLowerCase();
        if (id && !seen.has(id)) {
          seen.add(id);
          uniqueStamps.push(s);
        }
      }
      setRecordedStamps(uniqueStamps);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStamps();
  }, [session?.session_id, user.tenantId]);

  // Modals
  const [isPhysicalMatchModalOpen, setIsPhysicalMatchModalOpen] = useState(false);
  const [isStampModalOpen, setIsStampModalOpen] = useState(false);
  const [isDispositionModalOpen, setIsDispositionModalOpen] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isCertViewOpen, setIsCertViewOpen] = useState(false);

  // Observation items state initialized with statutory points tailored to the specific machine class
  const [observations, setObservations] = useState<ObservationItemInput[]>(() => {
    if (session && session.observations && session.observations.length > 0) {
      return session.observations.map((o) => ({
        step_type: o.step_type,
        step_sequence: Number(o.step_sequence),
        nominal_load: Number(o.nominal_load),
        load_unit: o.load_unit || 'kg',
        raw_indication_reading: Number(o.raw_indication_reading),
        reading_unit: o.reading_unit || 'kg',
        normalized_indication: o.normalized_indication ? Number(o.normalized_indication) : undefined,
        repetition_index: o.repetition_index ? Number(o.repetition_index) : undefined,
        eccentricity_position: o.eccentricity_position,
        delta_L: o.delta_L !== undefined ? Number(o.delta_L) : Number((0.5 * scaleIntervalE).toFixed(4)),
      }));
    }

    return generateStatutoryNAWITestSteps(instrument?.model);
  });

  // Re-synchronize state whenever session or instrument model changes
  useEffect(() => {
    if (!session) return;
    setSerialVerified(session.status !== 'PLANNED');
    setTempCelsius(Number(session.environmental_temp_celsius) || 24.5);
    setHumidityPercent(Number(session.environmental_humidity_percent) || 55.0);

    if (session.observations && session.observations.length > 0) {
      setObservations(
        session.observations.map((o) => ({
          step_type: o.step_type,
          step_sequence: Number(o.step_sequence),
          nominal_load: Number(o.nominal_load),
          load_unit: o.load_unit || 'kg',
          raw_indication_reading: Number(o.raw_indication_reading),
          reading_unit: o.reading_unit || 'kg',
          normalized_indication: o.normalized_indication ? Number(o.normalized_indication) : undefined,
          repetition_index: o.repetition_index ? Number(o.repetition_index) : undefined,
          eccentricity_position: o.eccentricity_position,
          delta_L: o.delta_L !== undefined ? Number(o.delta_L) : Number((0.5 * scaleIntervalE).toFixed(4)),
        }))
      );
    } else {
      // Auto-generate exact statutory test steps matching the machine's accuracy class and interval
      const autoSteps = generateStatutoryNAWITestSteps(instrument?.model);
      setObservations(autoSteps);
    }
  }, [session?.session_id, session?.status, session?.observations, instrument?.model, scaleIntervalE]);

  const [isSubmittingObservations, setIsSubmittingObservations] = useState(false);

  // Synchronized lifecycle status
  const [currentStatus, setCurrentStatus] = useState<SessionStatus>(session?.status || 'PLANNED');
  const [currentOutcome, setCurrentOutcome] = useState<VerificationOutcome | undefined>(session?.outcome);

  useEffect(() => {
    if (session) {
      setCurrentStatus(session.status);
      setCurrentOutcome(session.outcome);
    }
  }, [session?.session_id, session?.status, session?.outcome]);

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

  const handleConfirmPhysicalMatch = async (physicalSerial: string) => {
    if (!session) return;
    try {
      const updated = await api.verification.confirmIdentity(user.tenantId, session.session_id, true);
      setSerialVerified(true);
      setCurrentStatus('IDENTITY_CONFIRMED');
      notify(
        'success',
        'Physical Match Confirmed',
        `Physical serial '${physicalSerial}' verified against registered specifications. You can now click 'Start Test Execution'.`
      );
      onSessionUpdated(updated);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      notify('error', 'Physical Serial Check Failed', `Reason: ${errMsg}`);
      throw err;
    }
  };

  const handleStartSession = async () => {
    if (!session) {
      notify('error', 'Session Error', 'No active verification session loaded. Please select an application from the scrutiny queue.');
      return;
    }

    if (!serialVerified || currentStatus === 'PLANNED') {
      notify('warning', 'Physical Verification Required', 'Please inspect the instrument physical serial plate and confirm the matchup before starting test execution.');
      setIsPhysicalMatchModalOpen(true);
      return;
    }

    try {
      const updated = await api.verification.startSession(user.tenantId, session.session_id);
      setCurrentStatus('IN_PROGRESS');
      notify('success', 'Session In Progress', 'Procedure lock engaged. Record measurement readings on the NAWI worksheet below.');
      onSessionUpdated(updated);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown verification error';
      notify('error', 'Failed to Start Test Execution', `Reason: ${errMsg}`);
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

      setCurrentStatus('SUBMITTED');
      if (updated.outcome) setCurrentOutcome(updated.outcome);
      if (updated.observations && updated.observations.length > 0) {
        setObservations(
          updated.observations.map((o) => ({
            step_type: o.step_type,
            step_sequence: Number(o.step_sequence),
            nominal_load: Number(o.nominal_load),
            load_unit: o.load_unit || 'kg',
            raw_indication_reading: Number(o.raw_indication_reading),
            reading_unit: o.reading_unit || 'kg',
            normalized_indication: o.normalized_indication ? Number(o.normalized_indication) : undefined,
            repetition_index: o.repetition_index ? Number(o.repetition_index) : undefined,
            eccentricity_position: o.eccentricity_position,
            delta_L: o.delta_L !== undefined ? Number(o.delta_L) : Number((0.5 * scaleIntervalE).toFixed(4)),
          }))
        );
      }

      notify(
        'success',
        'Observations Submitted & Evaluated',
        `Evaluated ${observations.length} readings with exact rational tolerance calculation. Next: Affix physical seal or record legal disposition.`
      );
      onSessionUpdated(updated);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown evaluation error';
      notify('error', 'Observation Submission Failed', `Reason: ${errMsg}`);
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

  const isFinalized = currentStatus === 'FINALIZED';
  const hasPassed = currentOutcome === 'VERIFICATION_PASSED_PENDING_AUTHORIZATION';

  return (
    <div className="space-y-6">
      {/* Session Title & Progression Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-base text-gov-navy">
                {application?.application_number || 'Verification Worksheet'}
              </span>
              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                {session.session_id.length > 18 ? `SESS-${session.session_id.slice(0, 8)}` : session.session_id}
              </span>
              <StatusBadge status={currentStatus} size="sm" />
              {currentOutcome && <StatusBadge status={currentOutcome} size="sm" />}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Instrument: <strong className="text-slate-900 font-bold">{instrument?.model?.model_name || 'NAWI Scale'}</strong> (SN: <span className="font-mono font-bold text-slate-900">{instrument?.serial_number || 'N/A'}</span>) | Procedure: <span className="font-mono font-semibold text-slate-700">{session.procedure_pack_id}</span> | Scheduled: {session.scheduled_date} | Verifier: {session.verifier_id}
            </p>
          </div>

          {/* Step-by-Step Action Ribbon */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Step 1: PLANNED or IDENTITY_CONFIRMED -> Show Start Test Execution */}
            {(currentStatus === 'PLANNED' || currentStatus === 'IDENTITY_CONFIRMED') && (
              <button
                onClick={handleStartSession}
                className="px-4 py-2 rounded-lg bg-gov-blue text-xs font-bold text-white hover:bg-blue-800 flex items-center gap-1.5 shadow-card transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Start Test Execution</span>
              </button>
            )}

            {/* Step 2: IN_PROGRESS -> Show active indicator */}
            {currentStatus === 'IN_PROGRESS' && (
              <div className="px-3.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gov-blue animate-pulse"></span>
                <span>Testing In Progress — Enter Readings Below</span>
              </div>
            )}

            {/* Physical Seal Action — Remains ALWAYS available for SUBMITTED & FINALIZED sessions */}
            {(currentStatus === 'SUBMITTED' || currentStatus === 'FINALIZED') && (
              <button
                type="button"
                onClick={() => setIsStampModalOpen(true)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-card cursor-pointer ${
                  recordedStamps.length > 0
                    ? 'bg-slate-800 text-white hover:bg-slate-900 border border-slate-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700 ring-2 ring-amber-400/40'
                }`}
                title={recordedStamps.length > 0 ? 'View or add physical security seals' : 'Physical seal required'}
              >
                <Stamp className={`w-4 h-4 ${recordedStamps.length > 0 ? 'text-amber-400' : 'text-white'}`} />
                <span>
                  {recordedStamps.length > 0
                    ? `Seal: ${recordedStamps[0].seal_identification_number}${recordedStamps.length > 1 ? ` (${recordedStamps.length})` : ''}`
                    : 'Affix Physical Seal'}
                </span>
              </button>
            )}

            {/* Step 3: SUBMITTED -> Show Record Legal Disposition */}
            {currentStatus === 'SUBMITTED' && (
              <button
                type="button"
                onClick={() => setIsDispositionModalOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5 transition-colors shadow-card cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Record Legal Disposition</span>
              </button>
            )}

            {/* Step 4: FINALIZED -> Show View Certificate or Sign & Issue */}
            {isFinalized && (
              <>
                {certificate ? (
                  <button
                    onClick={() => setIsCertViewOpen(true)}
                    className="px-4 py-2 rounded-lg bg-gov-navy text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-card transition-colors cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>View Issued Certificate ({certificate.certificate_number})</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsSignModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-amber-300" />
                    <span>Sign &amp; Issue Certificate</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Verification & Certification Complete Banner */}
        {isFinalized && certificate && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-card">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <strong className="text-emerald-950 font-bold text-sm">Verification &amp; Digital Certification Complete</strong>
                <p className="text-emerald-800 text-xs mt-0.5">
                  Statutory certificate <span className="font-mono font-bold text-emerald-950">{certificate.certificate_number}</span> is published &amp; physical seals are recorded. This completed verification is archived in the Master Ledger.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToLedger?.()}
              className="px-4 py-2 rounded-lg bg-gov-navy hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shadow-card cursor-pointer transition-colors"
            >
              <Award className="w-4 h-4 text-amber-300" />
              <span>Go to Issued Ledger &rarr;</span>
            </button>
          </div>
        )}

        {/* Pre-Inspection & Post-Inspection Verifications: 4 Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Card 1: Identity confirmation */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Physical Identity Check</span>
                {serialVerified ? (
                  <span className="text-emerald-700 flex items-center gap-1 font-semibold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold text-xs">Pending Check</span>
                )}
              </div>
              <p className="text-slate-600 text-xs">
                Serial: <span className="font-mono font-bold text-slate-900">{instrument?.serial_number || 'DL-2024-8842'}</span>
              </p>
              <p className="text-slate-500 text-xs">
                Class: <strong className="text-slate-700">{accuracyClass}</strong> | Model: {instrument?.model?.model_name || 'NAWI'}
              </p>
            </div>

            {!serialVerified ? (
              <button
                type="button"
                onClick={() => setIsPhysicalMatchModalOpen(true)}
                className="w-full py-1.5 rounded bg-gov-navy text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-card mt-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                <span>Inspect &amp; Match Serial</span>
              </button>
            ) : (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 flex items-center justify-between font-semibold mt-1">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span>Plate Inspected</span>
                </span>
                <span className="text-xs font-mono bg-emerald-100/70 text-emerald-800 px-1 rounded">MATCHED</span>
              </div>
            )}
          </div>

          {/* Card 2: Physical Seal & Stamping Status */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Physical Security Seal</span>
                {recordedStamps.length > 0 ? (
                  <span className="text-emerald-700 flex items-center gap-1 font-semibold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Affixed
                  </span>
                ) : currentStatus === 'SUBMITTED' || currentStatus === 'FINALIZED' ? (
                  <span className="text-amber-700 font-semibold text-xs">Seal Required</span>
                ) : (
                  <span className="text-slate-400 font-medium text-xs uppercase">Locked</span>
                )}
              </div>
              {recordedStamps.length > 0 ? (
                <div className="text-xs space-y-0.5">
                  <div className="font-mono font-bold text-slate-900 truncate">
                    #{recordedStamps[0].seal_identification_number}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    Pos: {recordedStamps[0].seal_position}
                  </div>
                </div>
              ) : currentStatus === 'SUBMITTED' || currentStatus === 'FINALIZED' ? (
                <p className="text-slate-600 text-xs">
                  Testing complete. Lead wire seal required on calibration port.
                </p>
              ) : (
                <p className="text-slate-400 text-xs">
                  Lead wire seal option unlocks after test observations are completed and submitted.
                </p>
              )}
            </div>

            {currentStatus === 'SUBMITTED' || currentStatus === 'FINALIZED' ? (
              <button
                type="button"
                onClick={() => setIsStampModalOpen(true)}
                className={`w-full py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-card mt-1 ${
                  recordedStamps.length > 0
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                <Stamp className="w-3.5 h-3.5" />
                <span>
                  {recordedStamps.length > 0
                    ? recordedStamps.length > 1
                      ? `Manage Seals (${recordedStamps.length})`
                      : 'Manage Seal'
                    : 'Affix Physical Seal'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 mt-1 bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                title="Complete and submit test readings below to unlock physical seal stamping"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Affix Seal (Locked)</span>
              </button>
            )}
          </div>

          {/* Card 3: Reference standards check */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Reference Standards</span>
                <span className="text-emerald-700 font-semibold text-xs uppercase">Calibrated</span>
              </div>
              <div className="space-y-1">
                {defaultStandardWeights.slice(0, 2).map((std) => (
                  <div key={std.id} className="text-xs text-slate-600 flex items-center justify-between">
                    <span className="truncate max-w-[130px]">{std.name}</span>
                    <span className="text-emerald-700 font-mono text-xs font-bold">PASS</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs text-slate-400 font-mono text-right">
              Traceability: RRSL / NPL
            </div>
          </div>

          {/* Card 4: Environmental conditions */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 flex flex-col justify-between transition-colors ${
              tempCelsius >= 20.0 && tempCelsius <= 28.0 && humidityPercent >= 45.0 && humidityPercent <= 65.0
                ? 'bg-slate-50 border-slate-200'
                : 'bg-red-50/50 border-red-300 ring-1 ring-red-200'
            }`}
          >
            <div className="space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Environmental State</span>
                {tempCelsius >= 20.0 && tempCelsius <= 28.0 && humidityPercent >= 45.0 && humidityPercent <= 65.0 ? (
                  <span className="text-emerald-700 bg-emerald-100 border border-emerald-300 font-bold text-xs uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                    Compliant
                  </span>
                ) : (
                  <span className="text-red-700 bg-red-100 border border-red-300 font-bold text-xs uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                    Non-Compliant
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-xs flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-red-500" />
                    Temp (°C)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    disabled={isFinalized}
                    value={tempCelsius}
                    onChange={(e) => setTempCelsius(Number(e.target.value))}
                    className={`w-full font-mono font-bold border rounded px-1.5 py-1 text-xs transition-colors ${
                      tempCelsius >= 20.0 && tempCelsius <= 28.0
                        ? 'bg-white text-slate-900 border-slate-300'
                        : 'bg-red-50 text-red-900 border-red-400 ring-1 ring-red-300 font-black'
                    }`}
                  />
                </div>
                <div>
                  <span className="text-slate-500 block text-xs flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-gov-blue" />
                    RH (%)
                  </span>
                  <input
                    type="number"
                    step="1"
                    disabled={isFinalized}
                    value={humidityPercent}
                    onChange={(e) => setHumidityPercent(Number(e.target.value))}
                    className={`w-full font-mono font-bold border rounded px-1.5 py-1 text-xs transition-colors ${
                      humidityPercent >= 45.0 && humidityPercent <= 65.0
                        ? 'bg-white text-slate-900 border-slate-300'
                        : 'bg-red-50 text-red-900 border-red-400 ring-1 ring-red-300 font-black'
                    }`}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span
                className={
                  tempCelsius >= 20.0 && tempCelsius <= 28.0 && humidityPercent >= 45.0 && humidityPercent <= 65.0
                    ? 'text-slate-400'
                    : 'text-red-600 font-semibold'
                }
              >
                {tempCelsius >= 20.0 && tempCelsius <= 28.0 && humidityPercent >= 45.0 && humidityPercent <= 65.0
                  ? 'Within statutory limits'
                  : !(tempCelsius >= 20.0 && tempCelsius <= 28.0) && !(humidityPercent >= 45.0 && humidityPercent <= 65.0)
                  ? 'Temp & RH out of range'
                  : !(tempCelsius >= 20.0 && tempCelsius <= 28.0)
                  ? 'Temp out of range'
                  : 'RH out of range'}
              </span>
              <span className="text-slate-400 font-mono">
                Range: 20–28°C / 45–65% RH
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Observations Worksheet */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-gov-blue" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-800">
                  Guided NAWI Test Procedure Execution
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                  {accuracyClass === 'CLASS_I'
                    ? 'Class I (Special Accuracy — Analytical/Micro)'
                    : accuracyClass === 'CLASS_II'
                    ? 'Class II (High Accuracy — Gold / Jewellery / Carat)'
                    : accuracyClass === 'CLASS_IIII'
                    ? 'Class IIII (Ordinary Accuracy — Industrial)'
                    : 'Class III (Medium Accuracy — Commercial Trade)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {accuracyClass === 'CLASS_I'
                  ? 'Stepped MPE: 0 < m ≤ 50,000e: ±1.0e; 50,000e < m ≤ 200,000e: ±2.0e; m > 200,000e: ±3.0e'
                  : accuracyClass === 'CLASS_II'
                  ? 'Stepped MPE: 0 < m ≤ 5,000e: ±1.0e; 5,000e < m ≤ 20,000e: ±2.0e; m > 20,000e: ±3.0e'
                  : accuracyClass === 'CLASS_IIII'
                  ? 'Stepped MPE: 0 < m ≤ 50e: ±1.0e; 50e < m ≤ 200e: ±2.0e; m > 200e: ±3.0e'
                  : 'Stepped MPE: 0 < m ≤ 500e: ±1.0e; 500e < m ≤ 2,000e: ±2.0e; m > 2,000e: ±3.0e'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-slate-500">Interval (e): <strong className="font-mono text-slate-900">{scaleIntervalE} kg</strong></span>
            {!isFinalized && (
              <button
                type="button"
                onClick={() => {
                  const autoSteps = generateStatutoryNAWITestSteps(instrument?.model);
                  setObservations(autoSteps);
                  notify('info', 'Test Steps Auto-Aligned', `Procedure points auto-calculated for ${accuracyClass} (${scaleIntervalE} kg scale interval).`);
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors cursor-pointer"
                title="Reset or auto-align test points with the loaded machine specifications"
              >
                Auto-Align Steps
              </button>
            )}
          </div>
        </div>

        {/* Test Step Observations Grid */}
        <div className="space-y-3">
          {observations.map((obs, idx) => (
            <NAWITestStepForm
              key={`${session.session_id}-${obs.step_sequence}-${idx}`}
              observation={obs}
              scaleIntervalE={scaleIntervalE}
              accuracyClass={accuracyClass as any}
              zeroErrorE0={zeroErrorE0}
              readOnly={isFinalized}
              onChange={(updated: ObservationItemInput) => handleUpdateObservation(idx, updated)}
            />
          ))}
        </div>

        {/* Bottom Progression & Action Bar */}
        <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-3">
          {currentStatus === 'PLANNED' || currentStatus === 'IDENTITY_CONFIRMED' || currentStatus === 'IN_PROGRESS' ? (
            <>
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span>Enter all statutory observation readings above before submitting for MPE evaluation.</span>
              </div>
              <button
                onClick={handleSubmitObservations}
                disabled={isSubmittingObservations}
                className="px-6 py-2.5 rounded-lg bg-gov-blue text-xs font-bold text-white hover:bg-blue-800 flex items-center gap-2 shadow-card transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmittingObservations ? 'Evaluating Tolerance...' : 'Submit Observations & Run Evaluation'}</span>
              </button>
            </>
          ) : currentStatus === 'SUBMITTED' ? (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="font-bold text-slate-800">
                  Readings Evaluated &amp; Submitted
                </span>
                <span className="text-slate-500">
                  ({recordedStamps.length > 0 ? 'Lead Wire Seal Affixed' : 'Physical Seal Pending'})
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSubmitObservations}
                  disabled={isSubmittingObservations}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors cursor-pointer"
                  title="Re-run evaluation if readings were adjusted"
                >
                  <Save className="w-3.5 h-3.5 inline mr-1" />
                  <span>Update Readings</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsStampModalOpen(true)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-card cursor-pointer ${
                    recordedStamps.length > 0
                      ? 'bg-slate-800 text-white hover:bg-slate-900 border border-slate-700'
                      : 'bg-amber-600 text-white hover:bg-amber-700 ring-2 ring-amber-400/40'
                  }`}
                >
                  <Stamp className="w-4 h-4 text-amber-300" />
                  <span>
                    {recordedStamps.length > 0
                      ? `Manage Seals (${recordedStamps.length})`
                      : 'Affix Physical Seal'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDispositionModalOpen(true)}
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer ring-2 ring-emerald-400/30"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-200" />
                  <span>Record Legal Disposition &rarr;</span>
                </button>
              </div>
            </>
          ) : isFinalized ? (
            <>
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-slate-800">
                  Verification Finalized — {session.outcome ? session.outcome.replace(/_/g, ' ') : 'Disposition Recorded'}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {certificate ? (
                  <button
                    onClick={() => setIsCertViewOpen(true)}
                    className="px-5 py-2 rounded-lg bg-gov-navy text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-amber-300" />
                    <span>View Digital Certificate ({certificate.certificate_number})</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsSignModalOpen(true)}
                    className="px-5 py-2 rounded-lg bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-amber-300" />
                    <span>Sign &amp; Issue Certificate &rarr;</span>
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Modals */}
      <StampRecordForm
        isOpen={isStampModalOpen}
        onClose={() => setIsStampModalOpen(false)}
        sessionId={session.session_id}
        instrumentId={session.instrument_id}
        onStampRecorded={() => {
          loadStamps();
          notify('success', 'Physical Stamp Saved', 'Affixed seal is audited in the physical ledger.');
        }}
      />

      <DispositionModal
        isOpen={isDispositionModalOpen}
        onClose={() => setIsDispositionModalOpen(false)}
        session={{ ...session, status: currentStatus, outcome: currentOutcome }}
        onDispositionRecorded={(updated) => {
          setCurrentStatus(updated.status);
          if (updated.outcome) setCurrentOutcome(updated.outcome);
          onSessionUpdated(updated);
        }}
        onStampRecorded={loadStamps}
      />

      <CertificateSignModal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        session={{ ...session, status: currentStatus, outcome: currentOutcome }}
        onCertificateIssued={(cert) => {
          setCurrentStatus('FINALIZED');
          onCertificateIssued?.(cert);
          onSessionUpdated({ ...session, status: 'FINALIZED' });
        }}
        onNavigateToLedger={() => {
          setIsSignModalOpen(false);
          onNavigateToLedger?.();
        }}
      />

      <CertificateModal
        isOpen={isCertViewOpen}
        onClose={() => setIsCertViewOpen(false)}
        certificate={certificate || null}
        instrument={instrument || null}
      />

      <PhysicalSerialMatchModal
        isOpen={isPhysicalMatchModalOpen}
        onClose={() => setIsPhysicalMatchModalOpen(false)}
        instrument={instrument}
        session={session}
        onConfirmMatch={handleConfirmPhysicalMatch}
      />
    </div>
  );
};
