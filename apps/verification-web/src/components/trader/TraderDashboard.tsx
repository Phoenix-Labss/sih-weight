import React, { useState, useEffect, useCallback } from 'react';
import { Instrument, InstrumentModel } from '../../types/instrument';
import { Application } from '../../types/application';
import { Certificate } from '../../types/certificate';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { useApiMode } from '../../context/ApiModeContext';
import { formatCurrency } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import { InstrumentRegisterModal } from './InstrumentRegisterModal';
import { VerificationWizard } from './VerificationWizard';
import { FeePaymentModal } from './FeePaymentModal';
import { ReceiptViewer } from './ReceiptViewer';
import { QueryResponseModal } from './QueryResponseModal';
import { CertificateModal } from './CertificateModal';
import { SessionSchedulerModal } from '../officer/SessionSchedulerModal';
import { ApplicationTimeline } from './ApplicationTimeline';
import { InstrumentRegistry } from './InstrumentRegistry';
import { mockModels } from '../../api/mock/mockFixtures';
import { useRealtimeSync, broadcastSyncEvent } from '../../hooks/useRealtimeSync';
import {
  Scale,
  FileCheck2,
  AlertCircle,
  CreditCard,
  Plus,
  ArrowRight,
  ShieldCheck,
  Building,
  Clock,
  RefreshCw,
} from 'lucide-react';

