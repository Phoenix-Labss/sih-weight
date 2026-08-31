import React from 'react';
import { Modal } from '../common/Modal';
import { Certificate } from '../../types/certificate';
import { Instrument } from '../../types/instrument';
import { formatDate, formatDateTime, maskSerialNumber, truncateHash } from '../../utils/formatters';
import { generateDeterministicMatrix } from '../../utils/qrGenerator';
import {
  ShieldCheck,
  Download,
  Printer,
  CheckCircle2,
  Lock,
  QrCode,
  Award,
  FileCheck,
  Building2,
  Scale,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  RefreshCw,
  Clock,
} from 'lucide-react';

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

  const verificationUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/#public?token=${encodeURIComponent(certificate.public_verification_token || '')}`
      : `https://metrology.gov.in/verify?token=${certificate.public_verification_token}`;

  const qrMatrix = generateDeterministicMatrix(verificationUrl);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  const status = certificate.certificate_status;

  const getStatusBadge = () => {
    switch (status) {
      case 'ISSUED':
        return {
          label: 'ISSUED / ACTIVE',
          badgeClass: 'text-emerald-900 bg-emerald-100 border-emerald-300 ring-1 ring-emerald-400/30',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
        };
      case 'EXPIRED':
        return {
          label: 'EXPIRED (OVERDUE)',
          badgeClass: 'text-orange-950 bg-orange-100 border-orange-300 ring-1 ring-orange-400/40',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-700 shrink-0" />,
        };
      case 'SUSPENDED':
        return {
          label: 'SUSPENDED',
          badgeClass: 'text-amber-950 bg-amber-100 border-amber-300 ring-1 ring-amber-400/40',
          icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />,
        };
      case 'REVOKED':
        return {
          label: 'REVOKED / CANCELLED',
          badgeClass: 'text-red-950 bg-red-100 border-red-300 ring-1 ring-red-400/40',
          icon: <XCircle className="w-3.5 h-3.5 text-red-700 shrink-0" />,
        };
      case 'SUPERSEDED':
        return {
          label: 'SUPERSEDED',
          badgeClass: 'text-blue-950 bg-blue-100 border-blue-300 ring-1 ring-blue-400/40',
          icon: <RefreshCw className="w-3.5 h-3.5 text-gov-blue shrink-0" />,
        };
      default:
        return {
          label: (status as string)?.replace(/_/g, ' ') || 'PENDING',
          badgeClass: 'text-slate-800 bg-slate-100 border-slate-300',
          icon: <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />,
        };
    }
  };

  const getDueInfo = () => {
    switch (status) {
      case 'ISSUED':
        return {
          title: 'Next Reverification Due',
          value: formatDate(certificate.valid_until),
          pillClass: 'font-bold text-emerald-800 text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block',
        };
      case 'EXPIRED':
        return {
          title: 'Statutory Expiry (Overdue)',
          value: `${formatDate(certificate.valid_until)} (Expired)`,
          pillClass: 'font-bold text-red-800 text-xs bg-red-50 px-2 py-0.5 rounded border border-red-200 inline-block',
        };
      case 'SUSPENDED':
        return {
          title: 'Reverification Status',
          value: 'Suspended (Inspection Pending)',
          pillClass: 'font-bold text-amber-900 text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-300 inline-block',
        };
      case 'REVOKED':
        return {
          title: 'Certificate Validity',
          value: 'Null & Void (Revoked by Dept)',
          pillClass: 'font-bold text-red-900 text-xs bg-red-100 px-2 py-0.5 rounded border border-red-300 inline-block line-through',
        };
      case 'SUPERSEDED':
        return {
          title: 'Replaced Status',
          value: 'Superseded by Newer Verification',
          pillClass: 'font-bold text-blue-900 text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block',
        };
      default:
        return {
          title: 'Next Reverification Due',
          value: formatDate(certificate.valid_until) || 'Pending Authorization',
          pillClass: 'font-bold text-slate-700 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-300 inline-block',
        };
    }
  };

  const statusBadge = getStatusBadge();
  const dueInfo = getDueInfo();
  const isGatc = certificate.issuer_type === 'GATC' || certificate.certificate_number.startsWith('GATC-');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isGatc ? "Government Approved Test Centre (GATC) Test Certificate" : "Official Legal Metrology Verification Certificate"}
      subtitle={`Certificate: ${certificate.certificate_number} • ${isGatc ? 'Form Schedule IX (GATC) • GATC Rules, 2013' : 'Form Schedule IX • General Rules, 2011'}`}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Certificate Container with Security Border */}
        <div className="relative bg-[#FCFDFE] text-slate-900 font-sans rounded-lg shadow-lg border-2 border-amber-600/30 p-1 sm:p-2 print:border-none print:p-0 print:shadow-none overflow-hidden">
          
          {/* Inner Golden Guilloche Security Border */}
          <div className="relative border border-gov-navy/20 rounded-xl p-5 sm:p-8 bg-white overflow-hidden">
            
            {/* Indian National Tricolor Ribbon Header */}
            <div className="absolute top-0 left-0 right-0 h-1.5 flex">
              <div className="flex-1 bg-[#FF9933]" />
              <div className="flex-1 bg-white" />
              <div className="flex-1 bg-[#138808]" />
            </div>

            {/* Micro Corner Flourishes */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-600/40 rounded-tl-sm pointer-events-none" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-600/40 rounded-tr-sm pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-600/40 rounded-bl-sm pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-600/40 rounded-br-sm pointer-events-none" />

            {/* Ultra-Subtle Government Security Watermark (opacity 3.5% - perfectly readable) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none select-none z-0">
              <svg className="w-[480px] h-[480px]" viewBox="0 0 200 200" fill="currentColor">
                <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="4 2" />
                <circle cx="100" cy="100" r="75" fill="none" stroke="currentColor" strokeWidth="2" />
                {Array.from({ length: 24 }).map((_, i) => (
                  <line
                    key={i}
                    x1="100"
                    y1="100"
                    x2={100 + 72 * Math.cos((i * 15 * Math.PI) / 180)}
                    y2={100 + 72 * Math.sin((i * 15 * Math.PI) / 180)}
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                ))}
                <circle cx="100" cy="100" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>

            {/* Certificate Content */}
            <div className="relative z-10 space-y-5">
              
              {/* Header: National Crest & Authority Titles */}
              <div className="text-center space-y-1 pb-3.5 border-b-2 border-slate-100">
                {/* Ashoka Lion Emblem Representation */}
                <div className="flex justify-center mb-1">
                  <div className="inline-flex flex-col items-center justify-center p-2 rounded-full bg-amber-50/60 border border-amber-200/50">
                    <Scale className="w-7 h-7 text-gov-navy" />
                    <span className="text-[8px] font-bold text-amber-900 tracking-widest uppercase mt-0.5">
                      सत्यमेव जयते
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600">
                    भारत सरकार | GOVERNMENT OF INDIA
                  </h4>
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION
                  </h5>
                  <h2 className="text-lg sm:text-xl font-extrabold text-gov-navy uppercase tracking-tight font-serif pt-0.5">
                    {isGatc ? (certificate.gatc_facility_name || 'Apex Metrology Calibration Lab Pvt Ltd') : 'Department of Legal Metrology'}
                  </h2>
                  <p className="text-xs font-semibold text-amber-800 tracking-wide">
                    {isGatc
                      ? `Government Approved Test Centre • Approval Order: ${certificate.gatc_approval_order || 'GATC/MH/2024/014'} under Section 19`
                      : 'Government of NCT of Delhi • Central Delhi Enforcement Zone'}
                  </p>
                </div>

                <div className="pt-2">
                  <div className={`inline-block font-bold px-4 py-1 rounded-full text-xs uppercase tracking-wider shadow-card ${
                    isGatc ? 'bg-blue-900 text-blue-200' : 'bg-slate-900 text-amber-400'
                  }`}>
                    {isGatc ? 'GATC VERIFICATION TEST REPORT & CERTIFICATE' : 'CERTIFICATE OF VERIFICATION OF WEIGHTS & MEASURES'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    {isGatc
                      ? '[Issued under Section 19 of The Legal Metrology Act, 2009 & Rule 13, Schedule II of Legal Metrology (GATC) Rules, 2013]'
                      : '[Issued under Section 24 of The Legal Metrology Act, 2009 (1 of 2010) & Rule 14, Schedule IX of The Legal Metrology General Rules, 2011]'}
                  </p>

                  {/* Non-Active Certificate Warning Banner */}
                  {status !== 'ISSUED' && (
                    <div className={`mt-2.5 p-2 rounded-lg border text-xs flex items-center justify-center gap-2 font-bold ${
                      status === 'EXPIRED'
                        ? 'bg-orange-50 text-orange-950 border-orange-300'
                        : status === 'REVOKED'
                        ? 'bg-red-50 text-red-950 border-red-300'
                        : status === 'SUSPENDED'
                        ? 'bg-amber-50 text-amber-950 border-amber-300'
                        : 'bg-blue-50 text-blue-950 border-blue-300'
                    }`}>
                      {statusBadge.icon}
                      <span>
                        {status === 'EXPIRED'
                          ? 'ATTENTION: This certificate is EXPIRED. Commercial use of this instrument is prohibited under Section 24.'
                          : status === 'REVOKED'
                          ? 'WARNING: This certificate has been REVOKED. Commercial use is prohibited.'
                          : status === 'SUSPENDED'
                          ? 'NOTICE: This certificate is SUSPENDED pending departmental inspection.'
                          : 'NOTICE: This certificate has been SUPERSEDED by a newer verification certificate.'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Row: Certificate Credentials & Interactive QR Seal */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                
                {/* Primary Certificate Particulars */}
                <div className="md:col-span-2 bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-3 flex flex-col justify-between min-w-0">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                        Certificate Number
                      </span>
                      <span className="font-mono font-extrabold text-sm text-gov-navy tracking-tight truncate block">
                        {certificate.certificate_number}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                        Statutory Status
                      </span>
                      <span className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-md border ${statusBadge.badgeClass}`}>
                        {statusBadge.icon}
                        <span>{statusBadge.label}</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                        Date of Verification
                      </span>
                      <span className="font-bold text-slate-800 text-xs">
                        {formatDate(certificate.issue_date)}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                        {dueInfo.title}
                      </span>
                      <span className={dueInfo.pillClass}>
                        {dueInfo.value}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                      Issuing Departmental Authority
                    </span>
                    <span className="font-semibold text-slate-800 block truncate">
                      Office of the Controller of Legal Metrology, Delhi Zone (JUR-DL-01)
                    </span>
                  </div>
                </div>

                {/* Secure QR Verification Code Card */}
                <div className="bg-gradient-to-b from-white to-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col items-center justify-between text-center shadow-card min-w-0">
                  <a
                    href={verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center cursor-pointer"
                    title="Click or scan to verify on national portal"
                  >
                    <div className="w-24 h-24 bg-white p-1.5 border border-slate-300 rounded-lg shadow-inner flex items-center justify-center group-hover:border-gov-blue transition-colors">
                      <svg viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`} className="w-full h-full">
                        {qrMatrix.map((row, r) =>
                          row.map((cell, c) => (
                            <rect
                              key={`${r}-${c}`}
                              x={c}
                              y={r}
                              width={1}
                              height={1}
                              fill={cell ? '#0B1E36' : '#FFFFFF'}
                            />
                          ))
                        )}
                      </svg>
                    </div>

                    <div className="mt-2 space-y-0.5">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-gov-blue group-hover:underline">
                        <QrCode className="w-3 h-3" />
                        <span>Scan to Verify</span>
                      </span>
                      <p className="text-[9px] font-mono text-slate-500 truncate max-w-[170px]">
                        {certificate.public_verification_token}
                      </p>
                    </div>
                  </a>
                </div>
              </div>

              {/* Technical Specifications Grid */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-gov-navy shrink-0" />
                  <h4 className="font-bold text-gov-navy uppercase tracking-wider text-xs font-serif">
                    Technical Particulars of Verified Instrument
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50/90 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-medium block">Instrument Category:</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {instrument?.model?.category || 'NAWI'} — {instrument?.model?.subtype || 'Commercial Counter Scale'}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-medium block">Model Approval Ref (Sec 22):</span>
                    <span className="font-mono font-bold text-slate-800 truncate block">
                      {instrument?.model?.model_approval_number || 'IND/09/2024/8842'}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-medium block">Accuracy Class:</span>
                    <span className="font-bold text-gov-navy block">
                      Class {instrument?.model?.accuracy_class?.replace(/CLASS_/g, '') || 'III'} (Medium)
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-medium block">Instrument Serial No:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 inline-block truncate max-w-full">
                      {maskSerialNumber(instrument?.serial_number || 'DL-2026-9042')}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-medium block">Maximum Capacity (Max):</span>
                    <span className="font-bold text-slate-800 block">
                      {instrument?.model?.max_capacity || 30.0} {instrument?.model?.capacity_unit || 'kg'}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-medium block">Scale Interval (e = d):</span>
                    <span className="font-bold text-slate-800 block">
                      {instrument?.model?.verification_scale_interval_e || 0.005} {instrument?.model?.capacity_unit || 'kg'}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-medium block">Physical Stamp / Lead Seal:</span>
                    <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block truncate max-w-full">
                      DL-SEAL-2026-0042
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-medium block">Procedure Version:</span>
                    <span className="font-mono text-xs text-slate-600 truncate block">
                      {certificate.procedure_pack_id || 'IND-LM-NAWI-2026.1'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statutory Declarations & Cryptographic Attestation Block (Fixed Grid Alignment) */}
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch text-xs">
                
                {/* Cryptographic Integrity & DSC Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 min-w-0 flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-xs">
                      <Lock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Tamper-Evident eSign Seal</span>
                    </div>
                    <p className="text-xs font-mono text-slate-500 truncate mt-1">
                      SHA-256: {truncateHash(certificate.certificate_bytes_sha256 || '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945', 24)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 pt-1 border-t border-slate-200/50">
                    Signed & Timestamped: <span className="font-medium text-slate-700">{formatDateTime(certificate.signature_timestamp || certificate.created_at)}</span>
                  </p>
                </div>

                {/* Authorized Officer Signature Seal */}
                <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 space-y-1 min-w-0 flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex items-center gap-1 text-emerald-800 font-bold text-xs mb-0.5">
                      <Award className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>{isGatc ? 'GATC Approved & Signed' : 'Digitally Approved & Signed'}</span>
                    </div>
                    <span className="font-bold text-slate-900 text-xs block truncate">
                      {certificate.verifier_name || (isGatc ? 'Dr. Priya Nair' : 'Shri Arvind Sharma')}
                    </span>
                    <span className="text-xs text-slate-600 block truncate">
                      {certificate.verifier_designation || (isGatc ? 'Approved GATC Verifier (Apex Calibration Lab)' : 'Legal Metrology Officer (Central Delhi Zone)')}
                    </span>
                  </div>
                  <p className="text-[9px] font-mono text-slate-500 pt-1 border-t border-emerald-200/60 truncate" title={certificate.digital_signature_reference || 'DSC-GOV-IN-DL-LMO-2026-9921'}>
                    DSC: {truncateHash(certificate.digital_signature_reference || (isGatc ? 'DSC-GATC-IN-DL-2026-0042' : 'DSC-GOV-IN-DL-LMO-2026-9921'), 26)}
                  </p>
                </div>
              </div>

              {/* Official Statutory Footnote */}
              <div className="text-xs text-center text-slate-500 pt-1.5 border-t border-slate-100 font-medium">
                {isGatc
                  ? 'This statutory test report and digital verification certificate is generated and issued under Section 19 of The Legal Metrology Act, 2009 & GATC Rules, 2013.'
                  : 'This digital certificate is generated and issued under Section 24 of The Legal Metrology Act, 2009. The physical instrument bears the statutory stamp and seal as prescribed in Schedule VIII of The General Rules, 2011.'}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Official Government Digital Certificate • Valid throughout the Union of India.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-gov-blue text-xs font-semibold text-white shadow-sm hover:bg-blue-800 flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Certificate</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 rounded-xl bg-slate-900 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
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

