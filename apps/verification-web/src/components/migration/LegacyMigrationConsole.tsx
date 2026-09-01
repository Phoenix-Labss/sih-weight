import React, { useState } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { Modal } from '../common/Modal';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
  Search,
  Eye,
  RefreshCw,
  Database,
  Lock,
} from 'lucide-react';

export interface MigrationRecord {
  recordId: string;
  traderName: string;
  instrumentCategory: string;
  serialNumber: string;
  modelApprovalNumber: string;
  lastVerificationDate: string;
  physicalSealNumber: string;
  trustStatus: 'VERIFIED_LEGACY' | 'DIGITIZED_FROM_SOURCE' | 'UNVERIFIED_LEGACY' | 'CONFLICTED';
  conflictReason?: string;
  resolvedAction?: 'MERGED' | 'NEW_UUID' | 'DISCARDED';
}

export interface MigrationBatch {
  batchId: string;
  sourceRegister: string;
  jurisdiction: string;
  totalRecords: number;
  importedRecords: number;
  conflictedRecords: number;
  status: 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'PARSING' | 'COMMITTED';
  uploadedAt: string;
  manifestSha256: string;
  records: MigrationRecord[];
}

const initialBatches: MigrationBatch[] = [
  {
    batchId: 'BATCH-2026-DL-01',
    sourceRegister: 'Delhi_Central_Market_Scales_2024.xlsx',
    jurisdiction: 'Central Delhi Zone (JUR-DL-01)',
    totalRecords: 240,
    importedRecords: 232,
    conflictedRecords: 8,
    status: 'COMPLETED_WITH_ERRORS',
    uploadedAt: '2026-08-20',
    manifestSha256: '9f8a7c2b4e1d0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a',
    records: [
      {
        recordId: 'REC-DL-001',
        traderName: 'Gupta Kirana Stores, Chandni Chowk',
        instrumentCategory: 'NAWI Class III Commercial Counter Scale (30 kg)',
        serialNumber: 'SN-DELHI-2022-8812',
        modelApprovalNumber: 'IND/09/2021/412',
        lastVerificationDate: '2024-03-15',
        physicalSealNumber: 'SEAL-DL-2024-9912',
        trustStatus: 'VERIFIED_LEGACY',
      },
      {
        recordId: 'REC-DL-002',
        traderName: 'Aggarwal Sweets & Namkeen, Daryaganj',
        instrumentCategory: 'NAWI Class III Commercial Counter Scale (15 kg)',
        serialNumber: 'SN-DELHI-2022-8812',
        modelApprovalNumber: 'IND/09/2021/412',
        lastVerificationDate: '2024-02-10',
        physicalSealNumber: 'SEAL-DL-2024-3312',
        trustStatus: 'CONFLICTED',
        conflictReason: 'Duplicate serial number detected with REC-DL-001 in same district.',
      },
      {
        recordId: 'REC-DL-003',
        traderName: 'Khanna Jewelers, Karol Bagh',
        instrumentCategory: 'NAWI Class II High Precision Carat Balance (600 g)',
        serialNumber: 'SN-KB-2023-0091',
        modelApprovalNumber: 'IND/09/2022/108',
        lastVerificationDate: '2024-05-18',
        physicalSealNumber: 'SEAL-DL-2024-4419',
        trustStatus: 'VERIFIED_LEGACY',
      },
      {
        recordId: 'REC-DL-004',
        traderName: 'Shri Ram Flour Mills & Grain Depot',
        instrumentCategory: 'NAWI Class III Heavy Platform Scale (500 kg)',
        serialNumber: 'SN-PF-2020-5541',
        modelApprovalNumber: 'IND/09/2019/882',
        lastVerificationDate: '2023-11-20',
        physicalSealNumber: 'SEAL-DL-2023-1082',
        trustStatus: 'UNVERIFIED_LEGACY',
        conflictReason: 'Historical fee challan receipt number faded on scanned register.',
      },
      {
        recordId: 'REC-DL-005',
        traderName: 'Star Departmental Store, Connaught Place',
        instrumentCategory: 'NAWI Class III Electronic Counter Scale (30 kg)',
        serialNumber: 'SN-CP-2024-1102',
        modelApprovalNumber: 'IND/09/2023/505',
        lastVerificationDate: '2024-06-01',
        physicalSealNumber: 'SEAL-DL-2024-7721',
        trustStatus: 'DIGITIZED_FROM_SOURCE',
      },
    ],
  },
  {
    batchId: 'BATCH-2026-MH-04',
    sourceRegister: 'Mumbai_Suburban_Petrol_Dispensers_2025.csv',
    jurisdiction: 'Mumbai Suburban District (JUR-MH-02)',
    totalRecords: 180,
    importedRecords: 180,
    conflictedRecords: 0,
    status: 'COMPLETED',
    uploadedAt: '2026-08-22',
    manifestSha256: '4e1d0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a9f8a7c2b',
    records: [
      {
        recordId: 'REC-MH-001',
        traderName: 'Bharat Petroleum RO #44, Andheri East',
        instrumentCategory: 'Liquid Petroleum Multi-Product Dispenser (50 L/min)',
        serialNumber: 'SN-BPC-2023-441',
        modelApprovalNumber: 'IND/09/2020/301',
        lastVerificationDate: '2025-01-15',
        physicalSealNumber: 'SEAL-MH-2025-0012',
        trustStatus: 'VERIFIED_LEGACY',
      },
      {
        recordId: 'REC-MH-002',
        traderName: 'Hindustan Petroleum Outlet, Bandra West',
        instrumentCategory: 'Liquid Petroleum High-Flow Dispenser (80 L/min)',
        serialNumber: 'SN-HPC-2023-882',
        modelApprovalNumber: 'IND/09/2020/301',
        lastVerificationDate: '2025-01-20',
        physicalSealNumber: 'SEAL-MH-2025-0089',
        trustStatus: 'VERIFIED_LEGACY',
      },
    ],
  },
];

