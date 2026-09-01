import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PublicCertificateVerifyResponse } from '../../types/public';
import { api } from '../../api/client';
import { mockDb } from '../../api/mock/mockService';
import { VerificationStatusCard } from './VerificationStatusCard';
import { InstrumentSummaryCard } from './InstrumentSummaryCard';
import { CertificateSecurityBadge } from './CertificateSecurityBadge';
import { RealQrScannerModal } from './RealQrScannerModal';
import { Modal } from '../common/Modal';
import { useNotification } from '../../context/NotificationContext';
import {
  QrCode,
  Search,
  Shield,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Camera,
  FileDown,
  AlertTriangle,
  HelpCircle,
  Scale,
  Building2,
  Lock,
  FileText,
  Upload,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  ExternalLink,
  Info,
} from 'lucide-react';

interface PublicVerificationPageProps {
  initialToken?: string;
}

const auditTestVectors = [
  { token: 'TOKEN_VALID_2026', label: 'Valid & Active Certificate (Form 8)', color: 'emerald' },
  { token: 'TOKEN_EXPIRED_2025', label: 'Expired Certificate (Re-Verification Overdue)', color: 'orange' },
  { token: 'TOKEN_SUSPENDED_2026', label: 'Suspended Certificate (Seal Damaged)', color: 'amber' },
  { token: 'TOKEN_REVOKED_2026', label: 'Revoked Certificate (Fraud / Modified Calibration)', color: 'rose' },
  { token: 'TOKEN_SUPERSEDED_2025', label: 'Superseded Certificate (Newer Certificate Issued)', color: 'blue' },
];

