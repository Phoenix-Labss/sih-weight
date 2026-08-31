import React, { useState } from 'react';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  ipAddress: string;
  details: string;
}

const mockAuditLogs: AuditEntry[] = [
  {
    id: 'audit-001',
    timestamp: '2026-08-23 18:45:12 UTC',
    action: 'CERTIFICATE_SIGNED',
    entityType: 'CERTIFICATE',
    entityId: 'cert-8891-2026',
    performedBy: 'Dr. Ramesh Kumar (LMO Central)',
    ipAddress: '10.24.112.5',
    details: 'Ed25519 DSC applied with SHA-256 payload digest.',
  },
  {
    id: 'audit-002',
    timestamp: '2026-08-23 18:40:05 UTC',
    action: 'DISPOSITION_FINALIZED',
    entityType: 'VERIFICATION_SESSION',
    entityId: 'sess-4412-2026',
    performedBy: 'Dr. Ramesh Kumar (LMO Central)',
    ipAddress: '10.24.112.5',
    details: 'Outcome PASSED recorded. 5-point eccentricity and stepped MPE verified.',
  },
  {
    id: 'audit-003',
    timestamp: '2026-08-23 18:15:30 UTC',
    action: 'STANDARD_QUARANTINED',
    entityType: 'REFERENCE_STANDARD',
    entityId: 'STD-M1-50KG-004',
    performedBy: 'Controller Metrology (Admin)',
    ipAddress: '10.24.100.1',
    details: 'Standard quarantined due to recalibration tolerance deviation. Impact review opened.',
  },
  {
    id: 'audit-004',
    timestamp: '2026-08-23 17:30:22 UTC',
    action: 'LEGACY_BATCH_IMPORTED',
    entityType: 'MIGRATION_BATCH',
    entityId: 'BATCH-REG-2024-MH',
    performedBy: 'Admin (State Cell)',
    ipAddress: '10.24.100.1',
    details: '240 historical register rows imported. 235 VERIFIED_LEGACY, 5 CONFLICTED.',
  },
];

export const AuditTrailViewer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = mockAuditLogs.filter((log) =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.performedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entityId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Privileged Action & Security Audit Trail</h3>
          <p className="text-xs text-gray-500">Immutable, append-only logs for statutory and compliance oversight</p>
        </div>
        <input
          type="text"
          placeholder="Search by action, officer, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="text-xs px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gov-blue w-full sm:w-64"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target Entity</th>
              <th className="px-4 py-3">Performed By</th>
              <th className="px-4 py-3">IP Address</th>
              <th className="px-4 py-3">Details / Audit Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono text-xs">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{log.timestamp}</td>
                <td className="px-4 py-3 font-semibold text-gov-blue">{log.action}</td>
                <td className="px-4 py-3 text-gray-800">{log.entityType} ({log.entityId})</td>
                <td className="px-4 py-3 text-gray-900 font-sans">{log.performedBy}</td>
                <td className="px-4 py-3 text-gray-500">{log.ipAddress}</td>
                <td className="px-4 py-3 text-gray-700 font-sans">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