export const LegacyMigrationConsole: React.FC = () => {
  const { notify } = useNotification();
  const [batches, setBatches] = useState<MigrationBatch[]>(initialBatches);

  // Ingestion Modal State
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('Central Delhi Zone (JUR-DL-01)');
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);

  // Batch Detail & Conflict Resolution Drawer State
  const [selectedBatch, setSelectedBatch] = useState<MigrationBatch | null>(null);
  const [isBatchDetailOpen, setIsBatchDetailOpen] = useState(false);
  const [recordFilter, setRecordFilter] = useState<string>('ALL');
  const [searchRecord, setSearchRecord] = useState<string>('');

  const handleOpenIngestModal = () => {
    setSelectedFileName('');
    setIsParsing(false);
    setParseProgress(0);
    setIsIngestModalOpen(true);
  };

  const handleStartParsing = () => {
    if (!selectedFileName) {
      notify('error', 'Validation Error', 'Please select or upload a register file to ingest.');
      return;
    }

    setIsParsing(true);
    setParseProgress(15);

    const interval = setInterval(() => {
      setParseProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          setTimeout(() => {
            setIsParsing(false);
            const newBatchId = `BATCH-${new Date().getFullYear()}-DL-0${batches.length + 1}`;
            const newBatch: MigrationBatch = {
              batchId: newBatchId,
              sourceRegister: selectedFileName,
              jurisdiction: selectedJurisdiction,
              totalRecords: 120,
              importedRecords: 114,
              conflictedRecords: 6,
              status: 'COMPLETED_WITH_ERRORS',
              uploadedAt: new Date().toISOString().split('T')[0],
              manifestSha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
              records: [
                {
                  recordId: `REC-GEN-001`,
                  traderName: 'National Provision Stores, Old Delhi',
                  instrumentCategory: 'NAWI Class III Commercial Counter Scale (30 kg)',
                  serialNumber: 'SN-OD-2023-9912',
                  modelApprovalNumber: 'IND/09/2021/412',
                  lastVerificationDate: '2024-04-12',
                  physicalSealNumber: 'SEAL-DL-2024-1182',
                  trustStatus: 'VERIFIED_LEGACY',
                },
                {
                  recordId: `REC-GEN-002`,
                  traderName: 'Verma Jewellers & Bullion Merchants',
                  instrumentCategory: 'NAWI Class II Precision Bullion Balance (1 kg)',
                  serialNumber: 'SN-OD-2023-9912',
                  modelApprovalNumber: 'IND/09/2022/108',
                  lastVerificationDate: '2024-04-15',
                  physicalSealNumber: 'SEAL-DL-2024-9901',
                  trustStatus: 'CONFLICTED',
                  conflictReason: 'Duplicate serial number with REC-GEN-001 under different capacity model.',
                },
                {
                  recordId: `REC-GEN-003`,
                  traderName: 'Delhi Central APMC Mandi Weighbridge',
                  instrumentCategory: 'NAWI Class IIII Heavy Truck Weighbridge (50 Tonne)',
                  serialNumber: 'SN-WB-2021-004',
                  modelApprovalNumber: 'IND/09/2020/881',
                  lastVerificationDate: '2024-01-20',
                  physicalSealNumber: 'SEAL-DL-2024-0044',
                  trustStatus: 'VERIFIED_LEGACY',
                },
                {
                  recordId: `REC-GEN-004`,
                  traderName: 'Modern Dairy Collection Centre #8',
                  instrumentCategory: 'NAWI Class III AMCU Milk Scale (100 kg)',
                  serialNumber: 'SN-DY-2023-412',
                  modelApprovalNumber: 'IND/09/2023/112',
                  lastVerificationDate: '2024-02-18',
                  physicalSealNumber: 'SEAL-DL-2024-5512',
                  trustStatus: 'DIGITIZED_FROM_SOURCE',
                },
              ],
            };

            setBatches([newBatch, ...batches]);
            setIsIngestModalOpen(false);
            notify(
              'success',
              'Legacy Register Ingested',
              `Batch ${newBatchId} parsed successfully with 114 verified rows and 6 flagged conflicts.`
            );
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  const handleResolveRecord = (batchId: string, recordId: string, action: 'MERGED' | 'NEW_UUID' | 'DISCARDED') => {
    setBatches((prevBatches) =>
      prevBatches.map((b) => {
        if (b.batchId !== batchId) return b;
        const updatedRecords = b.records.map((r) => {
          if (r.recordId !== recordId) return r;
          return {
            ...r,
            trustStatus: action === 'DISCARDED' ? ('UNVERIFIED_LEGACY' as const) : ('VERIFIED_LEGACY' as const),
            resolvedAction: action,
            conflictReason: undefined,
          };
        });
        const remainingConflicts = updatedRecords.filter((r) => r.trustStatus === 'CONFLICTED').length;
        const updatedBatch = {
          ...b,
          conflictedRecords: remainingConflicts,
          importedRecords: b.totalRecords - remainingConflicts,
          status: remainingConflicts === 0 ? ('COMPLETED' as const) : ('COMPLETED_WITH_ERRORS' as const),
          records: updatedRecords,
        };
        if (selectedBatch && selectedBatch.batchId === batchId) {
          setSelectedBatch(updatedBatch);
        }
        return updatedBatch;
      })
    );

    notify(
      'success',
      'Conflict Resolved',
      `Record ${recordId} resolved via action: ${action}.`
    );
  };

  const handleCommitLedger = (batch: MigrationBatch) => {
    setBatches((prev) =>
      prev.map((b) => (b.batchId === batch.batchId ? { ...b, status: 'COMMITTED' } : b))
    );
    if (selectedBatch && selectedBatch.batchId === batch.batchId) {
      setSelectedBatch({ ...selectedBatch, status: 'COMMITTED' });
    }
    notify(
      'success',
      'Committed to Authoritative Ledger',
      `Batch ${batch.batchId} successfully committed to National Registry with SHA-256 manifest: ${batch.manifestSha256.slice(0, 16)}...`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-card">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-50 text-gov-blue">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gov-navy">Historical Legacy Migration Console</h2>
            <p className="text-xs text-slate-500">
              Section 24 Historical Register OCR Ingestion, 4-Tier Provenance Trust Tagging &amp; Ledger Reconciliation
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenIngestModal}
          className="px-4 py-2.5 bg-gov-blue hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>+ Ingest New Legacy Batch</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Migrated Batches</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900">{batches.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Across Delhi &amp; Maharashtra UTs</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Digitized Records</div>
          <div className="mt-1.5 text-2xl font-bold text-emerald-700">
            {batches.reduce((sum, b) => sum + b.importedRecords, 0)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 font-medium">97.8% Provenance Verified</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Flagged Conflicts</div>
          <div className="mt-1.5 text-2xl font-bold text-amber-700">
            {batches.reduce((sum, b) => sum + b.conflictedRecords, 0)}
          </div>
          <div className="text-[11px] text-amber-600 mt-1">Awaiting clerk/officer resolution</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Cryptographic Parity</div>
          <div className="mt-1.5 text-2xl font-bold text-indigo-700">100%</div>
          <div className="text-[11px] text-indigo-600 mt-1">SHA-256 Manifest Hashed</div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gov-blue" />
            <h3 className="text-sm font-bold text-gov-navy">Registered Paper Migration Batches</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">{batches.length} Batches Processed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-100/70 text-left font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Batch ID</th>
                <th className="px-4 py-3">Source Register / File</th>
                <th className="px-4 py-3">Jurisdiction</th>
                <th className="px-4 py-3 text-center">Total Rows</th>
                <th className="px-4 py-3 text-center">Verified</th>
                <th className="px-4 py-3 text-center">Conflicts</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => (
                <tr key={b.batchId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-gov-blue">{b.batchId}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{b.sourceRegister}</td>
                  <td className="px-4 py-3 text-slate-600">{b.jurisdiction}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">{b.totalRecords}</td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-700">{b.importedRecords}</td>
                  <td className="px-4 py-3 text-center font-bold text-amber-700">
                    {b.conflictedRecords > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        {b.conflictedRecords} Conflicts
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        b.status === 'COMMITTED'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : b.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {b.status === 'COMMITTED' && <Lock className="w-3 h-3" />}
                      {b.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                      {b.status === 'COMPLETED_WITH_ERRORS' && <AlertTriangle className="w-3 h-3" />}
                      <span>{b.status.replace(/_/g, ' ')}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-[11px]">{b.uploadedAt}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedBatch(b);
                        setIsBatchDetailOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:border-gov-blue text-gov-blue font-bold text-xs flex items-center gap-1.5 ml-auto transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect &amp; Resolve</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL 1: Ingest New Legacy Batch Modal ── */}
      <Modal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        title="Ingest Historical Physical Register Batch"
        subtitle="Upload scanned or digitized register spreadsheets (.csv, .xlsx) for cryptographic OCR ingestion"
        maxWidth="2xl"
      >
        <div className="space-y-5">
          {/* Sample dataset pickers */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Quick Select Sample Historical Register Dataset:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedFileName('Delhi_Central_Market_Scales_2024.xlsx')}
                className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                  selectedFileName === 'Delhi_Central_Market_Scales_2024.xlsx'
                    ? 'border-gov-blue bg-blue-50/60 ring-2 ring-gov-blue/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-slate-900">Delhi Karol Bagh Retail Scales 2024</div>
                <div className="text-[11px] text-slate-500 mt-0.5">240 Class III &amp; II Commercial Units (.xlsx)</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFileName('Maharashtra_Industrial_Weighbridges_2024.csv')}
                className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                  selectedFileName === 'Maharashtra_Industrial_Weighbridges_2024.csv'
                    ? 'border-gov-blue bg-blue-50/60 ring-2 ring-gov-blue/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-slate-900">Mumbai Heavy Weighbridges 2024</div>
                <div className="text-[11px] text-slate-500 mt-0.5">180 Class IIII Heavy Units (.csv)</div>
              </button>
            </div>
          </div>

          {/* Target Jurisdiction */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target State / District Jurisdiction *
            </label>
            <select
              value={selectedJurisdiction}
              onChange={(e) => setSelectedJurisdiction(e.target.value)}
              className="w-full text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2.5 bg-white focus:ring-2 focus:ring-gov-blue"
            >
              <option value="Central Delhi Zone (JUR-DL-01)">Central Delhi Zone (JUR-DL-01)</option>
              <option value="North Delhi District (JUR-DL-02)">North Delhi District (JUR-DL-02)</option>
              <option value="Mumbai Suburban District (JUR-MH-02)">Mumbai Suburban District (JUR-MH-02)</option>
              <option value="Pune Industrial Zone (JUR-MH-05)">Pune Industrial Zone (JUR-MH-05)</option>
            </select>
          </div>

          {/* Drag & Drop File Zone */}
          <div className="border-2 border-dashed border-slate-300 hover:border-gov-blue rounded-xl p-6 text-center bg-slate-50/50 transition-colors">
            <Upload className="w-8 h-8 text-gov-blue mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-800">
              {selectedFileName ? (
                <span className="text-gov-blue font-mono font-bold text-sm">{selectedFileName}</span>
              ) : (
                'Drag and drop historical register file here, or click to browse'
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Supports XLSX, CSV, and structured OCR register scans</p>
          </div>

          {/* Parsing Progress Bar */}
          {isParsing && (
            <div className="space-y-2 bg-blue-50 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between text-xs font-bold text-gov-blue">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Running OCR Schema Validation &amp; Duplicate Probes...
                </span>
                <span>{parseProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gov-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${parseProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsIngestModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isParsing || !selectedFileName}
              onClick={handleStartParsing}
              className="px-5 py-2 rounded-lg bg-gov-blue text-xs font-bold text-white hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isParsing ? 'Parsing Rows...' : 'Ingest & Validate Batch'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 2: Batch Inspection & Conflict Resolution Modal ── */}
      {selectedBatch && (
        <Modal
          isOpen={isBatchDetailOpen}
          onClose={() => setIsBatchDetailOpen(false)}
          title={`Batch Audit: ${selectedBatch.batchId}`}
          subtitle={`Source: ${selectedBatch.sourceRegister} • Jurisdiction: ${selectedBatch.jurisdiction}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* Manifest Integrity Strip */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-slate-500 font-semibold block">Cryptographic Manifest SHA-256 Digest:</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px] truncate block">
                    {selectedBatch.manifestSha256}
                  </span>
                </div>
              </div>

              {selectedBatch.status !== 'COMMITTED' ? (
                <button
                  type="button"
                  onClick={() => handleCommitLedger(selectedBatch)}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Commit Batch to Authoritative Ledger</span>
                </button>
              ) : (
                <span className="px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-xs flex items-center gap-1 shrink-0">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Committed to Ledger</span>
                </span>
              )}
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search records by trader, serial number, seal number..."
                  value={searchRecord}
                  onChange={(e) => setSearchRecord(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 focus:ring-2 focus:ring-gov-blue"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Trust Level:</span>
                <select
                  value={recordFilter}
                  onChange={(e) => setRecordFilter(e.target.value)}
                  className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:ring-2 focus:ring-gov-blue"
                >
                  <option value="ALL">All Records ({selectedBatch.records.length})</option>
                  <option value="CONFLICTED">Flagged Conflicts</option>
                  <option value="VERIFIED_LEGACY">Verified Legacy</option>
                  <option value="DIGITIZED_FROM_SOURCE">Digitized From Source</option>
                  <option value="UNVERIFIED_LEGACY">Unverified Legacy</option>
                </select>
              </div>
            </div>

            {/* Records List */}
            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {selectedBatch.records
                .filter((r) => {
                  const matchSearch =
                    r.traderName.toLowerCase().includes(searchRecord.toLowerCase()) ||
                    r.serialNumber.toLowerCase().includes(searchRecord.toLowerCase()) ||
                    r.physicalSealNumber.toLowerCase().includes(searchRecord.toLowerCase());
                  const matchFilter = recordFilter === 'ALL' || r.trustStatus === recordFilter;
                  return matchSearch && matchFilter;
                })
                .map((record) => {
                  let trustBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  if (record.trustStatus === 'CONFLICTED') trustBadge = 'bg-rose-50 text-rose-800 border-rose-300';
                  if (record.trustStatus === 'UNVERIFIED_LEGACY') trustBadge = 'bg-amber-50 text-amber-800 border-amber-300';
                  if (record.trustStatus === 'DIGITIZED_FROM_SOURCE') trustBadge = 'bg-blue-50 text-blue-800 border-blue-200';

                  return (
                    <div
                      key={record.recordId}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        record.trustStatus === 'CONFLICTED'
                          ? 'bg-rose-50/40 border-rose-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-500">{record.recordId}</span>
                          <strong className="text-slate-900 font-bold">{record.traderName}</strong>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${trustBadge}`}>
                          {record.trustStatus.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
                          <span className="font-semibold text-slate-800 truncate block">{record.instrumentCategory}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Serial No</span>
                          <span className="font-mono font-bold text-slate-800">{record.serialNumber}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Physical Seal</span>
                          <span className="font-mono font-bold text-gov-blue">{record.physicalSealNumber}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Last Stamped</span>
                          <span className="font-semibold text-slate-800">{record.lastVerificationDate}</span>
                        </div>
                      </div>

                      {/* Conflict details & Resolution Actions */}
                      {record.conflictReason && (
                        <div className="mt-2 p-2.5 rounded-lg bg-rose-100/70 border border-rose-300 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                            <span>{record.conflictReason}</span>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleResolveRecord(selectedBatch.batchId, record.recordId, 'MERGED')}
                              className="px-2 py-1 rounded bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Merge Record
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveRecord(selectedBatch.batchId, record.recordId, 'NEW_UUID')}
                              className="px-2 py-1 rounded bg-gov-blue text-white hover:bg-blue-800 font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Issue New UUID
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsBatchDetailOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
