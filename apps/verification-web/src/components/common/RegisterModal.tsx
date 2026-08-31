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
  CreditCard,
  FileCheck,
  Check,
  Loader2,
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
        setError('Please complete all credential fields in accordance with the security criteria.');
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
      <div className="space-y-4">
        {/* 1. Legal / Statutory Notice Strip */}
        <div className="bg-slate-50 border border-slate-300 rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-700">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold text-gov-navy text-xs">
              <Building2 className="w-3.5 h-3.5 text-gov-blue" />
              <span>Statutory Establishment Registration (Form LM-REG-01)</span>
            </div>
            <p className="text-xs text-slate-600">
              Official enrollment under Section 24 of The Legal Metrology Act, 2009 &amp; Schedule IX.
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-block text-xs font-mono font-bold bg-white text-gov-navy px-2 py-0.5 rounded border border-slate-300 uppercase">
              Section 24 / Schedule IX
            </span>
          </div>
        </div>

        {/* 2. Institutional Compact Step Indicator */}
        <div className="bg-white border border-slate-200 rounded-md px-3.5 py-2.5">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {/* Step 1 */}
            <div className={`flex items-center gap-2 ${step === 1 ? 'text-gov-navy font-bold' : step > 1 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                step === 1
                  ? 'bg-gov-navy text-white'
                  : step > 1
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {step > 1 ? <Check className="w-3 h-3" /> : '1'}
              </span>
              <span className="truncate text-xs sm:text-xs">1. Authorized Person</span>
            </div>

            {/* Step 2 */}
            <div className={`flex items-center gap-2 ${step === 2 ? 'text-gov-navy font-bold' : step > 2 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                step === 2
                  ? 'bg-gov-navy text-white'
                  : step > 2
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {step > 2 ? <Check className="w-3 h-3" /> : '2'}
              </span>
              <span className="truncate text-xs sm:text-xs">2. Business KYC &amp; PAN</span>
            </div>

            {/* Step 3 */}
            <div className={`flex items-center gap-2 ${step === 3 ? 'text-gov-navy font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                step === 3
                  ? 'bg-gov-navy text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                3
              </span>
              <span className="truncate text-xs sm:text-xs">3. Premises &amp; Declaration</span>
            </div>
          </div>
        </div>

        {/* 3. Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-md flex items-start gap-2" role="alert">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 4. Multi-step Form Content */}
        <form onSubmit={step === 3 ? handleSubmit : handleNextStep} className="space-y-4">
          
          {/* STEP 1: Personal & Login Credentials */}
          {step === 1 && (
            <div className="space-y-3.5 bg-white p-4 rounded-md border border-slate-300">
              <div className="border-b border-slate-200 pb-2">
                <h4 className="text-xs font-bold text-gov-navy uppercase tracking-wider">
                  Authorized Representative / Scale Owner Particulars
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter the particulars of the designated proprietor or authorized signatory.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div>
                  <label htmlFor="reg-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name (Proprietor / Signatory) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="reg-fullname"
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Official / Business Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    placeholder="e.g. ramesh@kirana.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                    10-Digit Mobile Number (SMS OTP) <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="text-xs font-semibold text-slate-600 absolute left-3 top-2 select-none">+91</span>
                    <input
                      id="reg-phone"
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-xs font-mono rounded-md border border-slate-300 pl-11 pr-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1">
                    Password (CERT-In Standard) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue"
                  />
                </div>

                {/* Confirm Password */}
                <div className="sm:col-span-2">
                  <label htmlFor="reg-confirmpassword" className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm Password <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="reg-confirmpassword"
                    type="password"
                    required
                    placeholder="Re-enter identical password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue"
                  />
                </div>
              </div>

              {/* Password Strength Checklist */}
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-xs space-y-1.5">
                <span className="font-semibold text-slate-700 block">Security &amp; Password Requirements:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1 text-slate-600">
                  <span className={hasMinLength ? 'text-emerald-700 font-semibold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {hasMinLength ? '✓' : '•'} At least 8 characters
                  </span>
                  <span className={hasUppercase ? 'text-emerald-700 font-semibold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {hasUppercase ? '✓' : '•'} 1 uppercase (A-Z)
                  </span>
                  <span className={hasLowercase ? 'text-emerald-700 font-semibold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {hasLowercase ? '✓' : '•'} 1 lowercase (a-z)
                  </span>
                  <span className={hasNumber ? 'text-emerald-700 font-semibold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {hasNumber ? '✓' : '•'} 1 number (0-9)
                  </span>
                  <span className={hasSpecial ? 'text-emerald-700 font-semibold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {hasSpecial ? '✓' : '•'} 1 special char (@$!%*?&#)
                  </span>
                  <span className={isPasswordMatch ? 'text-emerald-700 font-semibold flex items-center gap-1' : 'flex items-center gap-1'}>
                    {isPasswordMatch ? '✓' : '•'} Passwords match
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Business & Statutory KYC (PAN is compulsory, GSTIN is optional) */}
          {step === 2 && (
            <div className="space-y-3.5 bg-white p-4 rounded-md border border-slate-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-gov-navy uppercase tracking-wider">
                    Business Classification &amp; Statutory KYC
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Provide permanent tax registration and establishment trade identity.
                  </p>
                </div>
                <span className="text-xs text-amber-900 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-300 self-start sm:self-auto">
                  PAN Compulsory • GSTIN Optional
                </span>
              </div>

              {/* Stakeholder Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Establishment Classification <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setStakeholderType('OWNER_USER')}
                    className={`p-2.5 rounded-md border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      stakeholderType === 'OWNER_USER'
                        ? 'border-gov-navy bg-slate-50 text-gov-navy font-semibold ring-1 ring-gov-navy'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Commercial Trader / Scale User</span>
                    <span className="text-xs text-slate-500 font-normal mt-0.5">Retail, Kirana, Mandi Merchant, Factory</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStakeholderType('MANUFACTURER')}
                    className={`p-2.5 rounded-md border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      stakeholderType === 'MANUFACTURER'
                        ? 'border-gov-navy bg-slate-50 text-gov-navy font-semibold ring-1 ring-gov-navy'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Scale Manufacturer</span>
                    <span className="text-xs text-slate-500 font-normal mt-0.5">LM-1 / LM-2 License Holder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStakeholderType('REPAIRER')}
                    className={`p-2.5 rounded-md border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      stakeholderType === 'REPAIRER'
                        ? 'border-gov-navy bg-slate-50 text-gov-navy font-semibold ring-1 ring-gov-navy'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Authorized Repairer</span>
                    <span className="text-xs text-slate-500 font-normal mt-0.5">LM-3 License Holder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStakeholderType('DEALER')}
                    className={`p-2.5 rounded-md border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      stakeholderType === 'DEALER'
                        ? 'border-gov-navy bg-slate-50 text-gov-navy font-semibold ring-1 ring-gov-navy'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Instrument Dealer</span>
                    <span className="text-xs text-slate-500 font-normal mt-0.5">Wholesale / Retail Scale Vendor</span>
                  </button>
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-tradename" className="block text-xs font-semibold text-slate-700 mb-1">
                    Trade / Shop Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="reg-tradename"
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kirana & General Store"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue"
                  />
                </div>

                <div>
                  <label htmlFor="reg-legalname" className="block text-xs font-semibold text-slate-700 mb-1">
                    Legal Entity Name (Optional)
                  </label>
                  <input
                    id="reg-legalname"
                    type="text"
                    placeholder="e.g. M/s Ramesh Enterprises"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue"
                  />
                </div>
              </div>

              {/* Statutory KYC: Compulsory PAN & Optional GSTIN */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                {/* 1. Compulsory PAN Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="reg-pan" className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-gov-blue" />
                      <span>Permanent Account Number (PAN)</span>
                      <span className="text-red-600">*</span>
                    </label>
                    <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded font-bold border border-red-200">
                      Compulsory
                    </span>
                  </div>
                  <input
                    id="reg-pan"
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    className={`w-full text-xs font-mono font-bold uppercase rounded-md border px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 ${
                      panNumber && !isPanValid
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                        : isPanValid
                        ? 'border-emerald-500 focus:ring-emerald-500 focus:border-emerald-500'
                        : 'border-slate-300 focus:ring-gov-blue focus:border-gov-blue'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="text-slate-500">
                      10-character alphanumeric PAN of the business entity or authorized proprietor.
                    </span>
                    {panNumber && (
                      <span className={isPanValid ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
                        {isPanValid ? '✓ Valid PAN format' : '✗ Format: 5 letters + 4 numbers + 1 letter'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Optional GSTIN Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="reg-gst" className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span>GST Number (GSTIN)</span>
                    </label>
                    <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-medium border border-slate-300">
                      Optional (Not Mandatory)
                    </span>
                  </div>
                  <input
                    id="reg-gst"
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 07AAAAA0000A1Z5 (Leave blank if not registered)"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    className={`w-full text-xs font-mono font-bold uppercase rounded-md border px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 ${
                      gstNumber && !isGstValid
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                        : gstNumber && isGstValid
                        ? 'border-emerald-500 focus:ring-emerald-500 focus:border-emerald-500'
                        : 'border-slate-300 focus:ring-gov-blue focus:border-gov-blue'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="text-slate-500">
                      Small vendors &amp; kirana stores below statutory GST turnover threshold may leave this blank.
                    </span>
                    {gstNumber && (
                      <span className={isGstValid ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
                        {isGstValid ? '✓ Valid GSTIN format' : '✗ 15-character standard GSTIN required'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Establishment Address & Submission */}
          {step === 3 && (
            <div className="space-y-3.5 bg-white p-4 rounded-md border border-slate-300">
              <div className="border-b border-slate-200 pb-2">
                <h4 className="text-xs font-bold text-gov-navy uppercase tracking-wider">
                  Establishment Premises &amp; Physical Scale Location
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Specify the physical site where commercial weighing instruments are installed or inspected.
                </p>
              </div>

              <div className="space-y-3">
                {/* Premises Address */}
                <div>
                  <label htmlFor="reg-address" className="block text-xs font-semibold text-slate-700 mb-1">
                    Premises Address (Shop No, Building, Street, Market) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="reg-address"
                    type="text"
                    required
                    placeholder="e.g. Shop 14, Main Market, Chandni Chowk"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* City */}
                  <div>
                    <label htmlFor="reg-city" className="block text-xs font-semibold text-slate-700 mb-1">
                      City / Town <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="reg-city"
                      type="text"
                      required
                      placeholder="New Delhi"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue"
                    />
                  </div>

                  {/* Enforcement Zone / District */}
                  <div>
                    <label htmlFor="reg-district" className="block text-xs font-semibold text-slate-700 mb-1">
                      Enforcement Zone / District <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="reg-district"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue cursor-pointer"
                    >
                      <option value="Central Delhi">Central Delhi Zone (JUR-DL-01)</option>
                      <option value="North Delhi">North Delhi Zone (JUR-DL-02)</option>
                      <option value="South Delhi">South Delhi Zone (JUR-DL-03)</option>
                      <option value="East Delhi">East Delhi Zone (JUR-DL-04)</option>
                      <option value="West Delhi">West Delhi Zone (JUR-DL-05)</option>
                    </select>
                  </div>

                  {/* PIN Code */}
                  <div>
                    <label htmlFor="reg-pincode" className="block text-xs font-semibold text-slate-700 mb-1">
                      6-Digit PIN Code <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="reg-pincode"
                      type="text"
                      required
                      maxLength={6}
                      placeholder="110006"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-xs font-mono font-bold rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue"
                    />
                  </div>
                </div>
              </div>

              {/* Statutory Legal Declaration */}
              <div className="bg-slate-50 border border-slate-300 rounded-md p-3 space-y-2 mt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={declarationAccepted}
                    onChange={(e) => setDeclarationAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-gov-navy focus:ring-gov-blue"
                  />
                  <span className="text-xs text-slate-800 leading-relaxed">
                    I hereby solemnly declare and affirm that the particulars stated above (including Permanent Account Number <strong>{cleanPan || '[PENDING PAN]'}</strong>) are true and accurate. I undertake to submit all weighing and measuring instruments in my possession for statutory verification under Section 24 of The Legal Metrology Act, 2009.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={loading}
                className="px-4 py-2 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-gov-navy text-xs font-semibold text-white shadow-card hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="px-5 py-2 rounded-md bg-emerald-700 text-xs font-semibold text-white shadow-card hover:bg-emerald-800 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Establishment Account...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Registration &amp; Sign In</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </Modal>
  );
};

