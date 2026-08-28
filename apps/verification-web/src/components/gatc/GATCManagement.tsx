import React, { useState, useEffect, useCallback } from 'react';
import { Application } from '../../types/application';
import { Instrument } from '../../types/instrument';
import { VerificationSession } from '../../types/session';
import { Certificate } from '../../types/certificate';
import { api } from '../../api/client';
import { mockDb } from '../../api/mock/mockService';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useApiMode } from '../../context/ApiModeContext';
import { TestObservationGrid } from '../officer/TestObservationGrid';
import { CertificateModal } from '../trader/CertificateModal';
import { WorksheetModal } from '../officer/WorksheetModal';
import { StatusBadge } from '../common/StatusBadge';
import { truncateHash } from '../../utils/formatters';
import {
  Scale,
  Award,
  ShieldCheck,
  Building2,
  Lock,
  Calendar,
  CheckCircle2,
  Microscope,
  Layers,
} from 'lucide-react';

interface GATCCentre {
  gatcId: string;
  facilityName: string;
  approvalOrderNumber: string;
  validFrom: string;
  validTo: string;
  maxCapacityKg: number;
  approvedClasses: string[];
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
}

interface WorkingStandard {
  standardId: string;
  description: string;
  accuracyClass: string;
  nominalValue: string;
  calibrationCertificate: string;
  calibratedBy: string;
  validUntil: string;
  status: 'ACTIVE' | 'DUE_CALIBRATION' | 'EXPIRED';
}

const mockGATCCentres: GATCCentre[] = [
  {
    gatcId: 'gatc-001',
    facilityName: 'Apex Metrology Calibration Lab Pvt Ltd',
    approvalOrderNumber: 'GATC/MH/2024/014',
    validFrom: '2024-01-01',
    validTo: '2027-12-31',
    maxCapacityKg: 50000,
    approvedClasses: ['Class II', 'Class III', 'Class IIII'],
    status: 'ACTIVE',
  },
  {
    gatcId: 'gatc-002',
    facilityName: 'National Precision Testing Services',
    approvalOrderNumber: 'GATC/MH/2025/008',
    validFrom: '2025-06-01',
    validTo: '2028-05-31',
    maxCapacityKg: 1000,
    approvedClasses: ['Class II', 'Class III'],
    status: 'ACTIVE',
  },
];

const mockWorkingStandards: WorkingStandard[] = [
  {
    standardId: 'STD-GATC-F1-01',
    description: 'F1 Precision Stainless Steel Mass Set (1 mg to 10 kg)',
    accuracyClass: 'OIML F1 / Class II',
    nominalValue: '1 mg - 10 kg (28 pcs)',
    calibrationCertificate: 'NPL/RRSL-CAL-2025-8891',
    calibratedBy: 'Regional Reference Standard Laboratory (RRSL)',
    validUntil: '2027-06-30',
    status: 'ACTIVE',
  },
  {
    standardId: 'STD-GATC-M1-02',
    description: 'M1 Heavy Cast Iron Calibration Block (20 kg x 50 units)',
    accuracyClass: 'OIML M1 / Class III',
    nominalValue: '1,000 kg Total',
    calibrationCertificate: 'RRSL-DEL-2025-1042',
    calibratedBy: 'RRSL Delhi Standards Division',
    validUntil: '2026-12-31',
    status: 'ACTIVE',
  },
  {
    standardId: 'STD-GATC-E2-03',
    description: 'E2 High-Precision Analytical Reference Weights',
    accuracyClass: 'OIML E2 / Class I & II',
    nominalValue: '1 g - 500 g',
    calibrationCertificate: 'NPLI-CAL-2026-0041',
    calibratedBy: 'National Physical Laboratory (NPL India)',
    validUntil: '2028-02-28',
    status: 'ACTIVE',
  },
];

