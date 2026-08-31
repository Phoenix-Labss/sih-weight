import React, { useState } from 'react';
import { Instrument, InstrumentModel } from '../../types/instrument';
import { StatusBadge } from '../common/StatusBadge';
import { formatDate, maskSerialNumber } from '../../utils/formatters';
import { Scale, Plus, Search, Calendar, MapPin, Eye, FileText } from 'lucide-react';

interface InstrumentRegistryProps {
  instruments: Instrument[];
  models: InstrumentModel[];
  onOpenRegisterModal: () => void;
  onOpenApplyWizard: () => void;
  onViewCertificate?: (certificateId: string) => void;
}

export const InstrumentRegistry: React.FC<InstrumentRegistryProps> = ({
  instruments,
  onOpenRegisterModal,
  onOpenApplyWizard,
  onViewCertificate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = instruments.filter((inst) => {
    const matchesSearch =
      inst.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inst.model?.model_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inst.installation_location_notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || inst.current_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 text-gov-blue">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gov-navy">Registered Measuring Instruments</h3>
            <p className="text-xs text-slate-500">
              Statutory inventory of weighing & measuring instruments under Section 24
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenRegisterModal}
            className="px-3.5 py-2 rounded-lg bg-gov-navy text-xs font-semibold text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-card transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Register Instrument</span>
          </button>
          <button
            onClick={onOpenApplyWizard}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-card transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Apply for Verification</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-card">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by serial number, model, location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-3 py-2 focus:ring-2 focus:ring-gov-blue"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue w-full sm:w-auto"
          >
            <option value="ALL">All Lifecycle States</option>
            <option value="VERIFIED">Verified & Active</option>
            <option value="VERIFICATION_DUE">Verification Due</option>
            <option value="OVERDUE">Statutory Overdue</option>
            <option value="UNVERIFIED">Unverified / New</option>
            <option value="SEALED_OUT_OF_SERVICE">Sealed Out of Service</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-xs tracking-wider">
              <tr>
                <th className="py-3 px-4">Instrument Unit</th>
                <th className="py-3 px-4">Model & Pattern Ref</th>
                <th className="py-3 px-4">Technical Specs</th>
                <th className="py-3 px-4">Location / Premises</th>
                <th className="py-3 px-4">Verification Due</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    No matching instruments found.
                  </td>
                </tr>
              ) : (
                filtered.map((inst) => (
                  <tr key={inst.instrument_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 font-mono">{inst.serial_number}</div>
                      <div className="text-xs text-slate-400 font-mono">Token: {inst.public_instrument_token}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{inst.model?.model_name}</div>
                      <div className="text-xs text-slate-500">{inst.model?.model_approval_number}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">
                        {inst.model?.accuracy_class} | Max {inst.model?.max_capacity} {inst.model?.capacity_unit}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        e = {inst.model?.verification_scale_interval_e} {inst.model?.scale_interval_unit}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-700 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate max-w-xs">{inst.installation_location_notes || 'Registered Premises'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 font-medium text-slate-700">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatDate(inst.verification_due_date)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inst.current_status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {inst.latest_certificate_id && onViewCertificate ? (
                        <button
                          onClick={() => onViewCertificate(inst.latest_certificate_id!)}
                          className="px-2.5 py-1 rounded bg-blue-50 text-gov-blue hover:bg-blue-100 font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Cert</span>
                        </button>
                      ) : (
                        <button
                          onClick={onOpenApplyWizard}
                          className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Apply</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
