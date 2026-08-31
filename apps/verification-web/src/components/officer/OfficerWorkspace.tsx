import React, { useState, useEffect, useCallback } from 'react';
import { Application } from '../../types/application';
import { Instrument } from '../../types/instrument';
import { VerificationSession } from '../../types/session';
import { Certificate } from '../../types/certificate';
import { PhysicalStamp } from '../../types/stamp';
import { api } from '../../api/client';
import { mockDb } from '../../api/mock/mockService';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useApiMode } from '../../context/ApiModeContext';
import { ScrutinyQueue } from './ScrutinyQueue';
import { TestObservationGrid } from './TestObservationGrid';
import { CertificateModal } from '../trader/CertificateModal';
import { WorksheetModal } from './WorksheetModal';
import { StatusBadge } from '../common/StatusBadge';
import { truncateHash } from '../../utils/formatters';
import {
  ShieldCheck,
  FileCheck2,
  Calendar,
  Scale,
  Award,
  Lock,
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
  const [, setStamps] = useState<PhysicalStamp[]>([]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedCertForView, setSelectedCertForView] = useState<Certificate | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Dedicated Worksheet Inspection Modal State
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
      console.error('Failed to load officer data:', err);
    }
  }, [user.tenantId, selectedSessionId, mode, apiVersion]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Departmental LMO Certificates strictly (excludes third-party GATC test reports)
  const lmoCertificates = certificates.filter(
    (c) => c.issuer_type !== 'GATC' && !c.certificate_number.startsWith('GATC-')
  );

  // Active testing workload: strictly sessions that still require officer testing actions (uncompleted)
  const activeWorkSessions = sessions.filter(
    (s) => !(s.status === 'FINALIZED' && certificates.some((c) => c.session_id === s.session_id))
  );

  // Pending Scrutiny applications (action required: scrutiny, query response, or scheduling)
  const pendingScrutinyApps = applications.filter(
    (a) => a.current_status !== 'COMPLETED' && a.current_status !== 'REJECTED'
  );

  // Active workload session strictly for the live testing console
  const activeSession = activeWorkSessions.find((s) => s.session_id === selectedSessionId) || activeWorkSessions[0] || null;
  const activeSessionApp = activeSession ? applications.find((a) => a.application_id === activeSession.application_id) : null;
  const activeSessionInst = activeSession ? instruments.find((i) => i.instrument_id === (activeSession.instrument_id || activeSessionApp?.instrument_id)) : null;
  const activeSessionCert = activeSession ? certificates.find((c) => c.session_id === activeSession.session_id) : null;

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
      <div className="bg-gov-navy text-white rounded-lg p-5 sm:p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="w-6 h-6 text-amber-400" aria-hidden="true" />
              <h2 className="text-xl font-bold tracking-tight">Legal Metrology Officer Enforcement Console</h2>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-amber-300 border border-white/20">
                LMO STATUTORY AUTHORITY
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Officer: <span className="font-semibold text-white">{user.actorName}</span> | Designation: <span className="font-mono text-amber-300">{user.actorRole}</span> | Jurisdiction: <span className="font-mono text-slate-200">Delhi Central (JUR-DL-01)</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 px-3.5 py-2 rounded-md border border-white/15 text-xs text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span>Key Slot: <strong className="font-mono text-white">HSM-DL-01</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('scrutiny')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'scrutiny'
              ? 'bg-gov-navy text-white shadow-card'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-gov-goldDeep" aria-hidden="true" />
          <span>Application Scrutiny &amp; Scheduling Queue ({pendingScrutinyApps.length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('testing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'testing'
              ? 'bg-emerald-700 text-white shadow-card'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scale className="w-4 h-4 text-emerald-300" />
          <span>Guided NAWI Testing Session Execution ({activeWorkSessions.length} Active Workload)</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-gov-blue text-white shadow-card'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4 text-gov-blue" aria-hidden="true" />
          <span>Issued Departmental Certificates Ledger ({lmoCertificates.length})</span>
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

      {/* Tab 2: Guided NAWI Testing Execution (Active Workload Only) */}
      {activeTab === 'testing' && (
        <div className="space-y-4">
          {/* Session Picker Bar (Strictly Active Workload) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-card flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 shrink-0">
              <Calendar className="w-4 h-4 text-gov-blue" />
              <span>Active Testing Queue:</span>
            </div>
            <div className="flex-1 w-full">
              <select
                value={activeSession?.session_id || ''}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                disabled={activeWorkSessions.length === 0}
                className="text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue w-full disabled:bg-slate-50 disabled:text-slate-400"
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
                  <option value="">No pending verification sessions — Active queue clear</option>
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
              <h3 className="font-bold text-slate-700 text-sm">No Pending Verification Workload</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All scheduled applications have been completed and certified. Allocate new inspection slots in Scrutiny or inspect immutable observation records in the Master Ledger.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Master Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Issued Certificates Ledger */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-sm text-gov-navy uppercase tracking-wider">
                  Departmental Statutory Verification Certificates Master Ledger
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500">{lmoCertificates.length} Total Records</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear all demo certificates and reset database back to baseline state?')) {
                      mockDb.resetDatabase();
                      loadData();
                      notify('success', 'Database Reset', 'All demo certificates cleared and state restored to baseline.');
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 transition-colors cursor-pointer"
                  title="Clear all generated mock certificates and reset database"
                >
                  Clear All Data / Reset
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-xs">
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
                  {lmoCertificates.length > 0 ? (
                    lmoCertificates.map((cert) => (
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
                              className="px-2.5 py-1 rounded bg-blue-50 text-gov-blue hover:bg-blue-100 font-semibold cursor-pointer"
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
                        No issued certificates in Master Ledger yet. Execute verification testing in the Live Testing console to issue statutory certificates.
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
