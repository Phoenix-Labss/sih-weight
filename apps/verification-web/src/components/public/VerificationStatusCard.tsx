import React from 'react';
import { CertificateStatus } from '../../types/certificate';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface VerificationStatusCardProps {
  status: CertificateStatus;
  certificateNumber: string;
  verificationDate: string;
  validUntil: string;
  revocationReason?: string;
  supersededBy?: string;
  onNavigateToToken?: (token: string) => void;
}

export const VerificationStatusCard: React.FC<VerificationStatusCardProps> = ({
  status,
  certificateNumber,
  verificationDate,
  validUntil,
  revocationReason,
  supersededBy,
  onNavigateToToken,
}) => {
  const isIssued = status === 'ISSUED';
  const isExpired = status === 'EXPIRED';
  const isSuspended = status === 'SUSPENDED';
  const isRevoked = status === 'REVOKED';
  const isSuperseded = status === 'SUPERSEDED';

  return (
    <div className="space-y-4">
      {/* High-Contrast Status Banner */}
      <div
        role="status"
        className={`rounded-lg p-6 border shadow-card transition-all ${
          isIssued
            ? 'bg-emerald-700 text-white border-emerald-600'
            : isExpired
            ? 'bg-orange-700 text-white border-orange-600'
            : isSuspended
            ? 'bg-amber-700 text-white border-amber-600'
            : isRevoked
            ? 'bg-red-800 text-white border-red-700'
            : 'bg-gov-navy text-white border-slate-700'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
            {isIssued ? (
              <ShieldCheck className="w-8 h-8 text-white" />
            ) : isExpired ? (
              <AlertTriangle className="w-8 h-8 text-white" />
            ) : isSuspended ? (
              <ShieldAlert className="w-8 h-8 text-white" />
            ) : isRevoked ? (
              <XCircle className="w-8 h-8 text-white" />
            ) : (
              <RefreshCw className="w-8 h-8 text-white" />
            )}
          </div>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-widest font-extrabold text-white/90">
              {isIssued
                ? 'STATUTORILY VERIFIED & AUTHENTICATED'
                : isExpired
                ? 'STATUTORY VALIDITY EXPIRED — RE-VERIFICATION OVERDUE'
                : isSuspended
                ? 'CERTIFICATE TEMPORARILY SUSPENDED'
                : isRevoked
                ? 'CERTIFICATE REVOKED — INSTRUMENT PROHIBITED'
                : 'SUPERSEDED BY SUBSEQUENT VERIFICATION'}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">{certificateNumber}</h2>
            <p className="text-xs text-white/90 leading-relaxed max-w-xl">
              {isIssued
                ? `Officially tested and verified in compliance with The Legal Metrology Act, 2009. Valid until ${formatDate(validUntil)}.`
                : isExpired
                ? `The 12-month statutory validity expired on ${formatDate(validUntil)}. Commercial trade use without re-verification is prohibited.`
                : isSuspended
                ? `Temporarily suspended pending departmental inspection. Reason: ${revocationReason || 'Physical mark irregularity'}.`
                : isRevoked
                ? `Revoked by Controller of Legal Metrology under Section 24. Reason: ${revocationReason || 'Defective calibration / unauthorized modification'}.`
                : `A newer verification certificate has been issued for this physical unit.`}
            </p>
          </div>
        </div>

        {/* Superseded Action Link */}
        {isSuperseded && supersededBy && onNavigateToToken && (
          <div className="mt-4 pt-3 border-t border-white/20 flex justify-end">
            <button
              onClick={() => onNavigateToToken(supersededBy)}
              className="px-4 py-1.5 rounded-lg bg-white text-blue-900 font-bold text-xs hover:bg-blue-50 transition-colors shadow-card"
            >
              View Active Certificate ({supersededBy}) →
            </button>
          </div>
        )}
      </div>

      {/* Date Milestones Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-card text-xs">
        <div>
          <span className="text-slate-500 block text-xs">Verification / Issuance Date:</span>
          <span className="font-bold text-slate-800 text-sm">{formatDate(verificationDate)}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-xs">
            {isExpired
              ? 'Statutory Expiry (Overdue):'
              : isRevoked
              ? 'Certificate Validity:'
              : isSuspended
              ? 'Suspension Status:'
              : isSuperseded
              ? 'Superseded Status:'
              : 'Next Re-Verification Due Date:'}
          </span>
          <span
            className={`font-bold text-sm ${
              isExpired
                ? 'text-red-700'
                : isRevoked
                ? 'text-red-800 line-through'
                : isSuspended
                ? 'text-amber-800'
                : isSuperseded
                ? 'text-blue-800'
                : 'text-emerald-700'
            }`}
          >
            {isRevoked
              ? 'Cancelled / Revoked (Void)'
              : isSuspended
              ? 'Suspended (Inspection Pending)'
              : isSuperseded
              ? 'Superseded by Newer Verification'
              : isExpired
              ? `${formatDate(validUntil)} (Overdue)`
              : formatDate(validUntil)}
          </span>
        </div>
      </div>
    </div>
  );
};
