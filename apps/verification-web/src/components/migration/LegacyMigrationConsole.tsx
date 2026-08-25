import React, { useState } from 'react';

interface MigrationBatch {
  batchId: string;
  sourceRegister: string;
  totalRecords: number;
  importedRecords: number;
  conflictedRecords: number;
  status: string;
  uploadedAt: string;
}

const mockBatches: MigrationBatch[] = [
  {
    batchId: 'BATCH-2024-MH-01',
    sourceRegister: 'Pune_District_Verification_Register_2024.xlsx',
    totalRecords: 450,
    importedRecords: 442,
    conflictedRecords: 8,
    status: 'COMPLETED_WITH_ERRORS',
    uploadedAt: '2026-08-20',
  },
  {
    batchId: 'BATCH-2025-MH-04',
    sourceRegister: 'Mumbai_Suburban_Petrol_Dispensers_2025.csv',
    totalRecords: 180,
    importedRecords: 180,
    conflictedRecords: 0,
    status: 'COMPLETED',
    uploadedAt: '2026-08-22',
  },
];

export const LegacyMigrationConsole: React.FC = () => {
  const [batches] = useState<MigrationBatch[]>(mockBatches);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Historical Legacy Migration Console</h3>
          <p className="text-xs text-gray-500">Ingest, reconcile, and confidence-tag paper registers with cryptographic checksum verification</p>
        </div>
        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors">
          + Ingest New Legacy Batch
        </button>
      </div>

      {/* Batches Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Batch ID</th>
              <th className="px-4 py-3">Source Register / File</th>
              <th className="px-4 py-3">Total Rows</th>
              <th className="px-4 py-3">Successfully Imported</th>
              <th className="px-4 py-3">Conflicts</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batches.map((b) => (
              <tr key={b.batchId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium text-indigo-700">{b.batchId}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{b.sourceRegister}</td>
                <td className="px-4 py-3 text-gray-700">{b.totalRecords}</td>
                <td className="px-4 py-3 font-semibold text-emerald-600">{b.importedRecords}</td>
                <td className="px-4 py-3 font-semibold text-amber-600">{b.conflictedRecords}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{b.uploadedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
