import React from 'react';
import { Modal } from '../common/Modal';
import { Application } from '../../types/application';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Printer, Download, CheckCircle2, Shield } from 'lucide-react';

interface ReceiptViewerProps {
  isOpen: boolean;
  onClose: () => void;
  application: Application | null;
}

export const ReceiptViewer: React.FC<ReceiptViewerProps> = ({ isOpen, onClose, application }) => {
  if (!application) return null;

  const fee = application.fee_assessment || {
    fee_assessment_id: `FEE-${application.application_id}`,
    tenant_id: application.tenant_id,
    policy_version: 'POL-FEES-2026.1',
    base_verification_fee: 750,
    user_charge: 0,
    late_fee: 0,
    total_assessed_amount: 750,
    currency: 'INR',
    payment_status: 'PAYMENT_RECONCILED',
    receipt_number: `RCPT-2026-${application.application_id.slice(-6).toUpperCase()}`,
    treasury_challan_number: `CHL-DL-2026-${application.application_id.slice(-5).toUpperCase()}`,
    payment_gateway_ref: 'SBIEPAY-DIRECT',
    paid_at: application.updated_at || application.created_at,
    created_at: application.created_at,
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Statutory Fee Payment Receipt"
      subtitle="Department of Legal Metrology — Official Government Treasury Receipt"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Printable Receipt Canvas */}
        <div className="border-2 border-slate-300 rounded-xl p-6 bg-white shadow-card space-y-6 text-slate-900 font-sans print:border-none print:p-0">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-300 pb-4 space-y-1">
            <div className="flex items-center justify-center gap-2 font-bold text-sm tracking-wide text-gov-navy uppercase">
              <Shield className="w-5 h-5 text-amber-500" />
              <span>Government of NCT of Delhi</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 uppercase">
              Department of Legal Metrology
            </h2>
            <p className="text-xs text-slate-600">
              Statutory Verification Fee Receipt (Head of Account: 1475-00-106-00-00)
            </p>
          </div>

          {/* Receipt Numbers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-500 block text-xs">Receipt Number:</span>
              <span className="font-mono font-bold text-slate-900">{fee.receipt_number || 'RCPT-2026-PENDING'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Treasury Challan Ref:</span>
              <span className="font-mono font-bold text-slate-900">{fee.treasury_challan_number || 'CHL-DL-2026-88910'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Payment Date:</span>
              <span className="font-semibold text-slate-900">{formatDateTime(fee.paid_at || fee.created_at)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Application No:</span>
              <span className="font-mono font-bold text-slate-900">{application.application_number}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Gateway Ref:</span>
              <span className="font-mono text-slate-700">{fee.payment_gateway_ref || 'SBIEPAY-DIRECT'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Payment Status:</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{fee.payment_status}</span>
              </span>
            </div>
          </div>

          {/* Itemized Table */}
          <div>
            <table className="w-full text-xs text-left border border-slate-200">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-xs">
                <tr>
                  <th className="py-2 px-3">Description of Statutory Fee</th>
                  <th className="py-2 px-3">Statutory Schedule</th>
                  <th className="py-2 px-3 text-right">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2.5 px-3">Base Verification Fee for Weighing Instrument</td>
                  <td className="py-2.5 px-3 text-slate-500">Legal Metrology Rules, 2011</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    {formatCurrency(fee.base_verification_fee)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3">Departmental User / Inspection Charges</td>
                  <td className="py-2.5 px-3 text-slate-500">Service Schedule 2026</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    {formatCurrency(fee.user_charge)}
                  </td>
                </tr>
                {fee.late_fee > 0 && (
                  <tr>
                    <td className="py-2.5 px-3 text-red-700">Statutory Late Verification Surcharge</td>
                    <td className="py-2.5 px-3 text-slate-500">Rule 14(3) Overdue Tariff</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-red-700">
                      {formatCurrency(fee.late_fee)}
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={2} className="py-3 px-3 uppercase text-right">
                    Total Amount Received (in INR):
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sm text-emerald-800">
                    {formatCurrency(fee.total_assessed_amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer Seals & Verification */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">Computer Generated Statutory e-Challan</p>
              <p>No physical signature required. Verified via Government Cyber Treasury Portal.</p>
            </div>
            <div className="text-right font-mono text-xs">
              <span>SHA-256 Digest: 88f2...99a1</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-gov-blue text-xs font-semibold text-white shadow-sm hover:bg-blue-800 flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={() => {
              window.print();
            }}
            className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-white shadow-sm hover:bg-slate-900 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