export const GATCManagement: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const { mode, version: apiVersion } = useApiMode();
  const [activeTab, setActiveTab] = useState<'testing' | 'standards' | 'ledger'>('testing');

  const [applications, setApplications] = useState<Application[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [sessions, setSessions] = useState<VerificationSession[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedCertForView, setSelectedCertForView] = useState<Certificate | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Dedicated Worksheet Modal State
  const [selectedWorksheetSession, setSelectedWorksheetSession] = useState<VerificationSession | null>(null);
  const [selectedWorksheetCert, setSelectedWorksheetCert] = useState<Certificate | null>(null);
  const [isWorksheetModalOpen, setIsWorksheetModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [appRes, instRes, sessRes, certRes] = await Promise.all([
        api.applications.listApplications(user.tenantId),
        api.instruments.listInstruments(user.tenantId),
        api.verification.listSessions(user.tenantId),
        api.certificates.listCertificates(user.tenantId),
      ]);

      setApplications(appRes.items);
      setInstruments(instRes.items);
      setSessions(sessRes.items);
      setCertificates(certRes.items);

      // Automatically advance selectedSessionId away from completed & certified sessions
      const isSelectedSessionCertified = certRes.items.some((c) => c.session_id === selectedSessionId);
      if (!selectedSessionId || isSelectedSessionCertified) {
        const remainingWorkSession = sessRes.items.find(
          (s) => !(s.status === 'FINALIZED' && certRes.items.some((c) => c.session_id === s.session_id))
        );
        setSelectedSessionId(remainingWorkSession ? remainingWorkSession.session_id : '');
      }
    } catch (err) {
      console.error('Failed to load GATC data:', err);
    }
  }, [user.tenantId, selectedSessionId, mode, apiVersion]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Strictly filter certificates issued by GATC (excludes LMO Departmental certificates)
  const gatcCertificates = certificates.filter(
    (c) => c.issuer_type === 'GATC' || c.certificate_number.startsWith('GATC-')
  );

  // Active testing workload: sessions available for GATC testing
  const activeWorkSessions = sessions.filter(
    (s) => !(s.status === 'FINALIZED' && certificates.some((c) => c.session_id === s.session_id))
  );

  const activeSession = activeWorkSessions.find((s) => s.session_id === selectedSessionId) || activeWorkSessions[0] || null;
  const activeSessionApp = activeSession ? applications.find((a) => a.application_id === activeSession.application_id) : null;
  const activeSessionInst = activeSession ? instruments.find((i) => i.instrument_id === (activeSession.instrument_id || activeSessionApp?.instrument_id)) : null;
  const activeSessionCert = activeSession ? certificates.find((c) => c.session_id === activeSession.session_id) : null;

  return (
    <div className="space-y-6">
      {/* GATC Verified Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl p-6 shadow-md border border-indigo-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Microscope className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold tracking-tight">Government Approved Test Centre (GATC) Portal</h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                GATC RULES, 2013 ACCREDITED
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Approved Centre: <span className="font-semibold text-white">Apex Metrology Calibration Lab Pvt Ltd</span> | Approval Order: <span className="font-mono text-amber-300">GATC/MH/2024/014</span> | Accredited Verifier: <span className="font-semibold text-white">{user.actorName}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 px-3.5 py-2 rounded-xl border border-white/15 text-xs text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>GATC Key Slot: <strong className="font-mono text-white">HSM-GATC-01</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('testing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'testing'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scale className="w-4 h-4 text-indigo-300" />
          <span>GATC Verification Testing Console ({activeWorkSessions.length} Active Workload)</span>
        </button>

        <button
          onClick={() => setActiveTab('standards')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'standards'
              ? 'bg-gov-navy text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-400" />
          <span>GATC Accreditation &amp; Working Standards ({mockWorkingStandards.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4 text-blue-300" />
          <span>GATC Test Certificates &amp; Reports Ledger ({gatcCertificates.length})</span>
        </button>
      </div>

      {/* Tab 1: GATC Testing Execution */}
      {activeTab === 'testing' && (
        <div className="space-y-4">
          {/* Active Testing Queue Picker */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 shrink-0">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>GATC Lab Queue:</span>
            </div>
            <div className="flex-1 w-full">
              <select
                value={activeSession?.session_id || ''}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                disabled={activeWorkSessions.length === 0}
                className="text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-600 w-full disabled:bg-slate-50 disabled:text-slate-400"
              >
                {activeWorkSessions.length > 0 ? (
                  activeWorkSessions.map((s) => {
                    const app = applications.find((a) => a.application_id === s.application_id);
                    const inst = instruments.find((i) => i.instrument_id === (s.instrument_id || app?.instrument_id));
                    const appNum = app?.application_number || `App #${s.application_id.slice(0, 8)}`;
                    const model = inst?.model?.model_name || 'Weighing Instrument';
                    const sn = inst?.serial_number || 'N/A';
                    const status = s.status.replace(/_/g, ' ');
                    const outcome = s.outcome ? ` • ${s.outcome.replace(/_/g, ' ')}` : '';
                    return (
                      <option key={s.session_id} value={s.session_id}>
                        {appNum} — {model} (SN: {sn}) [{status}{outcome}]
                      </option>
                    );
                  })
                ) : (
                  <option value="">No pending instruments assigned for GATC testing</option>
                )}
              </select>
            </div>
          </div>

          {activeSession ? (
            <TestObservationGrid
              session={activeSession}
              instrument={activeSessionInst}
              application={activeSessionApp}
              certificate={activeSessionCert}
              onSessionUpdated={loadData}
              onCertificateIssued={loadData}
              onNavigateToLedger={() => setActiveTab('ledger')}
            />
          ) : (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
              <Scale className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700 text-sm">No Pending GATC Workload</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All assigned weighing &amp; measuring instruments have undergone verification testing and digital certification.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: GATC Accreditation & Working Standards Registry */}
      {activeTab === 'standards' && (
        <div className="space-y-6">
          {/* GATC Accreditations Scope Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gov-navy flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Statutory GATC Accreditation &amp; Approved Testing Scope
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authority issued under Section 19 of the Legal Metrology Act, 2009 &amp; GATC Rules, 2013
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ACCREDITATION ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockGATCCentres.map((centre) => (
                <div key={centre.gatcId} className="border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition-colors space-y-3 bg-slate-50/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{centre.facilityName}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">Approval Order: {centre.approvalOrderNumber}</p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                      {centre.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Accreditation Validity:</span>
                      <span className="font-semibold text-slate-800">{centre.validFrom} to {centre.validTo}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Max Approved Capacity:</span>
                      <span className="font-semibold text-slate-800">{centre.maxCapacityKg.toLocaleString()} kg</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="text-xs text-slate-500 block mb-1">Approved Accuracy Classes:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {centre.approvedClasses.map((cls) => (
                        <span key={cls} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-200">
                          {cls}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Traceable Working Reference Standards */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-gov-navy uppercase tracking-wider">
                  GATC Traceable Working Reference Standards Inventory
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {mockWorkingStandards.length} Traceable Standards Pinning Verification Tests
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Standard Identifier</th>
                    <th className="py-2.5 px-3">Description &amp; Nominal Range</th>
                    <th className="py-2.5 px-3">Accuracy Class</th>
                    <th className="py-2.5 px-3">Calibration Certificate</th>
                    <th className="py-2.5 px-3">Calibrated By</th>
                    <th className="py-2.5 px-3">Calibration Due Date</th>
                    <th className="py-2.5 px-3">Traceability Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {mockWorkingStandards.map((std) => (
                    <tr key={std.standardId} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-bold text-slate-900">{std.standardId}</td>
                      <td className="py-3 px-3 font-sans text-slate-700">
                        <strong>{std.description}</strong>
                        <span className="block text-xs text-slate-500 font-mono">{std.nominalValue}</span>
                      </td>
                      <td className="py-3 px-3 font-sans font-semibold text-indigo-700">{std.accuracyClass}</td>
                      <td className="py-3 px-3 text-gov-blue">{std.calibrationCertificate}</td>
                      <td className="py-3 px-3 font-sans text-slate-600">{std.calibratedBy}</td>
                      <td className="py-3 px-3 font-sans font-bold text-slate-800">{std.validUntil}</td>
                      <td className="py-3 px-3 font-sans">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                          ✓ ACTIVE &amp; TRACEABLE
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: GATC Test Certificates & Reports Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-gov-navy uppercase tracking-wider">
                  GATC Verification Certificates &amp; Test Reports Master Ledger
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500">{gatcCertificates.length} Total Records</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset all demo certificates and test data back to baseline state?')) {
                      mockDb.resetDatabase();
                      loadData();
                      notify('success', 'Database Reset', 'All demo certificates cleared and state restored to baseline.');
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                  title="Clear all generated mock certificates and reset database"
                >
                  Clear All Data / Reset
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">GATC Certificate / Report Number</th>
                    <th className="py-2.5 px-3">Validity Period</th>
                    <th className="py-2.5 px-3">Public QR Token</th>
                    <th className="py-2.5 px-3">SHA-256 Digest</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {gatcCertificates.length > 0 ? (
                    gatcCertificates.map((cert) => (
                      <tr key={cert.certificate_id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-bold text-indigo-900">{cert.certificate_number}</td>
                        <td className="py-3 px-3 font-sans text-slate-700">
                          {cert.issue_date} to <strong className="text-slate-900">{cert.valid_until}</strong>
                        </td>
                        <td className="py-3 px-3 text-gov-blue">{cert.public_verification_token}</td>
                        <td className="py-3 px-3 text-slate-500">{truncateHash(cert.certificate_bytes_sha256, 16)}</td>
                        <td className="py-3 px-3 font-sans">
                          <StatusBadge status={cert.certificate_status} size="sm" />
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                const matchedSess = sessions.find((s) => s.session_id === cert.session_id);
                                setSelectedWorksheetSession(matchedSess || null);
                                setSelectedWorksheetCert(cert);
                                setIsWorksheetModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                              title="Inspect complete NAWI observation worksheet and test readings"
                            >
                              Worksheet
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCertForView(cert);
                                setIsCertModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold cursor-pointer"
                            >
                              View Certificate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans text-xs">
                        No issued certificates in GATC Master Ledger yet. Execute verification testing in the GATC Testing Console to issue statutory certificates.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      <CertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        certificate={selectedCertForView}
        instrument={instruments.find((i) => i.instrument_id === selectedCertForView?.instrument_id)}
      />

      {/* Dedicated NAWI Worksheet Inspection Modal */}
      <WorksheetModal
        isOpen={isWorksheetModalOpen}
        onClose={() => setIsWorksheetModalOpen(false)}
        session={selectedWorksheetSession}
        instrument={selectedWorksheetSession ? instruments.find((i) => i.instrument_id === selectedWorksheetSession.instrument_id) : null}
        application={selectedWorksheetSession ? applications.find((a) => a.application_id === selectedWorksheetSession.application_id) : null}
        certificate={selectedWorksheetCert}
        onViewCertificate={(cert) => {
          setSelectedCertForView(cert);
          setIsCertModalOpen(true);
        }}
      />
    </div>
  );
};
