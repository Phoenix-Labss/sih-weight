import React, { useState } from 'react';
import { PendencyTable } from './PendencyTable';
import { AuditTrailViewer } from './AuditTrailViewer';
import { useTranslation } from '../../i18n';

export interface SupervisorOverviewData {
  totalApplications: number;
  pendingScrutiny: number;
  pendingVerification: number;
  completedVerifications: number;
  totalRevenue: number;
  pendencyTiers: {
    tierLabel: string;
    count: number;
    percentage: number;
  }[];
  officers: {
    name: string;
    jurisdiction: string;
    completed: number;
    avgTurnaroundDays: number;
    rejections: number;
  }[];
}

const mockSupervisorData: SupervisorOverviewData = {
  totalApplications: 142,
  pendingScrutiny: 18,
  pendingVerification: 29,
  completedVerifications: 95,
  totalRevenue: 348500,
  pendencyTiers: [
    { tierLabel: '< 7 Days', count: 28, percentage: 59.6 },
    { tierLabel: '7 - 15 Days', count: 12, percentage: 25.5 },
    { tierLabel: '15 - 30 Days', count: 5, percentage: 10.6 },
    { tierLabel: '> 30 Days', count: 2, percentage: 4.3 },
  ],
  officers: [
    { name: 'Dr. Ramesh Kumar (LMO)', jurisdiction: 'Central Zone', completed: 48, avgTurnaroundDays: 2.1, rejections: 2 },
    { name: 'Priya Sharma (LMO)', jurisdiction: 'North District', completed: 34, avgTurnaroundDays: 2.8, rejections: 1 },
    { name: 'Apex Metrology Lab (GATC)', jurisdiction: 'Industrial Zone', completed: 13, avgTurnaroundDays: 1.5, rejections: 0 },
  ],
};

export const SupervisorDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'pendency' | 'officers' | 'audit'>('overview');
  const data = mockSupervisorData;

  return (
    <div className="space-y-6">
      {/* Header & Sub-nav */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t.supervisorTitle}</h2>
          <p className="text-sm text-gray-500">{t.supervisorSubtitle}</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'overview' ? 'bg-white text-gov-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.tabOverview}
          </button>
          <button
            onClick={() => setActiveTab('pendency')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'pendency' ? 'bg-white text-gov-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.pendencyAnalysisTitle}
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'audit' ? 'bg-white text-gov-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.auditTrailTitle}
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Applications</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{data.totalApplications}</div>
              <div className="mt-2 text-xs text-green-600 font-medium">95 Finalized & Certified</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Pending Scrutiny</div>
              <div className="mt-2 text-3xl font-bold text-amber-700">{data.pendingScrutiny}</div>
              <div className="mt-2 text-xs text-gray-500">Awaiting officer initial review</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-xs font-semibold text-gov-blue uppercase tracking-wider">Pending Verification</div>
              <div className="mt-2 text-3xl font-bold text-gov-blue">{data.pendingVerification}</div>
              <div className="mt-2 text-xs text-gray-500">Scheduled / Test in progress</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Reconciled Revenue</div>
              <div className="mt-2 text-3xl font-bold text-emerald-700">₹{data.totalRevenue.toLocaleString('en-IN')}</div>
              <div className="mt-2 text-xs text-gray-500">Schedule XII Treasury Receipts</div>
            </div>
          </div>

          {/* SLA Pendency Bar Overview */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Statutory SLA Pendency Distribution</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {data.pendencyTiers.map((tier) => (
                <div key={tier.tierLabel} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="text-sm font-semibold text-gray-700">{tier.tierLabel}</div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">{tier.count}</div>
                  <div className="text-xs text-gray-500 mt-1">{tier.percentage}% of active backlog</div>
                </div>
              ))}
            </div>
          </div>

          {/* Officer Workload Breakdown */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Officer Throughput & Turnaround SLA</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Officer / GATC Centre</th>
                    <th className="px-4 py-3">Jurisdiction</th>
                    <th className="px-4 py-3">Completed Sessions</th>
                    <th className="px-4 py-3">Avg. Turnaround</th>
                    <th className="px-4 py-3">Rejections</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.officers.map((off) => (
                    <tr key={off.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{off.name}</td>
                      <td className="px-4 py-3 text-gray-600">{off.jurisdiction}</td>
                      <td className="px-4 py-3 font-semibold text-gov-blue">{off.completed}</td>
                      <td className="px-4 py-3 text-gray-700">{off.avgTurnaroundDays} days</td>
                      <td className="px-4 py-3 text-red-600">{off.rejections}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pendency' && <PendencyTable />}
      {activeTab === 'audit' && <AuditTrailViewer />}
    </div>
  );
};