export const TraderDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { mode, version: apiVersion } = useApiMode();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [models, setModels] = useState<InstrumentModel[]>(mockModels);
  const [applications, setApplications] = useState<Application[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selectedSubTab, setSelectedSubTab] = useState<'overview' | 'instruments' | 'applications'>('overview');

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isApplyWizardOpen, setIsApplyWizardOpen] = useState(false);
  const [preselectedInstrument, setPreselectedInstrument] = useState<Instrument | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false);

  const [activeApplication, setActiveApplication] = useState<Application | null>(null);
  const [activeCertificate, setActiveCertificate] = useState<Certificate | null>(null);
  const [selectedAppForSchedule, setSelectedAppForSchedule] = useState<Application | null>(null);

  // Certificate quick-table pagination: 8 per "page"
  const CERTS_PER_PAGE = 8;
  const [certPage, setCertPage] = useState(1);

  const loadData = useCallback(async () => {
    try {
      const [instRes, appRes, certRes] = await Promise.all([
        api.instruments.listInstruments(user.tenantId),
        api.applications.listApplications(user.tenantId),
        api.certificates.listCertificates(user.tenantId),
      ]);
      setInstruments(instRes.items);
      setApplications(appRes.items);
      setCertificates(certRes.items);

      if (api.instruments.listModels) {
        const mList = await api.instruments.listModels();
        setModels(mList);
      }
    } catch (err) {
      console.error('Failed to load trader data:', err);
    }
  }, [user.tenantId, mode, apiVersion]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Zero-latency cross-tab sync + smart focus revalidation + 15s gentle polling
  const { broadcast } = useRealtimeSync({
    onSync: loadData,
    pollIntervalMs: 15000,
    enabled: true,
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived metrics
  const totalInstruments = instruments.length;
  const activeApplications = applications.filter((a) => a.current_status !== 'COMPLETED' && a.current_status !== 'REJECTED').length;
  // Once verification is COMPLETED the timeline card disappears from the home
  // screen; the issued certificate remains available below in the quick table.
  const visibleApplications = applications.filter((a) => a.current_status !== 'COMPLETED');
  const pendingFees = applications
    .filter(
      (a) =>
        (a.fee_assessment && a.fee_assessment.payment_status === 'PAYMENT_PENDING') ||
        a.current_status === 'FEE_PENDING' ||
        a.current_status === 'ACCEPTED' ||
        a.current_status === 'PAYMENT_PROCESSING'
    )
    .filter(
      (a) =>
        a.current_status !== 'FEE_PAID' &&
        a.current_status !== 'PAYMENT_RECONCILED' &&
        a.current_status !== 'SCHEDULED' &&
        a.current_status !== 'VERIFICATION_IN_PROGRESS' &&
        a.current_status !== 'COMPLETED' &&
        a.current_status !== 'REJECTED'
    )
    .reduce((sum, a) => sum + (a.fee_assessment?.total_assessed_amount || 750), 0);
  const dueInstruments = instruments.filter(
    (i) => i.current_status === 'VERIFICATION_DUE' || i.current_status === 'OVERDUE'
  ).length;
  // Certificate quick-table pagination
  const certTotalPages = Math.max(1, Math.ceil(certificates.length / CERTS_PER_PAGE));
  const safeCertPage = Math.min(certPage, certTotalPages);
  const visibleCertificates = certificates.slice((safeCertPage - 1) * CERTS_PER_PAGE, safeCertPage * CERTS_PER_PAGE);

  const handleOpenPayment = (app: Application) => {
    setActiveApplication(app);
    setIsPaymentModalOpen(true);
  };

  const handleOpenReceipt = (app: Application) => {
    setActiveApplication(app);
    setIsReceiptModalOpen(true);
  };

  const handleOpenQuery = (app: Application) => {
    setActiveApplication(app);
    setIsQueryModalOpen(true);
  };

  const handleOpenScheduler = (app: Application) => {
    setSelectedAppForSchedule(app);
    setIsSchedulerModalOpen(true);
  };

  const handleViewCertificate = (certId: string) => {
    const cert = certificates.find((c) => c.certificate_id === certId) || certificates[0];
    if (cert) {
      setActiveCertificate(cert);
      setIsCertModalOpen(true);
    }
  };

  const handleOpenApplyWizard = (instrument?: Instrument) => {
    setPreselectedInstrument(instrument || null);
    setIsApplyWizardOpen(true);
  };

  const handleCloseApplyWizard = () => {
    setIsApplyWizardOpen(false);
    setPreselectedInstrument(null);
  };

  return (
    <div className="space-y-6">
      {/* Trader Header Welcome Banner (Clean Government Style) */}
      <div className="bg-gov-navy text-white rounded-md p-5 sm:p-6 shadow-card border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Building className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-bold tracking-tight text-white">{user.organizationName}</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Verified Stakeholder (Form LM-REG-01)
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Commercial Establishment Workspace | Authorized Representative: <span className="font-semibold text-white">{user.actorName}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh portal data immediately"
              className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-3.5 py-2 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>{t.btnRegisterInstrument}</span>
            </button>
            <button
              onClick={() => handleOpenApplyWizard()}
              className="px-4 py-2 rounded bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-xs font-bold text-slate-950 flex items-center gap-1.5 shadow-card border border-amber-500 transition-all cursor-pointer"
            >
              <Scale className="w-4 h-4 text-slate-950" />
              <span>{t.btnApplyVerification}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Instruments */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{t.statTotalRegistered}</span>
            <div className="p-1.5 rounded bg-blue-50 text-gov-blue">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{totalInstruments}</div>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <span className="font-semibold text-emerald-700">{instruments.filter(i => i.current_status === 'VERIFIED').length}</span>
            <span>{t.statActiveValid}</span>
          </p>
        </div>

        {/* Active Applications */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{t.statPendingVerification}</span>
            <div className="p-1.5 rounded bg-emerald-50 text-emerald-700">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{activeApplications}</div>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <span>In scrutiny or testing queue</span>
          </p>
        </div>

        {/* Pending Statutory Fees */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{t.statFeesDue}</span>
            <div className="p-1.5 rounded bg-amber-50 text-amber-700">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(pendingFees)}</div>
          <p className="text-xs text-slate-500">
            {pendingFees > 0 ? 'Assessed treasury challan due' : 'All assessments reconciled'}
          </p>
        </div>

        {/* Expiring / Due alert */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Re-Verification Due</span>
            <div className={`p-1.5 rounded ${dueInstruments > 0 ? 'bg-orange-50 text-orange-700' : 'bg-slate-50 text-slate-400'}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold ${dueInstruments > 0 ? 'text-orange-700' : 'text-slate-900'}`}>
            {dueInstruments}
          </div>
          <p className="text-xs text-slate-500">
            {dueInstruments > 0 ? 'Annual verification renewal pending' : 'All instruments up to date'}
          </p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setSelectedSubTab('overview')}
          className={`px-4 py-2 rounded text-xs font-bold transition-colors cursor-pointer ${
            selectedSubTab === 'overview'
              ? 'bg-gov-navy text-white shadow-card'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
          }`}
        >
          {t.recentApplicationsTitle}
        </button>
        <button
          onClick={() => setSelectedSubTab('instruments')}
          className={`px-4 py-2 rounded text-xs font-bold transition-colors cursor-pointer ${
            selectedSubTab === 'instruments'
              ? 'bg-gov-navy text-white shadow-card'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
          }`}
        >
          {t.tabMyInstruments} ({instruments.length})
        </button>
      </div>

      {/* Sub-Tab 1: Active Applications & Timeline */}
      {selectedSubTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gov-navy flex items-center gap-2">
              <Clock className="w-4 h-4 text-gov-blue" />
              <span>Active Statutory Verification Applications</span>
            </h3>
            <button
              onClick={() => handleOpenApplyWizard()}
              className="text-xs font-semibold text-gov-blue hover:text-blue-800 flex items-center gap-1"
            >
              <span>+ New Application</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {visibleApplications.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
              No active verification applications in progress.
            </div>
          ) : (
            <div className="space-y-4">
              {visibleApplications.map((app) => (
                <ApplicationTimeline
                  key={app.application_id}
                  application={app}
                  onOpenPaymentModal={handleOpenPayment}
                  onOpenReceiptModal={handleOpenReceipt}
                  onOpenQueryModal={handleOpenQuery}
                  onOpenSchedulerModal={handleOpenScheduler}
                  onApplicationUpdated={loadData}
                  onViewCertificate={(targetApp) => {
                    const cert = certificates.find((c) => c.instrument_id === targetApp.instrument_id) || certificates[0];
                    if (cert) handleViewCertificate(cert.certificate_id);
                  }}
                />
              ))}
            </div>
          )}

          {/* Issued Certificates Quick Table, paginated 8/page */}
          {certificates.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-card space-y-3 mt-6">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <h4 className="font-bold text-xs text-gov-navy uppercase tracking-wider">
                    Issued Legal Metrology Certificates
                  </h4>
                </div>
                <span className="text-xs text-slate-500 font-mono">{certificates.length} certificates</span>
              </div>

              <div className="divide-y divide-slate-100">
                {visibleCertificates.map((cert) => (
                  <div key={cert.certificate_id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-slate-900">{cert.certificate_number}</div>
                      <div className="text-xs text-slate-500">
                        Valid From: {cert.issue_date} to <span className="font-semibold text-slate-800">{cert.valid_until}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={cert.certificate_status} size="sm" />
                      <button
                        onClick={() => {
                          setActiveCertificate(cert);
                          setIsCertModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-gov-blue hover:bg-blue-100 font-semibold transition-colors"
                      >
                        View Certificate
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {certTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Page {safeCertPage} of {certTotalPages} (showing {visibleCertificates.length} of {certificates.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCertPage((p) => Math.max(1, p - 1))}
                      disabled={safeCertPage <= 1}
                      className="px-2.5 py-1 rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    {Array.from({ length: certTotalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCertPage(page)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          page === safeCertPage ? 'bg-gov-navy text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCertPage((p) => Math.min(certTotalPages, p + 1))}
                      disabled={safeCertPage >= certTotalPages}
                      className="px-2.5 py-1 rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Instrument Registry */}
      {selectedSubTab === 'instruments' && (
        <InstrumentRegistry
          instruments={instruments}
          models={models}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          onOpenApplyWizard={handleOpenApplyWizard}
          onViewCertificate={handleViewCertificate}
        />
      )}

      {/* Modals */}
      <InstrumentRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        models={models}
        onRegistered={() => {
          setSelectedSubTab('instruments');
          broadcast('APPLICATION_UPDATED');
          loadData();
        }}
      />

      {isApplyWizardOpen && (
        <VerificationWizard
          key={preselectedInstrument ? preselectedInstrument.instrument_id : 'general'}
          isOpen={isApplyWizardOpen}
          onClose={handleCloseApplyWizard}
          instruments={instruments}
          preselectedInstrument={preselectedInstrument}
          onApplicationCreated={() => {
            setSelectedSubTab('overview');
            broadcast('APPLICATION_CREATED');
            loadData();
          }}
        />
      )}

      <FeePaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          loadData();
        }}
        application={activeApplication}
        onPaymentCompleted={(updated) => {
          setApplications((prev) =>
            prev.map((a) => (a.application_id === updated.application_id ? { ...updated } : a))
          );
          setActiveApplication(updated);
          broadcast('PAYMENT_RECONCILED');
          loadData();
        }}
      />

      <ReceiptViewer
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        application={activeApplication}
      />

      <QueryResponseModal
        isOpen={isQueryModalOpen}
        onClose={() => setIsQueryModalOpen(false)}
        application={activeApplication}
        onQueryResponded={() => {
          broadcast('APPLICATION_UPDATED');
          loadData();
        }}
      />

      <CertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        certificate={activeCertificate}
        instrument={instruments.find((i) => i.instrument_id === activeCertificate?.instrument_id)}
      />

      <SessionSchedulerModal
        isOpen={isSchedulerModalOpen}
        onClose={() => setIsSchedulerModalOpen(false)}
        application={selectedAppForSchedule}
        onScheduled={(updated) => {
          if (updated) {
            setApplications((prev) =>
              prev.map((a) =>
                a.application_id === updated.application_id || a.application_number === updated.application_number
                  ? { ...a, ...updated }
                  : a
              )
            );
          }
          broadcast('SLOT_SCHEDULED');
          loadData();
        }}
      />
    </div>
  );
};
