import React, { useState } from 'react';

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

const mockGATCCentres: GATCCentre[] = [
  {
    gatcId: 'gatc-001',
    facilityName: 'Apex Metrology Calibration Lab Pvt Ltd',
    approvalOrderNumber: 'GATC/MH/2024/014',
    validFrom: '2024-01-01',
    validTo: '2027-12-31',
    maxCapacityKg: 50000,
    approvedClasses: ['Class III', 'Class IIII'],
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

export const GATCManagement: React.FC = () => {
  const [centres] = useState<GATCCentre[]>(mockGATCCentres);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Government Approved Test Centres (GATC)</h3>
          <p className="text-xs text-gray-500">Statutory scope, accreditation order, and capacity limitations under GATC Rules, 2013</p>
        </div>
        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors">
          + Register GATC Centre
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {centres.map((centre) => (
          <div key={centre.gatcId} className="border border-gray-200 rounded-xl p-5 hover:border-indigo-300 transition-colors space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-gray-900 text-base">{centre.facilityName}</h4>
                <p className="text-xs text-gray-500 font-mono mt-0.5">Order: {centre.approvalOrderNumber}</p>
              </div>
              <span className="px-2.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
                {centre.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
              <div>
                <span className="text-gray-500 block">Accreditation Validity:</span>
                <span className="font-semibold text-gray-800">{centre.validFrom} to {centre.validTo}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Max Approved Capacity:</span>
                <span className="font-semibold text-gray-800">{centre.maxCapacityKg.toLocaleString()} kg</span>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-xs text-gray-500 block mb-1">Approved Accuracy Classes:</span>
              <div className="flex gap-1.5">
                {centre.approvedClasses.map((cls) => (
                  <span key={cls} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                    {cls}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
