import React, { useState } from 'react';
import { Application } from '../../types/application';
import { Instrument } from '../../types/instrument';
import { StatusBadge } from '../common/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { ScrutinyActionModal } from './ScrutinyActionModal';
import { SessionSchedulerModal } from './SessionSchedulerModal';
import {
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Eye,
  FileCheck2,
  Scale,
} from 'lucide-react';

interface ScrutinyQueueProps {
  applications: Application[];
  instruments: Instrument[];
  onApplicationUpdated: () => void;
  onSelectSessionForTesting?: (appId: string) => void;
}

export const ScrutinyQueue: React.FC<ScrutinyQueueProps> = ({
  applications,
  instruments,
  onApplicationUpdated,
  onSelectSessionForTesting,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [selectedAppForScrutiny, setSelectedAppForScrutiny] = useState<Application | null>(null);
  const [selectedAppForSchedule, setSelectedAppForSchedule] = useState<Application | null>(null);
  const [isScrutinyModalOpen, setIsScrutinyModalOpen] = useState(false);
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false);

  const filtered = applications.filter((app) => {
    const matchesSearch =
      app.application_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.applicant_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || app.current_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenScrutiny = (app: Application) => {
    setSelectedAppForScrutiny(app);
    setIsScrutinyModalOpen(true);
  };

  const handleOpenSchedule = (app: Application) => {
    setSelectedAppForSchedule(app);
    setIsSchedulerModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gov-navy">Departmental Scrutiny Queue</h3>
            <p className="text-xs text-slate-500">
              Scrutinize applications, raise deficiency queries, assess fees, and allocate inspection slots
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Pending Scrutiny: <strong className="text-gov-navy">{applications.filter(a => a.current_status === 'SUBMITTED' || a.current_status === 'QUERY_RESPONDED').length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-900 border border-amber-200">
            Active Queries: <strong className="text-amber-800">{applications.filter(a => a.current_status === 'QUERY_RAISED').length}</strong>
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by application number or applicant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-3 py-2 focus:ring-2 focus:ring-gov-blue"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue w-full sm:w-auto"
          >
            <option value="ALL">All Application States</option>
            <option value="SUBMITTED">Submitted (Pending Scrutiny)</option>
            <option value="QUERY_RAISED">Deficiency Query Raised</option>
            <option value="QUERY_RESPONDED">Query Responded</option>
            <option value="FEE_PENDING">Fee Assessment Pending</option>
            <option value="PAYMENT_RECONCILED">Paid & Ready to Schedule</option>
            <option value="SCHEDULED">Scheduled for Inspection</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Applications Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Application Details</th>
                <th className="py-3 px-4">Instrument Unit</th>
                <th className="py-3 px-4">Verification Type</th>
                <th className="py-3 px-4">Fee / Treasury Status</th>
                <th className="py-3 px-4">Current Status</th>
                <th className="py-3 px-4 text-right">Officer Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    No applications matching current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((app) => {
                  const inst = instruments.find((i) => i.instrument_id === app.instrument_id);
                  const isSubmittedOrQuery =
                    app.current_status === 'SUBMITTED' ||
                    app.current_status === 'QUERY_RESPONDED' ||
                    app.current_status === 'UNDER_SCRUTINY';

                  const isAcceptedOrFeePending =
                    app.current_status === 'ACCEPTED' ||
                    app.current_status === 'FEE_PENDING';

                  const isPaidReadyToSchedule =
                    app.current_status === 'PAYMENT_RECONCILED' ||
                    app.current_status === 'FEE_PAID' ||
                    (app.fee_assessment &&
                      (app.fee_assessment.payment_status === 'PAYMENT_RECONCILED' ||
                        app.fee_assessment.payment_status === 'SUCCESS') &&
                      app.current_status !== 'SCHEDULED' &&
                      app.current_status !== 'COMPLETED');

                  const isScheduled = app.current_status === 'SCHEDULED' || app.current_status === 'VERIFICATION_IN_PROGRESS';

                  return (
                    <tr key={app.application_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gov-navy font-mono">{app.application_number}</div>
                        <div className="text-[10px] text-slate-500">
                          Filed: {formatDateTime(app.created_at)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{inst?.model?.model_name || 'Counter Scale'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          SN: {inst?.serial_number} | Class: {inst?.model?.accuracy_class}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{app.application_type.replace(/_/g, ' ')}</div>
                        <div className="text-[10px] text-slate-500">{app.service_mode.replace(/_/g, ' ')}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {app.fee_assessment ? (
                          <div>
                            <div className="font-mono font-semibold text-slate-900">
                              {formatCurrency(app.fee_assessment.total_assessed_amount)}
                            </div>
                            <span className={`text-[10px] font-bold ${
                              app.fee_assessment.payment_status === 'PAYMENT_RECONCILED' ? 'text-emerald-700' : 'text-amber-700'
                            }`}>
                              {app.fee_assessment.payment_status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Not Assessed</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={app.current_status} size="sm" />
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isSubmittedOrQuery && (
                            <button
                              onClick={() => handleOpenScrutiny(app)}
                              className="px-2.5 py-1 rounded bg-gov-blue text-white hover:bg-blue-800 font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                            >
                              <FileCheck2 className="w-3 h-3" />
                              <span>Scrutinize</span>
                            </button>
                          )}

                          {(isAcceptedOrFeePending || isPaidReadyToSchedule) && !isScheduled && (
                            <button
                              onClick={() => handleOpenSchedule(app)}
                              className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                              title="Allocate verification slot and assign LMO inspector"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>Schedule Slot</span>
                            </button>
                          )}

                          {onSelectSessionForTesting && (
                            <button
                              onClick={() => onSelectSessionForTesting(app.application_id)}
                              className="px-2.5 py-1 rounded bg-slate-800 text-white hover:bg-slate-900 font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                              title="Launch NAWI test observation grid for this instrument"
                            >
                              <Scale className="w-3 h-3 text-amber-400" />
                              <span>Testing Grid</span>
                            </button>
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
        onScheduled={(updated) => {
          onApplicationUpdated();
          if (onSelectSessionForTesting && selectedAppForSchedule) {
            onSelectSessionForTesting(selectedAppForSchedule.application_id);
          }
        }}
      />
    </div>
  );
};
