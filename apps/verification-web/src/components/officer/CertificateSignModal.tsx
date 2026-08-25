import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Certificate, CertificateIssueRequest } from '../../types/certificate';
import { VerificationSession } from '../../types/session';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { Lock, ShieldCheck, CheckCircle2, Key, QrCode } from 'lucide-react';

interface CertificateSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: VerificationSession | null;
  onCertificateIssued: (cert: Certificate) => void;
}

export const CertificateSignModal: React.FC<CertificateSignModalProps> = ({
  isOpen,
  onClose,
  session,
  onCertificateIssued,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [validityMonths, setValidityMonths] = useState<number>(12);
  const [signerNotes, setSignerNotes] = useState('Authorized statutory certificate issued following complete NAWI Class III procedure compliance.');
  const [isSigning, setIsSigning] = useState(false);
  const [issuedCert, setIssuedCert] = useState<Certificate | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setIssuedCert(null);
      setIsSigning(false);
    }
  }, [isOpen]);

  if (!session) return null;

  const handleSignAndIssue = async () => {
    setIsSigning(true);
    try {
      // Simulate HSM signature delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      const payload: CertificateIssueRequest = {
        session_id: session.session_id,
        validity_months: validityMonths,
        signer_notes: signerNotes.trim() || undefined,
      };

      const cert = await api.certificates.issueCertificate(user.tenantId, payload);
      setIssuedCert(cert);
      notify(
        'success',
        'Digital Certificate Issued & Cryptographically Signed',
        `Certificate Number: ${cert.certificate_number} | QR Token: ${cert.public_verification_token}`
      );
    } catch (err) {
      notify('error', 'Signing Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSigning(false);
    }
  };

  const handleDone = () => {
    if (issuedCert) {
      onCertificateIssued(issuedCert);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Authorize & Cryptographically Sign Certificate"
      subtitle={`Session: ${session.session_id} | Statutory Digital Issuance`}
      maxWidth="xl"
    >
      {!issuedCert ? (
        <div className="space-y-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <span>Statutory Verification Complete</span>
            </div>
            <p className="leading-relaxed">
              The verification session passed all deterministic test steps. Ready to generate the canonical SHA-256 digest and execute digital signing under the authority of <strong className="font-semibold">{user.actorName}</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Statutory Validity Period *
              </label>
              <select
                value={validityMonths}
                onChange={(e) => setValidityMonths(Number(e.target.value))}
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
              >
                <option value={12}>12 Months (Standard Annual Periodical)</option>
                <option value={24}>24 Months (Biennial Schedule)</option>
                <option value={6}>6 Months (Interim / Conditional)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Digital Signing Key Slot
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 font-mono text-[11px] text-slate-700">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>HSM Slot 0: LMO-DELHI-CENTRAL</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Signer Attestation Notes
            </label>
            <input
              type="text"
              value={signerNotes}
              onChange={(e) => setSignerNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-gov-blue"
            />
          </div>

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
              onClick={handleSignAndIssue}
              disabled={isSigning}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSigning ? (
                <span>Executing Cryptographic Signature...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign & Issue Certificate</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h4 className="text-lg font-bold text-gov-navy">Certificate Minted & Published</h4>
            <p className="text-xs text-slate-500 mt-1">
              The digital certificate is signed and accessible for public QR verification.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs max-w-md mx-auto text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Certificate No:</span>
              <span className="font-mono font-bold text-slate-900">{issuedCert.certificate_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Validity:</span>
              <span className="font-semibold text-slate-900">
                {issuedCert.issue_date} to {issuedCert.valid_until}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Public QR Token:</span>
              <span className="font-mono text-gov-blue font-semibold">{issuedCert.public_verification_token}</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1 border-t">
              <span>SHA-256 Hash:</span>
              <span>{issuedCert.certificate_bytes_sha256?.substring(0, 20)}...</span>
            </div>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={handleDone}
              className="px-8 py-2.5 rounded-lg bg-gov-navy text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-2xs"
            >
              Done & View Certificates Ledger
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