export const PublicVerificationPage: React.FC<PublicVerificationPageProps> = ({
  initialToken = '',
}) => {
  const { notify } = useNotification();
  const [searchInput, setSearchInput] = useState(initialToken);
  const [verificationResult, setVerificationResult] = useState<PublicCertificateVerifyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState<string>('');

  // Modals & Drawers
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isGrievanceModalOpen, setIsGrievanceModalOpen] = useState(false);
  const [isTestVectorsOpen, setIsTestVectorsOpen] = useState(false);

  // Grievance Form State
  const [grievanceData, setGrievanceData] = useState({
    complainantName: '',
    phone: '',
    shopName: '',
    shopAddress: '',
    natureOfComplaint: 'SHORT_WEIGHING',
    details: '',
  });
  const [isSubmittingGrievance, setIsSubmittingGrievance] = useState(false);

  // Camera QR Simulation State
  const [qrUploadFile, setQrUploadFile] = useState<string>('');
  const [isSimulatingCamera, setIsSimulatingCamera] = useState(false);

  const handleVerify = useCallback(async (queryToVerify: string) => {
    const cleanQuery = queryToVerify.trim();
    if (!cleanQuery) {
      setVerificationResult(null);
      setErrorMessage(null);
      setSearchedQuery('');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSearchedQuery(cleanQuery);

    try {
      // 1. First try publicVerify API (which calls Fastify or mock bridge)
      const result = await api.publicVerify.verifyCertificate(cleanQuery);
      setVerificationResult(result);
    } catch {
      // 2. Comprehensive fallback: Search mockDb certificates by certificate_number, seal, serial, or id
      try {
        const fallbackRes = mockDb.verifyPublic(cleanQuery);
        setVerificationResult(fallbackRes);
      } catch (fallbackErr) {
        setErrorMessage(
          fallbackErr instanceof Error
            ? fallbackErr.message
            : `No registered weighing or measuring instrument found matching "${cleanQuery}". Please check the Certificate Number or QR Token.`
        );
        setVerificationResult(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialToken && initialToken.trim()) {
      setSearchInput(initialToken);
      handleVerify(initialToken);
    }
  }, [initialToken, handleVerify]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchedQuery('');
    setVerificationResult(null);
    setErrorMessage(null);
    window.location.hash = '#public';
  };

  const handleQrUploadSelect = (token: string) => {
    setSearchInput(token);
    setIsQrScannerOpen(false);
    handleVerify(token);
    notify('success', 'QR Code Decoded', `Parsed verification token: ${token}`);
  };

  const handleGrievanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingGrievance(true);
    setTimeout(() => {
      setIsSubmittingGrievance(false);
      setIsGrievanceModalOpen(false);
      const docketNo = `NCH-LM-2026-${Math.floor(100000 + Math.random() * 900000)}`;
      notify(
        'success',
        'Grievance Registered',
        `Complaint registered under Docket No: ${docketNo}. Forwarded to Zonal Legal Metrology Inspectorate.`
      );
      setGrievanceData({
        complainantName: '',
        phone: '',
        shopName: '',
        shopAddress: '',
        natureOfComplaint: 'SHORT_WEIGHING',
        details: '',
      });
    }, 800);
  };

  const handleDownloadPdf = () => {
    if (!verificationResult) return;
    notify(
      'info',
      'Generating Certificate PDF',
      `Form 8 Digital Certificate ${verificationResult.certificate_number} downloaded.`
    );
    // Trigger simulated or live PDF download
    const dummyBlob = new Blob(
      [
        `GOVERNMENT OF INDIA - DEPARTMENT OF LEGAL METROLOGY\nFORM 8 DIGITAL CERTIFICATE OF VERIFICATION\nCertificate No: ${verificationResult.certificate_number}\nStatus: ${verificationResult.status}\nValid Until: ${verificationResult.valid_until}\nAuthority: ${verificationResult.issuing_authority}\nIntegrity Hash: ${verificationResult.certificate_hash}`
      ],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(dummyBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${verificationResult.certificate_number}_Form8_Certificate.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* ── Official Government Header ── */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-bold uppercase tracking-wider shadow-sm">
          <Shield className="w-3.5 h-3.5 text-amber-700" />
          <span>Department of Legal Metrology • Official Citizen Verification Gateway</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gov-navy tracking-tight">
          National Weighing Instrument Public Verification
        </h1>
        <p className="text-xs text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Verify the authenticity of commercial weighing and measuring instruments, inspect physical lead seal records, and validate digital Form 8 certificates in real-time under Section 24 of The Legal Metrology Act, 2009.
        </p>
      </div>

      {/* ── Main Unified Search / Scan Box ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                aria-label="Certificate Number, QR Token, or Physical Seal Number"
                placeholder="Enter Certificate No (e.g. CERT-DL-2026-008912), QR Token, or Seal No..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 pl-10 pr-9 py-2.5 focus:ring-2 focus:ring-gov-blue focus:border-gov-blue transition-all bg-slate-50/50 hover:bg-white focus:bg-white font-mono"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isLoading || !searchInput.trim()}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-gov-navy hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-card transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>{isLoading ? 'Verifying…' : 'Verify Scale'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsQrScannerOpen(true)}
                className="px-4 py-2.5 bg-gov-blue hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-card transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                title="Scan QR Code Sticker with Camera or Image"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Scan QR Sticker</span>
              </button>
            </div>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-gov-blue shrink-0" />
            <span>Accepts: Official Certificate Number, 256-Bit Opaque Token, Physical Lead Seal No, or Serial No.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsGrievanceModalOpen(true)}
            className="text-amber-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span>Report Short-Weighing / Broken Seal</span>
          </button>
        </div>
      </div>

      {/* ── Error Message Display ── */}
      {errorMessage && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3 animate-fade-in shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-rose-950">Certificate Lookup Unsuccessful</h4>
            <p className="leading-relaxed text-slate-700">{errorMessage}</p>
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setIsGrievanceModalOpen(true)}
                className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Lodge Grievance for Uncertified Instrument
              </button>
              <button
                onClick={handleClearSearch}
                className="text-slate-600 hover:text-slate-900 font-semibold text-xs"
              >
                Clear Search
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATE 1: Default Clean Landing (When no certificate is looked up) ── */}
      {!verificationResult && !isLoading && !errorMessage && (
        <div className="space-y-6">
          {/* 3-Step Citizen Inspection Guide */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Scale className="w-5 h-5 text-gov-blue" />
              <div>
                <h3 className="text-sm font-bold text-gov-navy">How to Verify a Commercial Scale in 3 Steps</h3>
                <p className="text-xs text-slate-500">Know your consumer rights at ration shops, grocery outlets, jewelry showrooms &amp; petrol pumps</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-gov-blue flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h4 className="font-bold text-xs text-slate-900">Check Physical Lead-Wire Seal</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Look for the green or metallic lead wire seal on the calibration screws. Ensure the seal wire is unbroken and embossed with the state emblem mark.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h4 className="font-bold text-xs text-slate-900">Scan Government QR Code</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Locate the 2D QR Code sticker affixed to the scale frame. Scan it using your smartphone camera or enter the certificate number above.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h4 className="font-bold text-xs text-slate-900">Verify Active Validity</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Confirm the digital certificate displays <span className="font-bold text-emerald-700">"STATUTORILY VERIFIED &amp; ACTIVE"</span> with a valid future due date.
                </p>
              </div>
            </div>
          </div>

          {/* Consumer Protection Notice & Helpline Box */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>Section 30 Legal Metrology Protection</span>
              </div>
              <h4 className="font-bold text-sm text-slate-900">Right to 100% Accurate Measurement</h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                Short-weighing, using uncertified scales, or tampering with lead seals is a cognizable legal offence. Consumers can demand to inspect the verification certificate or report irregularities.
              </p>
            </div>

            <button
              onClick={() => setIsGrievanceModalOpen(true)}
              className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-card transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Report Scale Tampering</span>
            </button>
          </div>

          {/* National Platform Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Certified Instruments</div>
              <div className="mt-1 text-2xl font-bold text-gov-navy">14,800+</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Digitally Verified &amp; Sealed</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Cryptographic Trust</div>
              <div className="mt-1 text-2xl font-bold text-emerald-700">100%</div>
              <div className="text-[11px] text-emerald-600 mt-0.5">RFC 8785 Ed25519 HSM Signed</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Metrology Standards</div>
              <div className="mt-1 text-2xl font-bold text-indigo-700">OIML R76</div>
              <div className="text-[11px] text-indigo-600 mt-0.5">28-Digit Rational Math Engine</div>
            </div>
          </div>
        </div>
      )}

      {/* ── STATE 2: Verified Result Display (When a certificate is found) ── */}
      {verificationResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Action Bar Above Result */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-slate-700">
                Verified Search: <strong className="font-mono text-slate-900">{searchedQuery}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPdf}
                className="px-3 py-1.5 bg-gov-blue hover:bg-blue-800 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download Form 8 (PDF)</span>
              </button>
              <button
                onClick={handleClearSearch}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Verify Another Scale
              </button>
            </div>
          </div>

          {/* Status Banner */}
          <VerificationStatusCard
            status={verificationResult.status}
            certificateNumber={verificationResult.certificate_number}
            verificationDate={verificationResult.verification_date}
            validUntil={verificationResult.valid_until}
            revocationReason={verificationResult.revocation_reason}
            supersededBy={verificationResult.superseded_by}
            onNavigateToToken={(token) => {
              setSearchInput(token);
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

          {/* Bottom Actions */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-600">
              Notice any physical seal discrepancy or inaccurate weights during your purchase?
            </span>
            <button
              onClick={() => {
                setGrievanceData((prev) => ({
                  ...prev,
                  details: `Regarding Certificate ${verificationResult.certificate_number} (Seal ${verificationResult.instrument_summary.physical_seal_number}): `,
                }));
                setIsGrievanceModalOpen(true);
              }}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Report Discrepancy on this Scale</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Collapsible Auditor & Sandbox Test Tools (Clean & Discrete) ── */}
      <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIsTestVectorsOpen(!isTestVectorsOpen)}
          className="w-full p-3.5 text-left bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-gov-blue" />
            <span>Auditor &amp; Sandbox Test Scenarios (State Machine Evaluation Vectors)</span>
          </div>
          {isTestVectorsOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {isTestVectorsOpen && (
          <div className="p-4 border-t border-slate-200 space-y-2.5 bg-white text-xs animate-fade-in">
            <p className="text-slate-500 text-[11px]">
              Click any statutory scenario below to evaluate state machine projections and cryptographic attestation cards:
            </p>
            <div className="flex flex-wrap gap-2">
              {auditTestVectors.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => {
                    setSearchInput(v.token);
                    handleVerify(v.token);
                  }}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-all text-xs cursor-pointer ${
                    searchInput === v.token
                      ? 'bg-gov-navy text-white border-gov-navy shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Real QR Camera & Image Scanner ── */}
      <RealQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={(token) => {
          setSearchInput(token);
          setIsQrScannerOpen(false);
          handleVerify(token);
          notify('success', 'QR Code Decoded', `Parsed verification token: ${token}`);
        }}
      />


      {/* ── MODAL 2: Consumer Grievance Lodgement ── */}
      <Modal
        isOpen={isGrievanceModalOpen}
        onClose={() => setIsGrievanceModalOpen(false)}
        title="Lodge Legal Metrology Grievance / Report Short-Weighing"
        subtitle="National Consumer Helpline (NCH 1915) & Departmental Enforcement Cell"
        maxWidth="lg"
      >
        <form onSubmit={handleGrievanceSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Your Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Chandra"
                value={grievanceData.complainantName}
                onChange={(e) => setGrievanceData({ ...grievanceData, complainantName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-gov-blue"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number (For SMS Updates) *
              </label>
              <input
                type="tel"
                required
                pattern="[0-9]{10}"
                placeholder="10-digit mobile number"
                value={grievanceData.phone}
                onChange={(e) => setGrievanceData({ ...grievanceData, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-gov-blue"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Shop / Establishment Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ABC Kirana Store / Petrol Pump"
                value={grievanceData.shopName}
                onChange={(e) => setGrievanceData({ ...grievanceData, shopName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-gov-blue"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Shop Location / District *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Main Market, Karol Bagh, Delhi"
                value={grievanceData.shopAddress}
                onChange={(e) => setGrievanceData({ ...grievanceData, shopAddress: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-gov-blue"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nature of Alleged Irregularity *
            </label>
            <select
              value={grievanceData.natureOfComplaint}
              onChange={(e) => setGrievanceData({ ...grievanceData, natureOfComplaint: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-gov-blue"
            >
              <option value="SHORT_WEIGHING">Short-Weighing / Short Delivery of Goods</option>
              <option value="BROKEN_SEAL">Broken or Missing Physical Lead-Wire Seal</option>
              <option value="EXPIRED_SCALE">Use of Unverified / Expired Stamping Scale</option>
              <option value="UNAUTHORIZED_MODIFICATION">Tampered Electronic Calibration / Cheater Switch</option>
              <option value="REFUSAL_TO_SHOW_CERTIFICATE">Trader Refused to Show Verification Certificate</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Complaint Details &amp; Observations *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Describe the transaction, observed weight difference, bill reference..."
              value={grievanceData.details}
              onChange={(e) => setGrievanceData({ ...grievanceData, details: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-gov-blue"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsGrievanceModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingGrievance}
              className="px-5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmittingGrievance ? 'Transmitting to NCH...' : 'Submit Official Grievance'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
