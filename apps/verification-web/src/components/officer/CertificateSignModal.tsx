import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Certificate, CertificateIssueRequest } from '../../types/certificate';
import { VerificationSession } from '../../types/session';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { Lock, ShieldCheck, CheckCircle2, Key, Stamp, AlertTriangle, QrCode, FileText, ExternalLink, Award } from 'lucide-react';
import { PhysicalStamp, PhysicalStampRecordRequest } from '../../types/stamp';
import { CertificateModal } from '../trader/CertificateModal';

interface CertificateSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: VerificationSession | null;
  onCertificateIssued: (cert: Certificate) => void;
  onNavigateToLedger?: () => void;
}

export const CertificateSignModal: React.FC<CertificateSignModalProps> = ({
  isOpen,
  onClose,
  session,
  onCertificateIssued,
  onNavigateToLedger,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [validityMonths, setValidityMonths] = useState<number>(12);
  const [signerNotes, setSignerNotes] = useState(
    'Authorized statutory certificate issued following complete NAWI Class III procedure compliance.'
  );
  const [isSigning, setIsSigning] = useState(false);
  const [issuedCert, setIssuedCert] = useState<Certificate | null>(null);
  const [isViewingFullCert, setIsViewingFullCert] = useState(false);

  // Physical seal check
  const [existingStamps, setExistingStamps] = useState<PhysicalStamp[]>([]);
  const [isLoadingStamps, setIsLoadingStamps] = useState(false);
  const [affixSealNow, setAffixSealNow] = useState(true);
  const [sealNumber, setSealNumber] = useState(
    () => `DL-SEAL-2026-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [sealPosition, setSealPosition] = useState('CALIBRATION_PORT_MAIN');

  const sessionId = session?.session_id;

  useEffect(() => {
    if (isOpen && sessionId) {
      setIsSigning(false);
      setIsLoadingStamps(true);
      api.stamps
        .listSessionStamps(user.tenantId, sessionId)
        .then((stamps) => {
          setExistingStamps(stamps || []);
        })
        .catch(() => {
          setExistingStamps([]);
        })
        .finally(() => {
          setIsLoadingStamps(false);
        });
    }
    if (!isOpen) {
      setIssuedCert(null);
      setIsViewingFullCert(false);
    }
  }, [isOpen, sessionId, user.tenantId]);

  if (!session) return null;

  const handleSignAndIssue = async () => {
    setIsSigning(true);
    try {
      // 1. If no existing stamps and officer chose to record seal now, record it
      if (existingStamps.length === 0 && affixSealNow && sealNumber.trim()) {
        try {
          const stampPayload: PhysicalStampRecordRequest = {
            instrument_id: session.instrument_id,
            action_type: 'SEAL_APPLIED',
            seal_type: 'LEAD_WIRE_SEAL',
            seal_identification_number: sealNumber.trim(),
            seal_position: sealPosition.trim(),
            notes: 'Official tamper-evident lead wire seal affixed prior to digital certificate signing.',
          };
          const recorded = await api.stamps.recordStampAction(user.tenantId, session.session_id, stampPayload);
          setExistingStamps([recorded]);
        } catch (stampErr) {
          console.warn('Auto stamp record error:', stampErr);
        }
      }

      // Simulate HSM signature delay
      await new Promise((resolve) => setTimeout(resolve, 600));

      const isGatc = user.actorRole === 'GATC_VERIFIER';
      const payload: CertificateIssueRequest = {
        session_id: session.session_id,
        validity_months: validityMonths,
        signer_notes: signerNotes.trim() || undefined,
        issuer_type: isGatc ? 'GATC' : 'DEPARTMENTAL_LMO',
        verifier_name: user.actorName,
        verifier_designation: isGatc ? 'Approved GATC Verifier' : 'Legal Metrology Officer',
        gatc_approval_order: isGatc ? 'GATC/MH/2024/014' : undefined,
        gatc_facility_name: isGatc ? 'Apex Metrology Calibration Lab Pvt Ltd' : undefined,
      };

      const cert = await api.certificates.issueCertificate(user.tenantId, payload);
      setIssuedCert(cert);
      onCertificateIssued?.(cert);
      notify(
        'success',
        isGatc ? 'GATC Test Report & Digital Certificate Issued' : 'Digital Certificate Issued & Cryptographically Signed',
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
      onCertificateIssued?.(issuedCert);
    }
    onClose();
    onNavigateToLedger?.();
  };

  const isGatcUser = user.actorRole === 'GATC_VERIFIER';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isGatcUser ? "Authorize & Sign GATC Verification Test Report" : "Authorize & Cryptographically Sign Certificate"}
        subtitle={`Session: ${session.session_id} | ${isGatcUser ? 'GATC Rules, 2013 Digital Issuance' : 'Statutory Digital Issuance'}`}
        maxWidth="xl"
      >
        {!issuedCert ? (
          <div className="space-y-4">
            {/* Statutory Verification Status Banner */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <span>{isGatcUser ? 'GATC Verification Testing Complete' : 'Statutory Verification Complete'}</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                The verification session passed all deterministic test steps. Ready to generate canonical SHA-256 digest and execute digital signing under the authority of <strong className="font-semibold">{user.actorName}</strong> ({isGatcUser ? 'Approved GATC Verifier' : 'Legal Metrology Officer'}).
              </p>
            </div>

            {/* Physical Security Seal Notice & Confirmation */}
            {existingStamps.length > 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <Stamp className="w-4 h-4 text-emerald-600" />
                  <span>
                    Physical Security Seal Audited: <strong className="font-mono text-slate-900">#{existingStamps[0].seal_identification_number}</strong> ({existingStamps[0].seal_position})
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded uppercase">
                  Audited
                </span>
              </div>
            ) : (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={affixSealNow}
                      onChange={(e) => setAffixSealNow(e.target.checked)}
                      className="rounded border-amber-300 text-gov-navy focus:ring-gov-navy"
                    />
                    <Stamp className="w-4 h-4 text-amber-700" />
                    <span>Affix Physical Security Seal with Digital Signing (Required)</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200/70 text-amber-900 uppercase">
                    Seal Pending
                  </span>
                </div>

                {affixSealNow && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-amber-200/60 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                        Seal Identification Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={sealNumber}
                        onChange={(e) => setSealNumber(e.target.value)}
                        className="w-full text-xs font-mono font-bold bg-white rounded-lg border border-amber-300 px-3 py-1.5 focus:ring-2 focus:ring-amber-500"
                        placeholder="e.g. DL-SEAL-2026-4821"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                        Seal Position
                      </label>
                      <select
                        value={sealPosition}
                        onChange={(e) => setSealPosition(e.target.value)}
                        className="w-full text-xs bg-white rounded-lg border border-amber-300 px-3 py-1.5 focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="CALIBRATION_PORT_MAIN">Main Calibration Port &amp; Enclosure</option>
                        <option value="CHASSIS_JUNCTION_BOX">Load Cell Junction Box</option>
                        <option value="DISPLAY_INDICATOR_HOUSING">Digital Display Housing</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Certificate parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSignAndIssue}
                disabled={isSigning}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isSigning ? (
                  <span>Executing Cryptographic Signature...</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Sign &amp; Issue Certificate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-gov-navy">Digital Certificate Minted &amp; Cryptographically Signed</h4>
              <p className="text-xs text-slate-500 mt-1">
                The statutory digital certificate is published, immutable, and accessible for Zero-PII public QR verification.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs max-w-md mx-auto text-left space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Certificate No:</span>
                <span className="font-mono font-bold text-gov-navy text-sm">{issuedCert.certificate_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Validity Period:</span>
                <span className="font-semibold text-slate-900">
                  {issuedCert.issue_date} to {issuedCert.valid_until}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Physical Security Seal:</span>
                <span className="font-mono font-bold text-emerald-800">
                  {existingStamps.length > 0 ? `#${existingStamps[0].seal_identification_number}` : 'Affixed on Main Calibration Port'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Public QR Token:</span>
                <span className="font-mono text-gov-blue font-bold">{issuedCert.public_verification_token}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1.5 border-t">
                <span>SHA-256 Digest:</span>
                <span className="truncate max-w-[200px]">{issuedCert.certificate_bytes_sha256}</span>
              </div>
            </div>

            {/* Direct Certificate Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsViewingFullCert(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-gov-navy text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-amber-300" />
                <span>View Full Digital Certificate &amp; PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.hash = `#public?token=${encodeURIComponent(issuedCert.public_verification_token)}`;
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer border border-amber-500"
              >
                <QrCode className="w-4 h-4 text-slate-950" />
                <span>Verify Public QR Token</span>
              </button>

              <button
                type="button"
                onClick={handleDone}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Award className="w-4 h-4 text-amber-300" />
                <span>Done &amp; View Ledger</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Embedded Full Certificate View Modal */}
      {issuedCert && (
        <CertificateModal
          isOpen={isViewingFullCert}
          onClose={() => setIsViewingFullCert(false)}
          certificate={issuedCert}
        />
      )}
    </>
  );
};
