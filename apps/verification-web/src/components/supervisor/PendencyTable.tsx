import React, { useState } from 'react';

interface PendencyItem {
  applicationId: string;
  applicationNumber: string;
  applicantName: string;
  instrumentCategory: string;
  daysPending: number;
  currentStage: string;
  assignedOfficer: string;
  slaStatus: 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
}

const mockPendencyItems: PendencyItem[] = [
  {
    applicationId: 'app-001',
    applicationNumber: 'APP-MH-2026-00412',
    applicantName: 'Reliance Retail Ltd (Store #42)',
    instrumentCategory: 'NAWI Class III (30kg)',
    daysPending: 18,
    currentStage: 'Under Scrutiny',
    assignedOfficer: 'Dr. Ramesh Kumar (LMO)',
    slaStatus: 'AT_RISK',
  },
  {
    applicationId: 'app-002',
    applicationNumber: 'APP-MH-2026-00399',
    applicantName: 'Bharat Petroleum Dispenser Unit #3',
    instrumentCategory: 'Liquid Fuel Dispenser (50L/min)',
    daysPending: 34,
    currentStage: 'Pending Verification Slot',
    assignedOfficer: 'Priya Sharma (LMO)',
    slaStatus: 'BREACHED',
  },
  {
    applicationId: 'app-003',
    applicationNumber: 'APP-MH-2026-00445',
    applicantName: 'Tanishq Jewelers Main Branch',
    instrumentCategory: 'NAWI Class II High Precision (600g)',
    daysPending: 4,
    currentStage: 'Fee Paid - Ready to Schedule',
    assignedOfficer: 'Apex Metrology Lab (GATC)',
    slaStatus: 'ON_TRACK',
  },
  {
    applicationId: 'app-004',
    applicationNumber: 'APP-MH-2026-00450',
    applicantName: 'Kalyan Jewellers Precision Balances',
    instrumentCategory: 'NAWI Class I Micro-balance (200g)',
    daysPending: 2,
    currentStage: 'Under Scrutiny',
    assignedOfficer: 'Dr. Ramesh Kumar (LMO)',
    slaStatus: 'ON_TRACK',
  },
];

export const PendencyTable: React.FC = () => {
  const [filterSla, setFilterSla] = useState<string>('ALL');

  const filtered = mockPendencyItems.filter((item) => {
    if (filterSla === 'ALL') return true;
    return item.slaStatus === filterSla;
  });

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-lg font-bold text-gray-900">Application Pendency & Statutory SLA Tracker</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Filter SLA:</span>
          <select
            value={filterSla}
            onChange={(e) => setFilterSla(e.target.value)}
            className="text-xs font-medium border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700"
          >
            <option value="ALL">All Applications</option>
            <option value="ON_TRACK">On Track (&lt; 7 Days)</option>
            <option value="AT_RISK">At Risk (15-30 Days)</option>
            <option value="BREACHED">Breached (&gt; 30 Days)</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">App Number</th>
              <th className="px-4 py-3">Applicant / Trader</th>
              <th className="px-4 py-3">Instrument Category</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Current Stage</th>
              <th className="px-4 py-3">Assigned Officer</th>
              <th className="px-4 py-3">SLA Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((item) => {
              let badgeColor = 'bg-green-50 text-green-700 border-green-200';
              if (item.slaStatus === 'AT_RISK') badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
              if (item.slaStatus === 'BREACHED') badgeColor = 'bg-red-50 text-red-700 border-red-200';

              return (
                <tr key={item.applicationId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gov-blue">{item.applicationNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.applicantName}</td>
                  <td className="px-4 py-3 text-gray-600">{item.instrumentCategory}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{item.daysPending} days</td>
                  <td className="px-4 py-3 text-gray-700">{item.currentStage}</td>
                  <td className="px-4 py-3 text-gray-600">{item.assignedOfficer}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badgeColor}`}>
                      {item.slaStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
