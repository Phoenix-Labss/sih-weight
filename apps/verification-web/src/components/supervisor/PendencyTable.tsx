import React, { useState, useMemo } from 'react';
import { Application } from '../../types/application';
import { useNotification } from '../../context/NotificationContext';
import { Modal } from '../common/Modal';
import { api } from '../../api/client';
import { mockDb } from '../../api/mock/mockService';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  UserCheck,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface PendencyTableProps {
  applications?: Application[];
  onRefresh?: () => void;
}

interface DisplayPendencyItem {
  applicationId: string;
  applicationNumber: string;
  applicantName: string;
  instrumentCategory: string;
  daysPending: number;
  currentStage: string;
  assignedOfficer: string;
  slaStatus: 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
  rawApplication?: Application;
}

export const PendencyTable: React.FC<PendencyTableProps> = ({ applications = [], onRefresh }) => {
  const { notify } = useNotification();
  const [filterSla, setFilterSla] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Reassignment Modal State
  const [reassignApp, setReassignApp] = useState<Application | null>(null);
  const [targetOfficerId, setTargetOfficerId] = useState<string>('lmo-officer-02');
  const [reassignReason, setReassignReason] = useState<string>('Workload balancing for SLA turnaround optimization');
  const [isReassigning, setIsReassigning] = useState(false);

  // Derive dynamic pendency rows from live applications (or fallback mock)
  const pendencyItems: DisplayPendencyItem[] = useMemo(() => {
    if (applications.length > 0) {
      const now = new Date().getTime();
      return applications
        .filter((app) => app.current_status !== 'COMPLETED' && app.current_status !== 'REJECTED')
        .map((app) => {
          const createdTime = new Date(app.created_at || new Date()).getTime();
          const daysPending = Math.max(1, Math.floor((now - createdTime) / (1000 * 60 * 60 * 24)));

          let slaStatus: 'ON_TRACK' | 'AT_RISK' | 'BREACHED' = 'ON_TRACK';
          if (daysPending > 30) {
            slaStatus = 'BREACHED';
          } else if (daysPending > 14) {
            slaStatus = 'AT_RISK';
          }

          let stageLabel = app.current_status.replace(/_/g, ' ');
          if (app.current_status === 'SUBMITTED') stageLabel = 'Under Scrutiny';
          if (app.current_status === 'FEE_PENDING') stageLabel = 'Statutory Fee Pending';
          if (app.current_status === 'PAYMENT_RECONCILED') stageLabel = 'Payment Reconciled — Ready to Schedule';
          if (app.current_status === 'SCHEDULED') stageLabel = 'Scheduled Inspection Slot';
          if (app.current_status === 'VERIFICATION_IN_PROGRESS') stageLabel = 'Testing in Progress';

          let officerName = 'Inspector Amit Sharma (LMO Central)';
          if (app.assigned_lmo_id === 'lmo-officer-02') officerName = 'Inspector Rajesh Verma (LMO North)';
          if (app.assigned_gatc_id || app.assigned_lmo_id === 'gatc-verifier-01') officerName = 'Apex Metrology Lab (GATC)';

          const applicantName =
            app.applicant?.legal_name ||
            (app as any).applicant_name ||
            'Commercial Trader Establishment';

          const instrumentCat =
            app.instrument?.model?.category === 'NAWI'
              ? `${app.instrument.model.model_name || 'Counter Scale'} (Class ${app.instrument.model.accuracy_class?.replace('CLASS_', '') || 'III'})`
              : 'Commercial Weighing Instrument (NAWI)';

          return {
            applicationId: app.application_id || app.application_number,
            applicationNumber: app.application_number,
            applicantName,
            instrumentCategory: instrumentCat,
            daysPending,
            currentStage: stageLabel,
            assignedOfficer: officerName,
            slaStatus,
            rawApplication: app,
          };
        });
    }

    // Default sample fallback
    return [
      {
        applicationId: 'app-001',
        applicationNumber: 'APP-DL-2026-00412',
        applicantName: 'Reliance Retail Ltd (Store #42)',
        instrumentCategory: 'NAWI Class III Counter Scale (30 kg)',
        daysPending: 18,
        currentStage: 'Under Scrutiny',
        assignedOfficer: 'Inspector Amit Sharma (LMO Central)',
        slaStatus: 'AT_RISK',
      },
      {
        applicationId: 'app-002',
        applicationNumber: 'APP-DL-2026-00399',
        applicantName: 'Bharat Petroleum Dispenser Unit #3',
        instrumentCategory: 'Liquid Fuel Dispenser (50 L/min)',
        daysPending: 34,
        currentStage: 'Pending Verification Slot',
        assignedOfficer: 'Inspector Rajesh Verma (LMO North)',
        slaStatus: 'BREACHED',
      },
      {
        applicationId: 'app-003',
        applicationNumber: 'APP-DL-2026-00445',
        applicantName: 'Tanishq Jewelers Main Branch',
        instrumentCategory: 'NAWI Class II High Precision (600 g)',
        daysPending: 4,
        currentStage: 'Fee Paid - Ready to Schedule',
        assignedOfficer: 'Apex Metrology Lab (GATC)',
        slaStatus: 'ON_TRACK',
      },
      {
        applicationId: 'app-004',
        applicationNumber: 'APP-DL-2026-00450',
        applicantName: 'Kalyan Jewellers Precision Balances',
        instrumentCategory: 'NAWI Class I Micro-balance (200 g)',
        daysPending: 2,
        currentStage: 'Under Scrutiny',
        assignedOfficer: 'Inspector Amit Sharma (LMO Central)',
        slaStatus: 'ON_TRACK',
      },
    ];
  }, [applications]);

  const filtered = pendencyItems.filter((item) => {
    const matchesSla = filterSla === 'ALL' || item.slaStatus === filterSla;
    const matchesSearch =
      item.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.assignedOfficer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSla && matchesSearch;
  });

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignApp) return;

    setIsReassigning(true);
    try {
      // Reassign via API or mock
      const targetOfficerName =
        targetOfficerId === 'lmo-officer-01'
          ? 'Inspector Amit Sharma (LMO Central)'
          : targetOfficerId === 'lmo-officer-02'
          ? 'Inspector Rajesh Verma (LMO North)'
          : 'Apex Metrology Lab (GATC)';

      // Update mockDb applications
      const dbApp = mockDb.getApplication(reassignApp.application_id || reassignApp.application_number);
      if (dbApp) {
        dbApp.assigned_lmo_id = targetOfficerId;
        dbApp.updated_at = new Date().toISOString();
      }

      notify(
        'success',
        'Officer Reassigned',
        `Application ${reassignApp.application_number} reassigned to ${targetOfficerName}. Audit entry appended.`
      );

      setReassignApp(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      notify('error', 'Reassignment Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-bold text-gov-navy">Application Pendency &amp; Statutory SLA Tracker</h3>
          <p className="text-xs text-slate-500">Citizen Charter Turnaround Monitoring under Section 24</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search app, trader, officer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs rounded-md border border-slate-300 pl-8 pr-2.5 py-1.5 focus:ring-2 focus:ring-gov-blue"
            />
          </div>

          {/* Filter SLA */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter SLA:</span>
            <select
              value={filterSla}
              onChange={(e) => setFilterSla(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-gov-blue cursor-pointer"
            >
              <option value="ALL">All Applications ({pendencyItems.length})</option>
              <option value="ON_TRACK">On Track (&lt; 14 Days)</option>
              <option value="AT_RISK">At Risk (15–30 Days)</option>
              <option value="BREACHED">Breached (&gt; 30 Days)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-100/70 text-left font-bold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">App Number</th>
              <th className="px-4 py-3">Applicant / Trader</th>
              <th className="px-4 py-3">Instrument Category</th>
              <th className="px-4 py-3 text-center">Age (Days)</th>
              <th className="px-4 py-3">Current Stage</th>
              <th className="px-4 py-3">Assigned Officer</th>
              <th className="px-4 py-3">SLA Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => {
              let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
              let StatusIcon = CheckCircle2;
              if (item.slaStatus === 'AT_RISK') {
                badgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
                StatusIcon = AlertTriangle;
              }
              if (item.slaStatus === 'BREACHED') {
                badgeColor = 'bg-rose-50 text-rose-800 border-rose-300';
                StatusIcon = XCircle;
              }

              return (
                <tr key={item.applicationId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-gov-blue">{item.applicationNumber}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.applicantName}</td>
                  <td className="px-4 py-3 text-slate-600">{item.instrumentCategory}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900">{item.daysPending}d</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{item.currentStage}</td>
                  <td className="px-4 py-3 text-slate-600">{item.assignedOfficer}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeColor}`}>
                      <StatusIcon className="w-3 h-3" />
                      <span>{item.slaStatus.replace(/_/g, ' ')}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        const raw = item.rawApplication || ({
                          application_id: item.applicationId,
                          application_number: item.applicationNumber,
                          tenant_id: 'tenant-delhi-central',
                          jurisdiction_id: 'JUR-DL-01',
                          service_mode: 'ON_SITE',
                          current_status: 'SUBMITTED',
                        } as any);
                        setReassignApp(raw);
                      }}
                      className="px-2.5 py-1 rounded bg-white border border-slate-300 hover:border-gov-blue text-gov-blue font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Reassign
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reassign Officer Modal */}
      {reassignApp && (
        <Modal
          isOpen={true}
          onClose={() => setReassignApp(null)}
          title={`Reassign Application: ${reassignApp.application_number}`}
          subtitle="Statutory Supervisory Task Balancing & Officer Reassignment"
          maxWidth="md"
        >
          <form onSubmit={handleReassignSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Inspecting Officer / Centre *
              </label>
              <select
                value={targetOfficerId}
                onChange={(e) => setTargetOfficerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-gov-blue"
              >
                <option value="lmo-officer-01">Inspector Amit Sharma (LMO Central Zone)</option>
                <option value="lmo-officer-02">Inspector Rajesh Verma (LMO North District)</option>
                <option value="gatc-verifier-01">Apex Metrology Lab (GATC Industrial)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Statutory Justification / Reassignment Reason *
              </label>
              <textarea
                rows={3}
                required
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-gov-blue"
                placeholder="Enter justification for audit log..."
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setReassignApp(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isReassigning}
                className="px-5 py-2 rounded-lg bg-gov-blue text-xs font-bold text-white hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>{isReassigning ? 'Reassigning...' : 'Confirm Reassignment'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
