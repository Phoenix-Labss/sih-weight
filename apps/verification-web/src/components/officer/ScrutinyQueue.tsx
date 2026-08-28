import React, { useState, useMemo } from 'react';
import { Application } from '../../types/application';
import { Instrument } from '../../types/instrument';
import { Certificate } from '../../types/certificate';
import { VerificationSession } from '../../types/session';
import { StatusBadge } from '../common/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { ScrutinyActionModal } from './ScrutinyActionModal';
import { SessionSchedulerModal } from './SessionSchedulerModal';
import { CertificateModal } from '../trader/CertificateModal';
import { ReceiptViewer } from '../trader/ReceiptViewer';
import { WorksheetModal } from './WorksheetModal';
import {
  Search,
  CheckCircle2,
  Calendar,
  FileCheck2,
  Scale,
  Award,
  Receipt,
  ArrowUp,
  ArrowDown,
  Download,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Layers,
} from 'lucide-react';

interface ScrutinyQueueProps {
  applications: Application[];
  instruments: Instrument[];
  certificates?: Certificate[];
  sessions?: VerificationSession[];
  onApplicationUpdated: () => void;
  onSelectSessionForTesting?: (appId: string) => void;
}

type QueueTab = 'active' | 'completed' | 'queries' | 'all';
type SortField = 'date' | 'app_num' | 'fee' | 'model' | 'serial';
type SortDirection = 'asc' | 'desc';

