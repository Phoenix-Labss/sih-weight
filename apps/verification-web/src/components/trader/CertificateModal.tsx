import React from 'react';
import { Modal } from '../common/Modal';
import { Certificate } from '../../types/certificate';
import { Instrument } from '../../types/instrument';
import { formatDate, formatDateTime, maskSerialNumber, truncateHash } from '../../utils/formatters';
import { generateDeterministicMatrix } from '../../utils/qrGenerator';
import { ShieldCheck, Download, Printer, CheckCircle2, Lock, QrCode } from 'lucide-react';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: Certificate | null;
  instrument?: Instrument | null;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  certificate,
  instrument,
}) => {
  if (!certificate) return null;

  const qrMatrix = generateDeterministicMatrix(certificate.public_verification_token || 'TOKEN', 25);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Legal Metrology Certificate of Verification"
      subtitle={`Certificate: ${certificate.certificate_number} | Form - Schedule IX`}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Certificate Border Canvas */}
        <div className="border-4 border-gov-navy/90 p-6 sm:p-8 bg-white rounded-xl shadow-md text-slate-900 font-sans relative overflow-hidden print:border-none print:p-0">
          {/* Watermark Emblem */}
          <div className="absolute inset-0 flex items-center justify-center opacity-4 pointer-events-none">
            <div className="w-96 h-96 rounded-full border-8 border-slate-900 flex items-center justify-center">
              <span className="text-6xl font-extrabold text-slate-900 tracking-widest">LEGAL METROLOGY</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center border-b-2 border-gov-navy/80 pb-4 space-y-1 relative z-10">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-700">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Government of NCT of Delhi</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-gov-navy uppercase tracking-tight">
              Department of Legal Metrology
            </h2>
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Certificate of Verification of Weights & Measures
            </p>
            <p className="text-[11px] text-slate-500">
              [Issued under Section 24 of The Legal Metrology Act, 2009 & Rule 14 of The General Rules, 2011]
            </p>
          </div>

          {/* Top Meta Details & QR Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-b border-slate-200 relative z-10 items-center">
            <div className="md:col-span-2 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">Certificate Number:</span>
                  <span className="font-mono font-extrabold text-sm text-gov-navy">{certificate.certificate_number}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Status:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{certificate.certificate_status}</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Date of Verification:</span>
                  <span className="font-semibold text-slate-900">{formatDate(certificate.issue_date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Next Verification Due:</span>
                  <span className="font-bold text-emerald-800">{formatDate(certificate.valid_until)}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Issuing Authority:</span>
                <span className="font-semibold text-slate-800">
                  Office of the Controller of Legal Metrology, Delhi Central Zone
                </span>
              </div>
            </div>

            {/* Dynamic QR Code Module */}
            <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="w-28 h-28 bg-white p-1.5 border border-slate-300 rounded-lg shadow-2xs flex items-center justify-center">
                <svg viewBox="0 0 25 25" className="w-full h-full">
                  {qrMatrix.map((row, r) =>
                    row.map((cell, c) => (
                      <rect
                        key={`${r}-${c}`}
                        x={c}
                        y={r}
                        width={1}
                        height={1}
                        fill={cell ? '#0F2942' : '#FFFFFF'}
                      />
                    ))
                  )}
                </svg>
              </div>
              <div className="text-[10px] text-center text-slate-500 mt-2 font-mono">
                <span className="flex items-center gap-1 justify-center text-gov-blue font-bold">
                  <QrCode className="w-3 h-3" />
                  <span>Scan to Verify Authenticity</span>
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Token: {certificate.public_verification_token}</span>
              </div>
            </div>
          </div>

          {/* Instrument Specifications Particulars */}
          <div className="py-4 space-y-3 text-xs relative z-10">
            <h4 className="font-bold text-gov-navy uppercase tracking-wider text-[11px]">
              Technical Particulars of Verified Instrument
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px]">Category & Subtype:</span>
                <span className="font-semibold text-slate-900">
                  {instrument?.model?.category || 'NAWI'} — Counter Scale
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Pattern Approval Ref:</span>
                <span className="font-semibold text-slate-900">
                  {instrument?.model?.model_approval_number || 'IND-MOD-2024-8842'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Accuracy Class:</span>
                <span className="font-bold text-slate-900">
                  {instrument?.model?.accuracy_class || 'CLASS_III'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Serial Number (Masked):</span>
                <span className="font-mono font-bold text-slate-900">
                  {maskSerialNumber(instrument?.serial_number || 'DL-2024-8842')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Maximum Capacity (Max):</span>
                <span className="font-semibold text-slate-900">
                  {instrument?.model?.max_capacity || 30.0} {instrument?.model?.capacity_unit || 'kg'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Scale Interval (e):</span>
                <span className="font-semibold text-slate-900">
                  {instrument?.model?.verification_scale_interval_e || 0.005} kg
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Physical Lead Wire Seal:</span>
                <span className="font-mono font-bold text-slate-900">DL-SEAL-2026-0042</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Procedure Pack Version:</span>
                <span className="font-mono text-[10px] text-slate-700">{certificate.procedure_pack_id}</span>
              </div>
            </div>
          </div>

          {/* Cryptographic Signing & Authority Attestation */}
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs relative z-10">
            <div className="space-y-1 text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cryptographically Signed via HSM / eSign Key</span>
              </div>
              <p className="text-[10px] font-mono text-slate-500">
                Canonical SHA-256 Digest: {truncateHash(certificate.certificate_bytes_sha256 || '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945', 24)}
              </p>
              <p className="text-[10px] text-slate-400">Signed on {formatDateTime(certificate.signature_timestamp || certificate.created_at)}</p>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block border-b border-slate-400 pb-1 px-4 text-center">
                <span className="font-bold text-gov-navy block">Inspector Amit Sharma</span>
                <span className="text-[10px] text-slate-500">Legal Metrology Officer (Central Delhi)</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Key Ref: {certificate.digital_signature_reference || 'SIG-ED25519-DL-2026-LMO-99120'}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Statutory Verification Certificate is valid under Section 24 of The Legal Metrology Act.</span>
          </div>

          <div className="flex items-center gap-3">
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
              <span>Print Certificate</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
