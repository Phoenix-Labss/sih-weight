import React, { useState } from 'react';
import { Lock, ShieldCheck, Copy, Check, AlertTriangle } from 'lucide-react';
import { truncateHash } from '../../utils/formatters';

interface CertificateSecurityBadgeProps {
  hash: string;
  cryptographicValidity: 'VALID_SIGNATURE' | 'INVALID_SIGNATURE' | 'UNCHECKED';
  physicalSealNumber?: string;
}

export const CertificateSecurityBadge: React.FC<CertificateSecurityBadgeProps> = ({
  hash,
  cryptographicValidity,
  physicalSealNumber,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isValidSignature = cryptographicValidity === 'VALID_SIGNATURE';

  return (
    <div className="space-y-4">
      {/* Cryptographic Signature Card */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Cryptographic Trust Attestation</span>
          </div>
          {isValidSignature ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>VALID HSM SIGNATURE</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 bg-red-950/80 px-2.5 py-0.5 rounded-full border border-red-500/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>INVALID / COMPROMISED</span>
            </span>
          )}
        </div>

        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
            Canonical SHA-256 Integrity Digest:
          </div>
          <div className="flex items-center justify-between bg-slate-950/90 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-amber-300 break-all">
            <span>{hash}</span>
            <button
              onClick={handleCopy}
              title="Copy Full Digest"
              className="ml-2 text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors flex-shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {physicalSealNumber && (
          <div className="pt-2 border-t border-slate-800 text-xs flex items-center justify-between text-slate-300">
            <span>Affixed Physical Lead Seal:</span>
            <span className="font-mono font-bold text-white">{physicalSealNumber}</span>
          </div>
        )}
      </div>

      {/* Physical Inspection Advisory Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>Consumer & Inspector Verification Notice</span>
        </div>
        <p className="leading-relaxed text-slate-700">
          A valid digital certificate must be accompanied by an intact physical lead wire seal or holographic verification mark affixed to the instrument body. If the seal is missing, broken, or serial does not match, report immediately to the Legal Metrology helpline.
        </p>
      </div>
    </div>
  );
};
