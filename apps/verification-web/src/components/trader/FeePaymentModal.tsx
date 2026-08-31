import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Application, PaymentReconcileRequest } from '../../types/application';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { CreditCard, Landmark, QrCode, CheckCircle2, ShieldCheck, Receipt } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface FeePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: Application | null;
  onPaymentCompleted: (app: Application) => void;
}

export const FeePaymentModal: React.FC<FeePaymentModalProps> = ({
  isOpen,
  onClose,
  application,
  onPaymentCompleted,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [gatewayType, setGatewayType] = useState<'SBIEPAY' | 'TREASURY' | 'UPI'>('SBIEPAY');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [updatedApp, setUpdatedApp] = useState<Application | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setIsProcessing(false);
      setUpdatedApp(null);
    }
  }, [isOpen]);

  if (!application) return null;

  const assessment = application.fee_assessment || {
    fee_assessment_id: `FEE-${application.application_id}`,
    tenant_id: application.tenant_id,
    policy_version: 'SCH-XII-2024.1',
    base_verification_fee: 750.0,
    user_charge: 0.0,
    late_fee: 0.0,
    total_assessed_amount: 750.0,
    currency: 'INR',
    payment_status: 'PAYMENT_PENDING',
    created_at: new Date().toISOString(),
  };

  const handleSimulatePayment = async () => {
    setIsProcessing(true);
    try {
      // Simulate gateway network roundtrip
      await new Promise((resolve) => setTimeout(resolve, 800));

      const payload: PaymentReconcileRequest = {
        payment_gateway_ref: `${gatewayType}-${Date.now()}`,
        receipt_number: `RCPT-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      };

      const result = await api.applications.reconcilePayment(user.tenantId, application.application_id, payload);
      setUpdatedApp(result);
      setIsSuccess(true);
      notify(
        'success',
        'Payment Reconciled & Approved',
        `Official statutory fee payment receipt #${result.fee_assessment?.receipt_number || payload.receipt_number}`
      );
      onPaymentCompleted(result);
    } catch (err) {
      notify('error', 'Payment Failed', err instanceof Error ? err.message : 'Unknown gateway error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Statutory Verification Fee Payment"
      subtitle={`Application: ${application.application_number} | Department of Legal Metrology`}
      maxWidth="xl"
    >
      {!isSuccess ? (
        <div className="space-y-5">
          {/* Itemized Assessment Bill */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
            <h4 className="font-bold text-gov-navy uppercase tracking-wider text-xs mb-2 flex items-center justify-between">
              <span>Itemized Statutory Assessment</span>
              <span className="text-slate-400 font-normal">Policy: {assessment.policy_version}</span>
            </h4>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">Base Statutory Verification Fee:</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatCurrency(assessment.base_verification_fee)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">Departmental Inspection & User Charges:</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatCurrency(assessment.user_charge)}
              </span>
            </div>
            {assessment.late_fee > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-200 text-red-700">
                <span>Statutory Late Surcharge:</span>
                <span className="font-mono font-semibold">{formatCurrency(assessment.late_fee)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 text-sm font-bold text-gov-navy">
              <span>Total Assessed Amount:</span>
              <span className="font-mono text-base text-emerald-700">
                {formatCurrency(assessment.total_assessed_amount)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Authorized Payment Gateway
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'SBIEPAY',
                  name: 'SBI e-Pay / Cyber Treasury',
                  icon: Landmark,
                  desc: 'State Govt. Head 1475',
                },
                {
                  id: 'TREASURY',
                  name: 'e-Grass / Treasury',
                  icon: CreditCard,
                  desc: 'Debit/Credit/Netbanking',
                },
                {
                  id: 'UPI',
                  name: 'Bharat QR / UPI',
                  icon: QrCode,
                  desc: 'Instant UPI Settlement',
                },
              ].map((g) => {
                const Icon = g.icon;
                const isSelected = gatewayType === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => setGatewayType(g.id as 'SBIEPAY' | 'TREASURY' | 'UPI')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-gov-blue bg-blue-50/70 text-gov-navy ring-1 ring-gov-blue'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-gov-blue' : 'text-slate-500'}`} />
                    <div className="text-xs font-bold">{g.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{g.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span>Secure 256-bit encrypted treasury settlement under Department Head 1475 - Legal Metrology.</span>
          </div>

          {/* Action */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSimulatePayment}
              disabled={isProcessing}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <span>Reconciling with Cyber Treasury...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pay {formatCurrency(assessment.total_assessed_amount)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h4 className="text-lg font-bold text-gov-navy">Statutory Payment Successful</h4>
            <p className="text-xs text-slate-500 mt-1">
              Your payment has been reconciled directly into Government Treasury Head 1475.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs max-w-md mx-auto text-left space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Official Receipt No:</span>
              <span className="font-mono font-bold text-slate-900">
                {updatedApp?.fee_assessment?.receipt_number}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Treasury Challan Ref:</span>
              <span className="font-mono font-bold text-slate-900">
                {updatedApp?.fee_assessment?.treasury_challan_number}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount Paid:</span>
              <span className="font-mono font-bold text-emerald-700">
                {formatCurrency(updatedApp?.fee_assessment?.total_assessed_amount)}
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-gov-navy text-xs font-semibold text-white hover:bg-slate-800 flex items-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              <span>Done & Return to Dashboard</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
