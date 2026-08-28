import React, { useState, useEffect, useCallback } from 'react';
import { Application } from '../../types/application';
import { Instrument } from '../../types/instrument';
import { VerificationSession } from '../../types/session';
import { Certificate } from '../../types/certificate';
import { PhysicalStamp } from '../../types/stamp';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useApiMode } from '../../context/ApiModeContext';
import { ScrutinyQueue } from './ScrutinyQueue';
import { TestObservationGrid } from './TestObservationGrid';
import { CertificateModal } from '../trader/CertificateModal';
import { StatusBadge } from '../common/StatusBadge';
import { formatDate, formatDateTime, maskSerialNumber, truncateHash } from '../../utils/formatters';
import {
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  Calendar,
  Scale,
  Award,
  Stamp,
  Building2,
  Lock,
  Layers,
  Plus,
} from 'lucide-react';

export const OfficerWorkspace: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const { mode, version: apiVersion } = useApiMode();
  const [activeTab, setActiveTab] = useState<'scrutiny' | 'testing' | 'ledger'>('scrutiny');

  const [applications, setApplications] = useState<Application[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [sessions, setSessions] = useState<VerificationSession[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [stamps, setStamps] = useState<PhysicalStamp[]>([]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedCertForView, setSelectedCertForView] = useState<Certificate | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

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

      if (sessRes.items.length > 0 && !selectedSessionId) {
        const firstWorkSession = sessRes.items.find(
          (s) => !(s.status === 'FINALIZED' && certRes.items.some((c) => c.session_id === s.session_id))
        );
        if (firstWorkSession) {
          setSelectedSessionId(firstWorkSession.session_id);
        }
      }
    } catch (err) {
      console.error('Failed to load officer data:', err);
    }
  }, [user.tenantId, selectedSessionId, mode, apiVersion]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Active testing workload: sessions that still require officer testing actions (uncompleted)
  const activeWorkSessions = sessions.filter(
    (s) => !(s.status === 'FINALIZED' && certificates.some((c) => c.session_id === s.session_id))
  );

  // Pending Scrutiny applications (action required: scrutiny, query response, or scheduling)
  const pendingScrutinyApps = applications.filter(
    (a) => a.current_status !== 'COMPLETED' && a.current_status !== 'REJECTED'
  );

  // Strictly only show active workload sessions in the testing execution tab. Completed sessions are removed and live in Master Ledger
  const activeSession = activeWorkSessions.find((s) => s.session_id === selectedSessionId) || activeWorkSessions[0] || null;
  const activeSessionApp = activeSession ? applications.find((a) => a.application_id === activeSession.application_id) : null;
  const activeSessionInst = activeSession ? instruments.find((i) => i.instrument_id === (activeSession.instrument_id || activeSessionApp?.instrument_id)) : null;

  const handleSelectSessionForTesting = async (appId: string) => {
    let matchedSession = sessions.find((s) => s.application_id === appId && s.status !== 'FINALIZED');
    if (!matchedSession) {
      matchedSession = sessions.find((s) => s.application_id === appId);
    }
    if (!matchedSession) {
      const app = applications.find((a) => a.application_id === appId);
      if (app) {
        matchedSession = sessions.find((s) => s.instrument_id === app.instrument_id && s.status !== 'FINALIZED');
        if (!matchedSession) {
          try {
            matchedSession = await api.verification.createSession(user.tenantId, {
              application_id: app.application_id,
              instrument_id: app.instrument_id,
              scheduled_date: new Date().toISOString().split('T')[0],
            });
            await loadData();
          } catch (e) {
            console.error('Failed to auto-create session for testing:', e);
          }
        }
      }
    }

    if (matchedSession) {
      setSelectedSessionId(matchedSession.session_id);
    } else if (activeWorkSessions.length > 0) {
      setSelectedSessionId(activeWorkSessions[0].session_id);
    }
    setActiveTab('testing');
  };

  return (
    <div className="space-y-6">
      {/* Officer Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-gov-navy to-emerald-950 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-bold tracking-tight">Legal Metrology Officer Enforcement Console</h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                LMO / GATC AUTHORITY
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Officer: <span className="font-semibold text-white">{user.actorName}</span> | Designation: <span className="font-mono text-amber-300">{user.actorRole}</span> | Jurisdiction: <span className="font-mono text-slate-200">Delhi Central (JUR-DL-01)</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 px-3.5 py-2 rounded-xl border border-white/15 text-xs text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Key Slot: <strong className="font-mono text-white">HSM-DL-01</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('scrutiny')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'scrutiny'
              ? 'bg-gov-navy text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-amber-400" />
          <span>Application Scrutiny & Scheduling Queue ({pendingScrutinyApps.length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('testing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'testing'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scale className="w-4 h-4 text-emerald-300" />
          <span>Guided NAWI Testing Session Execution ({activeWorkSessions.length} Active)</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'ledger'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4 text-indigo-300" />
          <span>Issued Certificates & Physical Stamps Ledger ({certificates.length})</span>
        </button>
      </div>

      {/* Tab 1: Scrutiny Queue */}
      {activeTab === 'scrutiny' && (
        <ScrutinyQueue
          applications={applications}
          instruments={instruments}
          certificates={certificates}
          sessions={sessions}
          onApplicationUpdated={loadData}
          onSelectSessionForTesting={handleSelectSessionForTesting}
        />
      )}

      {/* Tab 2: Guided NAWI Testing Execution */}
      {activeTab === 'testing' && (
        <div className="space-y-4">
          {/* Session Picker Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-gov-blue" />
              <span>Select Verification Session:</span>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <select
                value={activeSession?.session_id || ''}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                disabled={activeWorkSessions.length === 0}
                className="text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue w-full sm:min-w-[420px] disabled:bg-slate-50 disabled:text-slate-400"
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
                  <option value="">No pending sessions — All completed items archived in Master Ledger</option>
                )}
              </select>
              <button
                onClick={async () => {
                  try {
                    const app = applications[0];
                    const inst = instruments[0];
                    if (!app || !inst) return;
                    const newSess = await api.verification.createSession(user.tenantId, {
                      application_id: app.application_id,
                      instrument_id: inst.instrument_id,
                      scheduled_date: new Date().toISOString().split('T')[0],
                    });
                    await loadData();
                    setSelectedSessionId(newSess.session_id);
                    notify('success', 'New Session Created', `Fresh verification session ${newSess.session_id} in PLANNED state is ready.`);
                  } catch (e) {
                    notify('error', 'Failed to create session', e instanceof Error ? e.message : 'Unknown error');
                  }
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
                title="Create a fresh session to test the full live procedure from scratch"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Fresh Test Session</span>
              </button>
            </div>
          </div>

          {activeSession ? (
            <TestObservationGrid
              session={activeSession}
              instrument={activeSessionInst}
              application={activeSessionApp}
              certificate={certificates.find((c) => c.session_id === activeSession.session_id)}
              onSessionUpdated={(updated) => {
                setSessions((prev) => prev.map((s) => (s.session_id === updated.session_id ? updated : s)));
                loadData();
              }}
              onCertificateIssued={(cert) => {
                setCertificates((prev) => [cert, ...prev.filter((c) => c.certificate_id !== cert.certificate_id)]);
                loadData();
                setActiveTab('ledger');
              }}
              onNavigateToLedger={() => setActiveTab('ledger')}
            />
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs text-center space-y-4 max-w-2xl mx-auto my-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-800">All Scheduled Verification Sessions Completed</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  There are no pending verification sessions in your active inspection queue. All previously completed sessions have had their certificates minted in the Master Ledger.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab('scrutiny')}
                  className="px-4 py-2 rounded-lg bg-gov-navy text-white text-xs font-bold hover:bg-slate-800 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <FileCheck2 className="w-4 h-4 text-amber-400" />
                  <span>Review Scrutiny Queue ({pendingScrutinyApps.length} Pending)</span>
                </button>
                <button
                  onClick={() => setActiveTab('ledger')}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Award className="w-4 h-4 text-indigo-200" />
                  <span>Open Master Ledger ({certificates.length})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Issued Certificates & Stamps Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Digital Certificates Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-gov-navy uppercase tracking-wider">
                  Statutory Digital Certificates Master Ledger
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500">{certificates.length} Total Records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Certificate Number</th>
                    <th className="py-2.5 px-3">Validity Period</th>
                    <th className="py-2.5 px-3">Public QR Token</th>
                    <th className="py-2.5 px-3">SHA-256 Digest</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {certificates.map((cert) => (
                    <tr key={cert.certificate_id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-bold text-slate-900">{cert.certificate_number}</td>
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
                              setSelectedSessionId(cert.session_id);
                              setActiveTab('testing');
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
                            className="px-2.5 py-1 rounded bg-blue-50 text-gov-blue hover:bg-blue-100 font-semibold cursor-pointer"
                          >
                            View Certificate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Decoupled Physical Seal Ledger */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Stamp className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-gov-navy uppercase tracking-wider">
                  Decoupled Physical Wire Seal & Hologram Ledger
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-sans">Strictly decoupled per AGENTS.md §3.2</span>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 block">Active Lead Seal:</span>
                  <span className="font-mono font-bold text-slate-900">DL-SEAL-2026-0042</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Position:</span>
                  <span className="font-semibold text-slate-800">CALIBRATION_PORT_MAIN</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Affixed Timestamp:</span>
                  <span className="font-semibold text-slate-800">23 Aug 2026, 11:05 AM</span>
                </div>
              </div>
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
    </div>
  );
};