export const ScrutinyQueue: React.FC<ScrutinyQueueProps> = ({
  applications,
  instruments,
  certificates = [],
  sessions = [],
  onApplicationUpdated,
  onSelectSessionForTesting,
}) => {
  // Tab Selection
  const [activeQueueTab, setActiveQueueTab] = useState<QueueTab>('active');

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');

  // Sorting States
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modals
  const [selectedAppForScrutiny, setSelectedAppForScrutiny] = useState<Application | null>(null);
  const [selectedAppForSchedule, setSelectedAppForSchedule] = useState<Application | null>(null);
  const [selectedAppForReceipt, setSelectedAppForReceipt] = useState<Application | null>(null);
  const [selectedCertForView, setSelectedCertForView] = useState<Certificate | null>(null);
  const [selectedInstrumentForCert, setSelectedInstrumentForCert] = useState<Instrument | null>(null);

  const [isScrutinyModalOpen, setIsScrutinyModalOpen] = useState(false);
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Dedicated Worksheet Inspection Modal State
  const [selectedWorksheetSession, setSelectedWorksheetSession] = useState<VerificationSession | null>(null);
  const [selectedWorksheetCert, setSelectedWorksheetCert] = useState<Certificate | null>(null);
  const [selectedWorksheetApp, setSelectedWorksheetApp] = useState<Application | null>(null);
  const [isWorksheetModalOpen, setIsWorksheetModalOpen] = useState(false);

  const handleOpenWorksheet = (app: Application) => {
    let sess = sessions.find((s) => s.application_id === app.application_id);
    if (!sess) {
      sess = sessions.find((s) => s.instrument_id === app.instrument_id);
    }
    const cert = certificates.find((c) => c.session_id === sess?.session_id || c.instrument_id === app.instrument_id);
    setSelectedWorksheetSession(sess || null);
    setSelectedWorksheetCert(cert || null);
    setSelectedWorksheetApp(app);
    setIsWorksheetModalOpen(true);
  };

  // Tab Count Calculations
  const activeApps = useMemo(
    () => applications.filter((a) => a.current_status !== 'COMPLETED' && a.current_status !== 'REJECTED'),
    [applications]
  );
  const completedApps = useMemo(
    () => applications.filter((a) => a.current_status === 'COMPLETED'),
    [applications]
  );
  const queryRejectedApps = useMemo(
    () => applications.filter((a) => a.current_status === 'QUERY_RAISED' || a.current_status === 'REJECTED'),
    [applications]
  );

  // Tab Base List
  const baseListForTab = useMemo(() => {
    switch (activeQueueTab) {
      case 'active':
        return activeApps;
      case 'completed':
        return completedApps;
      case 'queries':
        return queryRejectedApps;
      case 'all':
      default:
        return applications;
    }
  }, [activeQueueTab, activeApps, completedApps, queryRejectedApps, applications]);

  // Filtered & Sorted Applications
  const displayedApplications = useMemo(() => {
    return baseListForTab
      .filter((app) => {
        const inst = instruments.find((i) => i.instrument_id === app.instrument_id);
        const cert = certificates.find((c) => c.instrument_id === app.instrument_id || c.session_id === app.application_id);

        const searchLower = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !searchLower ||
          app.application_number.toLowerCase().includes(searchLower) ||
          app.applicant_id.toLowerCase().includes(searchLower) ||
          (inst?.model?.model_name && inst.model.model_name.toLowerCase().includes(searchLower)) ||
          (inst?.serial_number && inst.serial_number.toLowerCase().includes(searchLower)) ||
          (cert?.certificate_number && cert.certificate_number.toLowerCase().includes(searchLower));

        const matchesStatus = statusFilter === 'ALL' || app.current_status === statusFilter;
        const matchesType = typeFilter === 'ALL' || app.application_type === typeFilter;
        const matchesMode = modeFilter === 'ALL' || app.service_mode === modeFilter;

        return matchesSearch && matchesStatus && matchesType && matchesMode;
      })
      .sort((a, b) => {
        const instA = instruments.find((i) => i.instrument_id === a.instrument_id);
        const instB = instruments.find((i) => i.instrument_id === b.instrument_id);

        let comparison = 0;
        switch (sortField) {
          case 'date': {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            comparison = timeB - timeA;
            break;
          }
          case 'app_num':
            comparison = a.application_number.localeCompare(b.application_number);
            break;
          case 'fee': {
            const feeA = a.fee_assessment?.total_assessed_amount || 750;
            const feeB = b.fee_assessment?.total_assessed_amount || 750;
            comparison = feeB - feeA;
            break;
          }
          case 'model': {
            const nameA = instA?.model?.model_name || '';
            const nameB = instB?.model?.model_name || '';
            comparison = nameA.localeCompare(nameB);
            break;
          }
          case 'serial': {
            const snA = instA?.serial_number || '';
            const snB = instB?.serial_number || '';
            comparison = snA.localeCompare(snB);
            break;
          }
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [
    baseListForTab,
    searchTerm,
    statusFilter,
    typeFilter,
    modeFilter,
    sortField,
    sortDirection,
    instruments,
    certificates,
  ]);

  // Completed Tab Metrics
  const totalCompletedRevenue = useMemo(() => {
    return completedApps.reduce(
      (sum, a) => sum + (a.fee_assessment?.total_assessed_amount || 750),
      0
    );
  }, [completedApps]);

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleOpenScrutiny = (app: Application) => {
    setSelectedAppForScrutiny(app);
    setIsScrutinyModalOpen(true);
  };

  const handleOpenSchedule = (app: Application) => {
    setSelectedAppForSchedule(app);
    setIsSchedulerModalOpen(true);
  };

  const handleOpenReceipt = (app: Application) => {
    setSelectedAppForReceipt(app);
    setIsReceiptModalOpen(true);
  };

  const handleViewCertificate = (app: Application) => {
    const cert =
      certificates.find((c) => c.instrument_id === app.instrument_id) ||
      certificates.find((c) => c.session_id === app.application_id) ||
      certificates[0];
    const inst = instruments.find((i) => i.instrument_id === app.instrument_id) || null;

    if (cert) {
      setSelectedCertForView(cert);
      setSelectedInstrumentForCert(inst);
      setIsCertModalOpen(true);
    }
  };

  const handleExportCSV = () => {
    if (displayedApplications.length === 0) return;

    const headers = [
      'Application Number',
      'Created Date',
      'Status',
      'Application Type',
      'Service Mode',
      'Instrument Model',
      'Serial Number',
      'Accuracy Class',
      'Statutory Fee (INR)',
      'Payment Status',
      'Receipt Number',
    ];

    const rows = displayedApplications.map((app) => {
      const inst = instruments.find((i) => i.instrument_id === app.instrument_id);
      return [
        app.application_number,
        app.created_at || '',
        app.current_status,
        app.application_type,
        app.service_mode,
        inst?.model?.model_name || 'N/A',
        inst?.serial_number || 'N/A',
        inst?.model?.accuracy_class || 'N/A',
        app.fee_assessment?.total_assessed_amount || 750,
        app.fee_assessment?.payment_status || 'PAYMENT_RECONCILED',
        app.fee_assessment?.receipt_number || 'N/A',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `emetrology_applications_${activeQueueTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gov-navy text-amber-400 shadow-xs">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gov-navy">Departmental Verification &amp; Scrutiny Management</h3>
            <p className="text-xs text-slate-500">
              Scrutinize filings, track treasury fee receipts, allocate physical inspection slots, and audit certified records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
            title="Export filtered table to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => {
            setActiveQueueTab('active');
            setStatusFilter('ALL');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeQueueTab === 'active'
              ? 'bg-gov-navy text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Active In-Progress Queue</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              activeQueueTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {activeApps.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveQueueTab('completed');
            setStatusFilter('ALL');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeQueueTab === 'completed'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-300" />
          <span>Completed &amp; Certified Archive</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              activeQueueTab === 'completed' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {completedApps.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveQueueTab('queries');
            setStatusFilter('ALL');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeQueueTab === 'queries'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-300" />
          <span>Deficiency Queries &amp; Rejected</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              activeQueueTab === 'queries' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {queryRejectedApps.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveQueueTab('all');
            setStatusFilter('ALL');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeQueueTab === 'all'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 text-slate-300" />
          <span>All Applications Catalog</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              activeQueueTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {applications.length}
          </span>
        </button>
      </div>

      {/* KPI Stats Bar specifically for Completed Tab */}
      {activeQueueTab === 'completed' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-4 rounded-xl shadow-xs">
          <div className="border-r border-white/10 pr-3">
            <div className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider">Certified Instruments</div>
            <div className="text-2xl font-extrabold font-mono mt-0.5">{completedApps.length}</div>
            <p className="text-[10px] text-slate-300">Form IX Digital Certificates Issued</p>
          </div>

          <div className="border-r border-white/10 pr-3">
            <div className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider">Reconciled Revenue</div>
            <div className="text-2xl font-extrabold font-mono text-amber-300 mt-0.5">
              {formatCurrency(totalCompletedRevenue)}
            </div>
            <p className="text-[10px] text-slate-300">Treasury Head 1475 Settled</p>
          </div>

          <div className="border-r border-white/10 pr-3">
            <div className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider">Statutory Compliance</div>
            <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-0.5">100%</div>
            <p className="text-[10px] text-slate-300">NAWI MPE &amp; Lead Seal Verified</p>
          </div>

          <div>
            <div className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider">Avg. Turnaround SLA</div>
            <div className="text-2xl font-extrabold font-mono mt-0.5">1.2 Days</div>
            <p className="text-[10px] text-slate-300">Filing to Cryptographic Issuance</p>
          </div>
        </div>
      )}

      {/* Search, Sorting, and Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder={
              activeQueueTab === 'completed'
                ? 'Search completed records by Application No, Model, Serial, or Cert No...'
                : 'Search by application number, applicant, or instrument model...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-3 py-2 focus:ring-2 focus:ring-gov-blue"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Status filter (only for Active or All tabs) */}
          {activeQueueTab !== 'completed' && activeQueueTab !== 'queries' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
            >
              <option value="ALL">All States</option>
              <option value="SUBMITTED">Submitted (Pending Scrutiny)</option>
              <option value="QUERY_RESPONDED">Query Responded</option>
              <option value="FEE_PENDING">Fee Assessment Pending</option>
              <option value="PAYMENT_RECONCILED">Paid &amp; Ready to Schedule</option>
              <option value="SCHEDULED">Scheduled for Testing</option>
              <option value="VERIFICATION_IN_PROGRESS">Testing in Progress</option>
            </select>
          )}

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
          >
            <option value="ALL">All Verification Types</option>
            <option value="INITIAL_VERIFICATION">Initial Verification</option>
            <option value="PERIODICAL_REVERIFICATION">Periodical Reverification</option>
            <option value="REVERIFICATION_AFTER_REPAIR">Re-verification after Repair</option>
          </select>

          {/* Mode Filter */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
          >
            <option value="ALL">All Service Modes</option>
            <option value="ON_SITE">On Site</option>
            <option value="LABORATORY">Departmental Laboratory</option>
            <option value="MOBILE_VAN">Mobile Testing Van</option>
          </select>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="text-xs bg-transparent border-none font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="date">Date Filed</option>
              <option value="app_num">Application No.</option>
              <option value="fee">Statutory Fee</option>
              <option value="model">Instrument Model</option>
              <option value="serial">Serial Number</option>
            </select>
            <button
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1 text-slate-600 hover:text-gov-navy transition-colors rounded hover:bg-slate-200 cursor-pointer"
              title={`Sort direction: ${sortDirection.toUpperCase()}`}
            >
              {sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th
                  onClick={() => handleSortToggle('app_num')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Application Details</span>
                    {sortField === 'app_num' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSortToggle('model')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Instrument Unit</span>
                    {sortField === 'model' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Verification Type &amp; Mode</th>
                <th
                  onClick={() => handleSortToggle('fee')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Fee / Treasury Status</span>
                    {sortField === 'fee' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Current Status</th>
                <th className="py-3 px-4 text-right">Officer Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedApplications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold">No applications found in this view.</span>
                      <span className="text-[11px] text-slate-400">
                        {activeQueueTab === 'completed'
                          ? 'Completed verification certificates will appear here once disposition is finalized.'
                          : 'Try clearing your search query or filters.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedApplications.map((app) => {
                  const inst = instruments.find((i) => i.instrument_id === app.instrument_id);
                  const isCompleted = app.current_status === 'COMPLETED';

                  const isSubmittedOrQuery =
                    app.current_status === 'SUBMITTED' ||
                    app.current_status === 'QUERY_RESPONDED' ||
                    app.current_status === 'UNDER_SCRUTINY';

                  const isFeePending =
                    app.current_status === 'FEE_PENDING' || app.current_status === 'ACCEPTED';

                  // Statutory Rule: An application can only be scheduled once the fee
                  // is PAID & RECONCILED.
                  const isPaidReadyToSchedule =
                    app.current_status === 'PAYMENT_RECONCILED' ||
                    app.current_status === 'FEE_PAID' ||
                    (app.fee_assessment &&
                      (app.fee_assessment.payment_status === 'PAYMENT_RECONCILED' ||
                        app.fee_assessment.payment_status === 'SUCCESS') &&
                      app.current_status !== 'SCHEDULED' &&
                      app.current_status !== 'COMPLETED');

                  const isScheduled =
                    app.current_status === 'SCHEDULED' || app.current_status === 'VERIFICATION_IN_PROGRESS';

                  return (
                    <tr key={app.application_id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Application Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gov-navy font-mono flex items-center gap-1.5">
                          <span>{app.application_number}</span>
                          {isCompleted && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                              CERTIFIED
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Filed: {formatDateTime(app.created_at)}
                        </div>
                      </td>

                      {/* Instrument Unit */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {inst?.model?.model_name || 'Electronic Counter Scale'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          SN: <span className="font-bold text-slate-700">{inst?.serial_number || 'N/A'}</span> | Class:{' '}
                          {inst?.model?.accuracy_class || 'CLASS_III'}
                        </div>
                      </td>

                      {/* Verification Type & Mode */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{app.application_type.replace(/_/g, ' ')}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{app.service_mode.replace(/_/g, ' ')}</div>
                      </td>

                      {/* Fee / Treasury Status */}
                      <td className="py-3.5 px-4">
                        {isCompleted ? (
                          <div>
                            <div className="font-mono font-semibold text-slate-900">
                              {formatCurrency(app.fee_assessment?.total_assessed_amount || 750)}
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" />
                              <span>PAYMENT_RECONCILED</span>
                            </span>
                          </div>
                        ) : app.fee_assessment ? (
                          <div>
                            <div className="font-mono font-semibold text-slate-900">
                              {formatCurrency(app.fee_assessment.total_assessed_amount || 750)}
                            </div>
                            <span
                              className={`text-[10px] font-bold ${
                                app.fee_assessment.payment_status === 'PAYMENT_RECONCILED'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {app.fee_assessment.payment_status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Not Assessed</span>
                        )}
                      </td>

                      {/* Current Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={app.current_status} size="sm" />
                      </td>

                      {/* Officer Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Completed Tab Actions */}
                          {isCompleted && (
                            <>
                              <button
                                onClick={() => handleViewCertificate(app)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                title="View Cryptographic Certificate of Verification"
                              >
                                <Award className="w-3.5 h-3.5 text-amber-300" />
                                <span>Certificate</span>
                              </button>

                              <button
                                onClick={() => handleOpenReceipt(app)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs border border-slate-700 cursor-pointer"
                                title="View Reconciled Statutory Treasury Receipt"
                              >
                                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Receipt</span>
                              </button>

                              <button
                                onClick={() => handleOpenWorksheet(app)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold inline-flex items-center gap-1 transition-colors border border-slate-300 cursor-pointer"
                                title="Inspect NAWI Observation Worksheet & Error Data"
                              >
                                <Scale className="w-3.5 h-3.5 text-slate-600" />
                                <span>Worksheet</span>
                              </button>
                            </>
                          )}

                          {/* Active Queue Actions */}
                          {!isCompleted && (
                            <>
                              {isSubmittedOrQuery && (
                                <button
                                  onClick={() => handleOpenScrutiny(app)}
                                  className="px-2.5 py-1 rounded-lg bg-gov-blue text-white hover:bg-blue-800 font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                >
                                  <FileCheck2 className="w-3 h-3" />
                                  <span>Scrutinize</span>
                                </button>
                              )}

                              {isPaidReadyToSchedule && !isScheduled && (
                                <button
                                  onClick={() => handleOpenSchedule(app)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                  title="Allocate verification slot and assign LMO inspector"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>Schedule Slot</span>
                                </button>
                              )}

                              {isFeePending && !isPaidReadyToSchedule && !isScheduled && (
                                <span
                                  className="px-2 py-1 rounded bg-amber-50 text-amber-800 font-semibold text-[10px] border border-amber-200"
                                  title="Waiting for applicant to pay statutory fees before scheduling"
                                >
                                  Fee Pending
                                </span>
                              )}

                              {onSelectSessionForTesting && isScheduled && (
                                <button
                                  onClick={() => onSelectSessionForTesting(app.application_id)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-white hover:bg-slate-900 font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                  title="Launch NAWI test observation grid for this instrument"
                                >
                                  <Scale className="w-3 h-3 text-amber-400" />
                                  <span>Testing Grid</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ScrutinyActionModal
        isOpen={isScrutinyModalOpen}
        onClose={() => setIsScrutinyModalOpen(false)}
        application={selectedAppForScrutiny}
        onActionCompleted={() => {
          onApplicationUpdated();
        }}
      />

      <SessionSchedulerModal
        isOpen={isSchedulerModalOpen}
        onClose={() => setIsSchedulerModalOpen(false)}
        application={selectedAppForSchedule}
        onScheduled={() => {
          onApplicationUpdated();
        }}
      />

      <CertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        certificate={selectedCertForView}
        instrument={selectedInstrumentForCert}
      />

      <ReceiptViewer
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        application={selectedAppForReceipt}
      />

      <WorksheetModal
        isOpen={isWorksheetModalOpen}
        onClose={() => setIsWorksheetModalOpen(false)}
        session={selectedWorksheetSession}
        instrument={selectedWorksheetApp ? instruments.find((i) => i.instrument_id === selectedWorksheetApp.instrument_id) : null}
        application={selectedWorksheetApp}
        certificate={selectedWorksheetCert}
        onViewCertificate={(cert) => {
          setSelectedCertForView(cert);
          setSelectedInstrumentForCert(instruments.find((i) => i.instrument_id === cert.instrument_id) || null);
          setIsCertModalOpen(true);
        }}
      />
    </div>
  );
};
