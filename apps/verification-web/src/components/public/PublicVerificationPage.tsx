import React, { useState, useEffect, useCallback } from 'react';
import { PublicCertificateVerifyResponse } from '../../types/public';
import { api } from '../../api/client';
import { VerificationStatusCard } from './VerificationStatusCard';
import { InstrumentSummaryCard } from './InstrumentSummaryCard';
import { CertificateSecurityBadge } from './CertificateSecurityBadge';
import {
  QrCode,
  Search,
  Shield,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface PublicVerificationPageProps {
  initialToken?: string;
}

const sampleTokens = [
  { token: 'TOKEN_VALID_2026', label: 'Valid & Active Certificate', color: 'emerald' },
  { token: 'TOKEN_EXPIRED_2025', label: 'Expired Certificate (Overdue)', color: 'orange' },
  { token: 'TOKEN_SUSPENDED_2026', label: 'Suspended Certificate (Seal Damaged)', color: 'amber' },
  { token: 'TOKEN_REVOKED_2026', label: 'Revoked Certificate (Fraud)', color: 'rose' },
  { token: 'TOKEN_SUPERSEDED_2025', label: 'Superseded Certificate', color: 'blue' },
];

export const PublicVerificationPage: React.FC<PublicVerificationPageProps> = ({
  initialToken = 'TOKEN_VALID_2026',
}) => {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [verificationResult, setVerificationResult] = useState<PublicCertificateVerifyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleVerify = useCallback(async (tokenToVerify: string) => {
    const cleanToken = tokenToVerify.trim();
    if (!cleanToken) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await api.publicVerify.verifyCertificate(cleanToken);
      setVerificationResult(result);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Certificate not found or invalid token');
      setVerificationResult(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    handleVerify(initialToken);
  }, [initialToken, handleVerify]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(tokenInput);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Mobile-Friendly National Header */}
      <div className="text-center space-y-2 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wider">
          <Shield className="w-3.5 h-3.5 text-amber-600" />
          <span>Department of Legal Metrology — Official Public Verification</span>
        </div>
        <h1 className="text-2xl font-extrabold text-gov-navy tracking-tight">
          Verify Weighing & Measuring Certificate
        </h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Scan the QR sticker on the scale or enter the 256-bit verification token to verify authenticity in real-time.
        </p>
      </div>

      {/* Search / Token Input Form */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <QrCode className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Enter QR token or Certificate No (e.g. TOKEN_VALID_2026)..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-gov-blue"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-gov-navy text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <span>{isLoading ? 'Verifying...' : 'Verify'}</span>
          </button>
        </form>

        {/* Quick Test Sample Tokens for Evaluator/Auditor */}
        <div className="pt-2 border-t border-slate-100">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
            Test Sample Scenarios (Click to Verify):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sampleTokens.map((s) => (
              <button
                key={s.token}
                onClick={() => {
                  setTokenInput(s.token);
                  handleVerify(s.token);
                }}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                  tokenInput === s.token
                    ? 'bg-gov-navy text-white border-gov-navy shadow-2xs font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message Display */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-rose-900 text-xs flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Certificate Verification Failed</h4>
            <p>{errorMessage}</p>
            <p className="text-[11px] text-rose-700">
              Please ensure the QR code is intact and from an official Government of India Legal Metrology seal.
            </p>
          </div>
        </div>
      )}

      {/* Verification Result Section */}
      {verificationResult && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Status Card */}
          <VerificationStatusCard
            status={verificationResult.status}
            certificateNumber={verificationResult.certificate_number}
            verificationDate={verificationResult.verification_date}
            validUntil={verificationResult.valid_until}
            revocationReason={verificationResult.revocation_reason}
            supersededBy={verificationResult.superseded_by}
            onNavigateToToken={(token) => {
              setTokenInput(token);
              handleVerify(token);
            }}
          />

          {/* Technical Particulars Card */}
          <InstrumentSummaryCard
            summary={verificationResult.instrument_summary}
            issuingAuthority={verificationResult.issuing_authority}
          />

          {/* Cryptographic Trust & Physical Seal Badge */}
          <CertificateSecurityBadge
            hash={verificationResult.certificate_hash}
            cryptographicValidity={verificationResult.cryptographic_validity}
            physicalSealNumber={verificationResult.instrument_summary.physical_seal_number}
          />
        </div>
      )}
    </div>
  );
};
