import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useAuth, RegisterPayload } from '../../context/AuthContext';
import {
  Building2,
  CheckCircle2,
  Shield,
  User,
  Mail,
  Lock,
  MapPin,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Store,
  CreditCard,
  FileCheck,
} from 'lucide-react';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { register } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State - Step 1
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Form State - Step 2 (KYC: Compulsory PAN + Optional GSTIN)
  const [stakeholderType, setStakeholderType] = useState<'OWNER_USER' | 'MANUFACTURER' | 'DEALER' | 'REPAIRER'>('OWNER_USER');
  const [tradeName, setTradeName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  // Form State - Step 3
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('New Delhi');
  const [district, setDistrict] = useState('Central Delhi');
  const [pincode, setPincode] = useState('110001');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  // Password criteria check
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&#^_\-+=~`|\\(){}[\]:;"'<>,.?/]/.test(password);
  const isPasswordStrong = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const isPasswordMatch = password === confirmPassword && confirmPassword.length > 0;

  // Phone validation
  const cleanPhone = phone.replace(/[\s\-\+]/g, '');
  const isPhoneValid = /^[6-9]\d{9}$/.test(cleanPhone.slice(-10));

  // PAN validation (Compulsory: 10 chars, 5 letters + 4 digits + 1 letter)
  const cleanPan = panNumber.trim().toUpperCase();
  const isPanValid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan);

  // GSTIN validation (Optional: if entered, must be 15 chars standard format)
  const cleanGst = gstNumber.trim().toUpperCase();
  const isGstValid = !cleanGst || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGst);

  // Pincode validation
  const isPincodeValid = /^[1-9][0-9]{5}$/.test(pincode.trim());

  // Step 1 Validation
  const canProceedStep1 =
    fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    isPhoneValid &&
    isPasswordStrong &&
    isPasswordMatch;

  // Step 2 Validation: PAN is compulsory, GSTIN is optional
  const canProceedStep2 =
    (tradeName.trim().length > 0 || fullName.trim().length > 0) &&
    isPanValid &&
    isGstValid;

  // Step 3 Validation
  const canSubmit =
    addressLine1.trim().length >= 3 &&
    city.trim().length >= 2 &&
    isPincodeValid &&
    declarationAccepted;

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step === 1) {
      if (!canProceedStep1) {
        setError('Please complete all credential fields accurately.');
        return;
      }
      if (!tradeName && fullName) setTradeName(fullName);
      setStep(2);
    } else if (step === 2) {
      if (!isPanValid) {
        setError('Permanent Account Number (PAN) is compulsory. Please enter a valid 10-character PAN (e.g. ABCDE1234F).');
        return;
      }
      if (!isGstValid) {
        setError('Invalid GSTIN format. Please enter a 15-character GST number or leave it blank.');
        return;
      }
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError('Please complete the establishment address and accept the statutory declaration.');
      return;
    }

    setLoading(true);
    try {
      const payload: RegisterPayload = {
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        phone: cleanPhone.slice(-10),
        panNumber: cleanPan,
        gstNumber: cleanGst || undefined,
        legalName: legalName.trim() || tradeName.trim() || fullName.trim(),
        tradeName: tradeName.trim() || legalName.trim() || fullName.trim(),
        stakeholderType,
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        district: district.trim(),
        pincode: pincode.trim(),
      };

      await register(payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Establishment & Trader Registration"
      subtitle="National e-Metrology Legal Verification System • Government of India"
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* National Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-gov-navy text-white rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Statutory Establishment Registration</h3>
              <p className="text-[11px] text-slate-300">
                Register commercial scale user, shop, dealer, or repairer under Section 24 of The Legal Metrology Act, 2009.
              </p>
            </div>
          </div>
          <div className="hidden sm:block text-right">
            <span className="text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30 uppercase">
              Section 24 / Schedule IX
            </span>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-gov-navy font-bold' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-gov-navy text-white' : 'bg-slate-200 text-slate-600'}`}>
              1
            </span>
            <span className="text-xs">Authorized Person</span>
          </div>
          <div className={`h-0.5 flex-1 mx-3 ${step >= 2 ? 'bg-gov-navy' : 'bg-slate-200'}`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-gov-navy font-bold' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-gov-navy text-white' : 'bg-slate-200 text-slate-600'}`}>
              2
            </span>
            <span className="text-xs">PAN & Business KYC</span>
          </div>
          <div className={`h-0.5 flex-1 mx-3 ${step >= 3 ? 'bg-gov-navy' : 'bg-slate-200'}`} />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-gov-navy font-bold' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-gov-navy text-white' : 'bg-slate-200 text-slate-600'}`}>
              3
            </span>
            <span className="text-xs">Establishment Address</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Multi-step Form */}
        <form onSubmit={step === 3 ? handleSubmit : handleNextStep} className="space-y-4">
          
          {/* STEP 1: Personal & Login Credentials */}
          {step === 1 && (
            <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gov-blue" />
                <span>Authorized Representative / Scale Owner Particulars</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name (Proprietor / Signatory) *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Official / Business Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. ramesh@kirana.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    10-Digit Mobile Number (SMS OTP) *
                  </label>
                  <div className="relative">
                    <span className="text-xs font-bold text-slate-500 absolute left-3 top-2.5">+91</span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-xs font-mono rounded-lg border border-slate-300 pl-11 pr-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password (CERT-In Standard) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                    />
                  </div>
                </div>
              </div>

              {/* Password Strength Checklist */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] space-y-1">
                <span className="font-semibold text-slate-600 block">Password Security Requirements:</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-500">
                  <span className={hasMinLength ? 'text-emerald-700 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {hasMinLength ? '✓' : '•'} At least 8 characters
                  </span>
                  <span className={hasUppercase ? 'text-emerald-700 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {hasUppercase ? '✓' : '•'} 1 uppercase letter (A-Z)
                  </span>
                  <span className={hasLowercase ? 'text-emerald-700 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {hasLowercase ? '✓' : '•'} 1 lowercase letter (a-z)
                  </span>
                  <span className={hasNumber ? 'text-emerald-700 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {hasNumber ? '✓' : '•'} 1 number (0-9)
                  </span>
                  <span className={hasSpecial ? 'text-emerald-700 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {hasSpecial ? '✓' : '•'} 1 special character (@$!%*?&#)
                  </span>
                  <span className={isPasswordMatch ? 'text-emerald-700 font-bold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {isPasswordMatch ? '✓' : '•'} Passwords match
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Business & Statutory KYC (PAN is compulsory, GSTIN is optional) */}
          {step === 2 && (
            <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-gov-blue" />
                  <span>Business & Statutory KYC Information</span>
                </h4>
                <span className="text-[10px] text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded font-bold border border-amber-300">
                  PAN is Compulsory • GSTIN is Optional
                </span>
              </div>

              {/* Stakeholder Category */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Establishment Classification *
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setStakeholderType('OWNER_USER')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                      stakeholderType === 'OWNER_USER'
                        ? 'border-gov-blue bg-blue-50/70 text-gov-navy font-bold ring-1 ring-gov-blue'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Commercial Trader / Scale User</span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">Kirana, Retail, Mart, Mandi, Factory</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStakeholderType('MANUFACTURER')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                      stakeholderType === 'MANUFACTURER'
                        ? 'border-gov-blue bg-blue-50/70 text-gov-navy font-bold ring-1 ring-gov-blue'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Scale Manufacturer</span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">LM-1 / LM-2 License Holder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStakeholderType('REPAIRER')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                      stakeholderType === 'REPAIRER'
                        ? 'border-gov-blue bg-blue-50/70 text-gov-navy font-bold ring-1 ring-gov-blue'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Authorized Repairer</span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">LM-3 License Holder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStakeholderType('DEALER')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                      stakeholderType === 'DEALER'
                        ? 'border-gov-blue bg-blue-50/70 text-gov-navy font-bold ring-1 ring-gov-blue'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Instrument Dealer</span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">Wholesale / Retail Scale Vendor</span>
                  </button>
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Trade / Shop Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kirana & General Store"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Legal Business Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. M/s Ramesh Enterprises"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                  />
                </div>
              </div>

              {/* Statutory KYC: Compulsory PAN & Optional GSTIN */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                {/* 1. Compulsory PAN Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-gov-blue" />
                      <span>Permanent Account Number (PAN) *</span>
                    </label>
                    <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold border border-rose-200">
                      Compulsory
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    className={`w-full text-xs font-mono font-bold uppercase rounded-lg border px-3 py-2 bg-white focus:ring-2 ${
                      panNumber && !isPanValid
                        ? 'border-rose-400 focus:ring-rose-500'
                        : isPanValid
                        ? 'border-emerald-400 focus:ring-emerald-500'
                        : 'border-slate-300 focus:ring-gov-blue'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-slate-500">
                      10-character PAN of the business entity or authorized proprietor.
                    </span>
                    {panNumber && (
                      <span className={isPanValid ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                        {isPanValid ? '✓ Valid PAN format' : '✗ Must be 5 letters + 4 numbers + 1 letter'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Optional GSTIN Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700 flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>GST Number (GSTIN) (Optional)</span>
                    </label>
                    <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                      Optional (Not Mandatory)
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 07AAAAA0000A1Z5 (Leave blank if not registered)"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    className={`w-full text-xs font-mono font-bold uppercase rounded-lg border px-3 py-2 bg-white focus:ring-2 ${
                      gstNumber && !isGstValid
                        ? 'border-rose-400 focus:ring-rose-500'
                        : gstNumber && isGstValid
                        ? 'border-emerald-400 focus:ring-emerald-500'
                        : 'border-slate-300 focus:ring-gov-blue'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-slate-500">
                      Small vendors & kirana stores below the GST threshold may leave this blank.
                    </span>
                    {gstNumber && (
                      <span className={isGstValid ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                        {isGstValid ? '✓ Valid GSTIN format' : '✗ 15-character GST format required'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Establishment Address & Submission */}
          {step === 3 && (
            <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gov-blue" />
                <span>Establishment & Physical Scale Location</span>
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Premises Address (Shop No, Building, Street) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shop 14, Main Market, Chandni Chowk"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      City / Town *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="New Delhi"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Enforcement Zone / District *
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                    >
                      <option value="Central Delhi">Central Delhi Zone (JUR-DL-01)</option>
                      <option value="North Delhi">North Delhi Zone (JUR-DL-02)</option>
                      <option value="South Delhi">South Delhi Zone (JUR-DL-03)</option>
                      <option value="East Delhi">East Delhi Zone (JUR-DL-04)</option>
                      <option value="West Delhi">West Delhi Zone (JUR-DL-05)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      6-Digit PIN Code *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="110006"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-xs font-mono font-bold rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
                    />
                  </div>
                </div>
              </div>

              {/* Statutory Legal Declaration */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 space-y-2 mt-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={declarationAccepted}
                    onChange={(e) => setDeclarationAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-amber-300 text-gov-navy focus:ring-gov-blue"
                  />
                  <span className="text-[11px] text-amber-950 leading-relaxed font-medium">
                    I hereby solemnly declare and affirm that the particulars stated above (including PAN {cleanPan || '...'}) are true and accurate. I undertake to submit all weighing and measuring instruments in my possession for statutory verification under Section 24 of The Legal Metrology Act, 2009.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gov-navy text-xs font-bold text-white shadow-sm hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="px-6 py-2.5 rounded-xl bg-emerald-700 text-xs font-bold text-white shadow-md hover:bg-emerald-800 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Creating Establishment Account...' : 'Complete Registration & Sign In'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </Modal>
  );
};
