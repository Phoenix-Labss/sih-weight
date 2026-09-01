import React, { useState, useRef, useEffect } from 'react';
import {
  Scale,
  Shield,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  ChevronDown,
  UserCheck,
  Building2,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  QrCode,
  ArrowRight,
  X,
  FileText,
  HelpCircle,
  Phone,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { RegisterModal } from './RegisterModal';

interface StatutoryInfoTopic {
  title: string;
  badge: string;
  summary: string;
  points: { title: string; desc: string }[];
  actionLabel?: string;
  actionType?: 'register' | 'public';
}

const STATUTORY_TOPICS: Record<string, StatutoryInfoTopic> = {
  about: {
    title: 'Overview & Statutory Role of Legal Metrology',
    badge: 'Statutory Mandate',
    summary: 'The Directorate of Legal Metrology, operating under the Department of Consumer Affairs, Ministry of Consumer Affairs, Food & Public Distribution, Government of India, enforces uniform standards of weights, measures, and measuring instruments across all commercial, trade, and public safety domains in India.',
    points: [
      { title: 'Harmonization with International Standards', desc: 'Alignment with OIML (International Organization of Legal Metrology) recommendations for non-automatic and automatic weighing systems.' },
      { title: 'Mandatory Section 24 Verification', desc: 'Statutory verification and physical lead/laser stamping of all commercial weighing instruments before use and periodically thereafter.' },
      { title: 'Digital Transformation & Zero-PII Certification', desc: 'Cryptographic SHA-256 digital certificate issuance paired with immutable physical inspection ledgers.' },
    ],
    actionLabel: 'Apply for Scale Verification (Form LM-REG-01)',
    actionType: 'register',
  },
  acts: {
    title: 'The Legal Metrology Act, 2009 (Act No. 1 of 2010)',
    badge: 'Primary Legislation',
    summary: 'Enacted by Parliament to establish and enforce standards of weights and measures, regulate trade and commerce in weights, measures, and packaged commodities sold or distributed by weight, measure, or number.',
    points: [
      { title: 'Section 24 (Verification & Stamping)', desc: 'Mandates that every person possessing or using any weight or measure in any transaction must submit it for statutory verification by an authorized Legal Metrology Officer (LMO) or GATC.' },
      { title: 'Section 25 (Prohibition of Non-Standard Units)', desc: 'Prohibits the manufacture, sale, repair, import, or use of non-standard or unverified weights and measuring instruments.' },
      { title: 'Section 33 (Penalties & Legal Prosecution)', desc: 'Prescribes statutory fines and imprisonment for using unverified weights, tampered seals, or non-conforming weighing instruments.' },
    ],
    actionLabel: 'Verify Scale Certificate via Public QR',
    actionType: 'public',
  },
  rules: {
    title: 'Legal Metrology (General) Rules, 2011 & Amendments',
    badge: 'Subordinate Legislation',
    summary: 'Prescribes technical testing specifications, maximum permissible errors (MPE), tolerances, calibration intervals, and verification procedure packs across India.',
    points: [
      { title: 'Accuracy Classes I, II, III & IV', desc: 'Defines specifications from Class I (Special Accuracy / Micro-balances) to Class IV (Ordinary Accuracy / Heavy industrial scales).' },
      { title: 'Standard Calibration Schedules', desc: '12-month re-verification cycle for commercial weighing instruments and 24-month cycle for bulk volumetric storage tanks and flowmeters.' },
      { title: 'Traceability Hierarchy', desc: 'Rigid reference chain from National Standards (NPL) to Secondary and Working Standards used by field inspectors.' },
    ],
  },
  org: {
    title: 'Directorate Organizational Structure',
    badge: 'Institutional Governance',
    summary: 'The national legal metrology apparatus operates under a cooperative federal architecture between the Union Government and State/UT Administrations.',
    points: [
      { title: 'Central Directorate (New Delhi)', desc: 'Headed by the Director of Legal Metrology at Krishi Bhawan, responsible for policy, model approval, and central legislation.' },
      { title: 'State Controllers of Legal Metrology', desc: 'Headed by State Controllers across 36 States/UTs managing state-wide enforcement and district Inspectorates.' },
      { title: 'Regional Reference Standard Laboratories (RRSL)', desc: '5 apex RRSL testing facilities at Ahmedabad, Bhubaneswar, Bangalore, Faridabad, and Guwahati.' },
      { title: 'Legal Metrology Officers (LMOs)', desc: 'Field officers authorized to inspect, test, stamp, and certify commercial weighing equipment.' },
    ],
  },
  standards: {
    title: 'Verification Standards (OIML R 76-1 Compliant)',
    badge: 'Technical Metrology',
    summary: 'All non-automatic weighing instruments (NAWI) are evaluated against stringent OIML R 76-1 criteria across eccentricity, repeatability, and linearity parameters.',
    points: [
      { title: 'Maximum Permissible Error (MPE)', desc: 'Calculated at initial verification (±0.5e, ±1.0e, ±1.5e) and in-service verification (±1.0e, ±2.0e, ±3.0e).' },
      { title: 'Environmental & Temperature Testing', desc: 'Specified operating temperature ranges (-10°C to +40°C) and immunity to electromagnetic interference.' },
      { title: 'Standard Test Weights', desc: 'High-precision Class E2, F1, F2, M1, and M2 standard test weights calibrated periodically against primary reference standards.' },
    ],
  },
  models: {
    title: 'Model Approval Guidelines (Form LM-MOD)',
    badge: 'Pattern Approval',
    summary: 'Under Section 22 of the Act, every manufacturer or importer must obtain National Model Approval before marketing any weighing instrument in India.',
    points: [
      { title: 'Laboratory Pattern Evaluation', desc: 'Comprehensive destructive and environmental testing conducted at RRSL or NPL India.' },
      { title: 'Certificate of Approval', desc: 'Formal statutory approval issued with unique model registration code.' },
      { title: 'Indelible Markings', desc: 'Model approval number and Max/Min/e parameters must be permanently embossed on the device nameplate.' },
    ],
    actionLabel: 'New Establishment Registration',
    actionType: 'register',
  },
  fees: {
    title: 'Statutory Verification Fee Schedules & Tariffs',
    badge: 'First Schedule Tariff',
    summary: 'Standardized statutory verification and stamping fees payable to the Consolidated State Fund under the First Schedule of Legal Metrology (General) Rules, 2011.',
    points: [
      { title: 'Class I & II Precision Analytical Balances', desc: '₹1,000 – ₹2,500 per instrument verification cycle.' },
      { title: 'Class III Commercial Counter & Platform Scales', desc: '₹200 – ₹500 for retail balances; ₹1,500 – ₹5,000 for platform machines & weighbridges.' },
      { title: 'Digital Payment Reconciliation', desc: 'All fee receipts are reconciled directly via integrated Treasury Cyber-Treasury / Bharatkosh portals.' },
    ],
  },
  'gatc-info': {
    title: 'Government Approved Test Centers (GATC)',
    badge: 'Accredited Centers',
    summary: 'GATCs are specialized testing laboratories authorized under the Legal Metrology (Government Approved Test Centre) Rules, 2013 to perform verification testing on behalf of the Government.',
    points: [
      { title: 'Accreditation Standards', desc: 'ISO/IEC 17025 accredited facilities with calibrated Class F/M standard mass sets.' },
      { title: 'Authorized Verification Scope', desc: 'Competency to conduct verification testing for specified Class II & III weighing instruments.' },
      { title: 'Supervisory LMO Oversight', desc: 'All GATC test observation logs and draft records are scrutinized and counter-signed by jurisdictional LMOs.' },
    ],
  },
  'contact-hq': {
    title: 'Directorate Headquarters (Krishi Bhawan)',
    badge: 'Central Headquarters',
    summary: 'Official headquarters of the Legal Metrology Division, Department of Consumer Affairs, Government of India.',
    points: [
      { title: 'Postal Address', desc: 'Room No. 461-A, Krishi Bhawan, Dr. Rajendra Prasad Road, New Delhi – 110001.' },
      { title: 'Email Helpline', desc: 'dir-lm-ca@gov.in | helpdesk-metrology@gov.in' },
      { title: 'Helpline Telephone', desc: '+91-11-2338-9411 / +91-11-2338-9412' },
      { title: 'Public Working Hours', desc: '09:00 AM – 05:30 PM (Monday to Friday, Gazetted Working Days)' },
    ],
  },
  'contact-states': {
    title: 'State Controllers Directory (36 States & UTs)',
    badge: 'State Directorate Network',
    summary: 'State Controller offices administer local field inspections, stamping schedules, and trader licensing across all districts.',
    points: [
      { title: 'Delhi Controller Office', desc: 'C-Block, Vikas Bhawan, I.P. Estate, New Delhi – 110002 | Email: clm-delhi@nic.in' },
      { title: 'Maharashtra Controller Office', desc: 'DD Building, Old Custom House, Fort, Mumbai – 400001 | Email: clm-mumbai@mah.gov.in' },
      { title: 'Karnataka Controller Office', desc: 'Ali Asker Road, Vasanth Nagar, Bengaluru – 560052 | Email: clm-kar@nic.in' },
      { title: 'Tamil Nadu Controller Office', desc: 'D.M.S. Complex, Anna Salai, Chennai – 600006 | Email: clm-tn@nic.in' },
    ],
  },
  helpline: {
    title: 'National Consumer Helpline (NCH) & Grievances',
    badge: 'Citizen Consumer Portal',
    summary: '24x7 National citizen helpline for registering grievances regarding under-weighing, unverified commercial scales, broken stamping seals, or overcharging.',
    points: [
      { title: 'National Toll-Free Helpline', desc: 'Dial 1915 or 1800-11-4000 (Available in 17 Indian Languages)' },
      { title: 'SMS Grievance Service', desc: 'Send SMS to 8800001915 with complaint summary.' },
      { title: 'Online Grievance Web Portal', desc: 'File formal complaints directly at https://consumerhelpline.gov.in' },
      { title: 'Mobile Applications', desc: 'NCH Mobile App & INGRAM Citizen Portal (Android & iOS)' },
    ],
  },
  gazette: {
    title: 'Gazette Notifications & Statutory Orders',
    badge: 'Official Gazette Archive',
    summary: 'Official Gazette of India notifications and statutory amendment orders under The Legal Metrology Act.',
    points: [
      { title: 'G.S.R. 71(E) — Legal Metrology General Rules', desc: 'Master notification governing all verification procedures, tolerances, and inspection fees.' },
      { title: 'G.S.R. 175(E) — Approval of Models Rules', desc: 'Prescribes statutory evaluation protocols for new instrument models.' },
      { title: 'G.S.R. 492(E) — Mandatory Digital QR Certification', desc: 'Notifies the rollout of centralized online verification and QR certificate validation.' },
    ],
  },
  circulars: {
    title: 'Statutory Verification Circulars & Advisories',
    badge: 'Directorate Circulars',
    summary: 'Operational guidelines and enforcement circulars issued by the Central Directorate to State Controllers.',
    points: [
      { title: 'Circular 04/2026: Mandatory Digital Verification', desc: 'Instruction for zero-paper verification recording and real-time physical stamp reconciliation.' },
      { title: 'Circular 11/2025: Tamper-Evident Lead & Laser Seals', desc: 'Strict guidelines on serialized seal reconciliation in inspector field books.' },
      { title: 'Circular 07/2024: Periodic Verification Cycles', desc: 'Standard operating procedure for timely intimation and automated SMS/email reminders to traders.' },
    ],
  },
  reports: {
    title: 'Annual Metrology Administration Reports',
    badge: 'Annual Publications',
    summary: 'Comprehensive performance and statistical reports on metrological enforcement across India.',
    points: [
      { title: 'National Instrument Coverage', desc: 'Over 4.8 crore commercial weighing instruments verified across 36 States/UTs.' },
      { title: 'Citizen Charter Turnaround', desc: '99.4% of scheduled verification applications completed within statutory SLA.' },
      { title: 'Treasury Revenue Reconciled', desc: '₹380+ crores in statutory verification fees remitted electronically to State exchequers.' },
    ],
  },
  faq: {
    title: 'Frequently Asked Questions (Metrology Compliance FAQs)',
    badge: 'Help & FAQs',
    summary: 'Clear answers to common questions about statutory scale verification, renewal periods, and digital certificates under the Legal Metrology Act.',
    points: [
      { title: 'Q1: Who is required to get weighing instruments verified?', desc: 'Every commercial establishment, merchant, retailer, wholesale trader, industrial unit, or laboratory using weighing instruments in commercial transactions must get them verified under Section 24.' },
      { title: 'Q2: What is the standard re-verification renewal period?', desc: 'General commercial scales must be re-verified every 12 months. Storage tanks and pipeline flow meters must be verified every 24 months.' },
      { title: 'Q3: What proves that a commercial scale is legally verified?', desc: 'Two elements: (1) An official physical stamp/seal applied on the instrument by the LMO, and (2) A valid digital Certificate of Verification issued on this portal with a verifiable QR code.' },
      { title: 'Q4: How can a consumer or trader verify a certificate on the spot?', desc: 'Scan the QR code on the physical certificate with any smartphone camera or enter the certificate token in the "Verify Public QR" tool on this portal.' },
      { title: 'Q5: What happens if a scale is used without verification?', desc: 'Using an unverified or unstamped scale is a punishable statutory offence under Section 33 with fines up to ₹25,000 and potential seizure of the instrument.' },
    ],
    actionLabel: 'Verify Certificate via Public QR',
    actionType: 'public',
  },
};

interface DemoRoleOption {
  id: string;
  name: string;
  category: string;
  email: string;
  password: string;
  badge: string;
  description: string;
}

const DEMO_ROLES: DemoRoleOption[] = [
  {
    id: 'trader',
    name: 'Commercial Trader / Establishment Applicant',
    category: 'Owner / Applicant Persona',
    email: 'trader@example.com',
    password: 'Trader@2026',
    badge: 'Applicant',
    description: 'For new establishment registration, weighing machine registration, and statutory verification.',
  },
  {
    id: 'lmo',
    name: 'Legal Metrology Officer (LMO)',
    category: 'Enforcement / Field Inspector',
    email: 'lmo.delhi@gov.in',
    password: 'Officer@2026',
    badge: 'Officer',
    description: 'Statutory verification, NAWI test observation, stamping & seal records',
  },
  {
    id: 'supervisor',
    name: 'Supervisor / SLA Manager',
    category: 'Executive Oversight',
    email: 'supervisor.delhi@gov.in',
    password: 'Supervisor@2026',
    badge: 'Supervisor',
    description: 'Pendency analysis, SLA monitoring, revenue reconciliation & audit logs',
  },
  {
    id: 'admin',
    name: 'System Administrator',
    category: 'Governance & Security',
    email: 'admin.delhi@gov.in',
    password: 'Admin@2026',
    badge: 'Admin',
    description: 'Platform configuration, jurisdiction management & security controls',
  },
  {
    id: 'gatc',
    name: 'GATC Testing Center Verifier',
    category: 'Laboratory Testing',
    email: 'gatc.delhi@gov.in',
    password: 'GATC@2026',
    badge: 'GATC Lab',
    description: 'Government Approved Test Center laboratory testing & verification',
  },
];

// Visible roles in the Demo User selector dropdown (Admin removed, ordered: LMO -> Supervisor -> GATC -> Applicant)
const DEMO_MENU_ROLES: DemoRoleOption[] = [
  DEMO_ROLES[1], // Legal Metrology Officer (LMO)
  DEMO_ROLES[2], // Supervisor / SLA Manager
  DEMO_ROLES[4], // GATC Testing Center Verifier
  DEMO_ROLES[0], // Commercial Trader / Establishment Applicant
];

export type NavSection = 'home' | 'about' | 'information' | 'eservices' | 'faq' | 'contact' | 'archive';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [authenticatingRoleId, setAuthenticatingRoleId] = useState<string | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Section Navigation States (Pure Section Tabs - No Dropdowns)
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [aboutSubtopic, setAboutSubtopic] = useState<'overview' | 'acts' | 'rules' | 'org'>('overview');
  const [infoSubtopic, setInfoSubtopic] = useState<'standards' | 'models' | 'fees' | 'gatc-info'>('standards');
  const [contactSubtopic, setContactSubtopic] = useState<'contact-hq' | 'contact-states' | 'helpline'>('contact-hq');
  const [archiveSubtopic, setArchiveSubtopic] = useState<'gazette' | 'circulars' | 'reports'>('gazette');

  const demoMenuRef = useRef<HTMLDivElement>(null);

  // Close demo menu on outside click and Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDemoMenuOpen(false);
      }
    };
    const handleOutsideClick = (e: MouseEvent) => {
      if (demoMenuRef.current && !demoMenuRef.current.contains(e.target as Node)) {
        setDemoMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t.loginRequired || 'Email and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loginError || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSelect = async (role: DemoRoleOption) => {
    setError(null);
    setAuthenticatingRoleId(role.id);
    setEmail(role.email);
    setPassword(role.password);
    try {
      await login(role.email, role.password);
      setDemoMenuOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign-in failed.');
    } finally {
      setAuthenticatingRoleId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/90 text-slate-900 selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* 1. TOP GOVERNMENT IDENTITY BAR (Official Government of India Masthead Strip) */}
      <div className="bg-[#F3F5F7] border-b border-[#CBD5E1] px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-3">
          {/* LEFT: Official State Emblem of India + Institutional Hierarchy */}
          <div className="flex items-center gap-3 self-start md:self-center">
            {/* State Emblem of India (Ashoka Lion Capital) */}
            <img
              src="/emblem-of-india.svg"
              alt="State Emblem of India"
              title="State Emblem of India - Satyameva Jayate"
              className="h-12 sm:h-14 w-auto object-contain shrink-0"
              width="40"
              height="60"
            />
            <div className="h-9 w-px bg-[#CBD5E1] hidden sm:block shrink-0" aria-hidden="true" />
            <div className="text-left leading-tight font-sans">
              <div className="text-[15px] sm:text-[16px] font-semibold text-[#0F2D46] tracking-tight">
                Government of India
              </div>
              <div className="text-[13px] sm:text-[14px] font-medium text-[#172B4D]">
                Ministry of Consumer Affairs, Food &amp; Public Distribution
              </div>
              <div className="text-[12px] sm:text-[13px] font-normal text-[#475569]">
                Department of Legal Metrology
              </div>
            </div>
          </div>

          {/* RIGHT: Institutional Alignment, Accessibility & Language Switcher */}
          <div className="flex items-center gap-3 text-xs text-[#475569] shrink-0 self-end md:self-center">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-[#1F4FA3] font-medium">
              <Shield className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>NIC / MeitY Aligned</span>
            </span>
            <span className="text-[#CBD5E1] hidden sm:inline" aria-hidden="true">|</span>
            <div className="flex items-center gap-1 text-xs text-[#172B4D] font-mono" aria-label="Font size controls">
              <button
                type="button"
                className="cursor-pointer hover:text-[#0F2D46] px-1 py-0.5"
                title="Decrease font size"
              >
                A-
              </button>
              <button
                type="button"
                className="cursor-pointer hover:text-[#0F2D46] px-1 py-0.5 font-bold"
                title="Default font size"
              >
                A
              </button>
              <button
                type="button"
                className="cursor-pointer hover:text-[#0F2D46] px-1 py-0.5"
                title="Increase font size"
              >
                A+
              </button>
            </div>
            <span className="text-[#CBD5E1]" aria-hidden="true">|</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
                className="px-2 py-0.5 text-[#0F2D46] text-xs font-bold hover:underline transition-colors cursor-pointer"
                aria-label="Switch portal language"
              >
                {language === 'en' ? 'हिन्दी (HI)' : 'ENGLISH (EN)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN BRAND & SERVICE IDENTIFIER (Sticky Header) */}
      <header className="bg-white border-b border-[#CBD5E1] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 lg:gap-6">
            
            {/* LEFT: e-Metrology Service Identity */}
            <div className="flex items-center gap-3.5 shrink-0 self-start md:self-auto">
              <div className="w-11 h-11 rounded border border-[#1F4FA3]/30 bg-[#F3F5F7] flex items-center justify-center shrink-0">
                <Scale className="h-6 w-6 text-[#1F4FA3]" />
              </div>
              <div className="text-left leading-tight font-sans">
                <div className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#0F2D46] leading-none">
                  e-Metrology
                </div>
                <div className="text-[13px] sm:text-[14px] font-semibold text-[#1F4FA3] mt-1">
                  National Legal Metrology Verification System
                </div>
                <div className="text-[12px] text-[#475569] font-normal hidden sm:block mt-0.5">
                  Statutory Portal under The Legal Metrology Act, 2009 &amp; General Rules, 2011
                </div>
              </div>
            </div>

            {/* RIGHT: Institutional Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto select-none">
              {/* New Registration Button */}
              <button
                type="button"
                onClick={() => setIsRegisterOpen(true)}
                className="h-10 px-4 rounded border border-[#B45309] bg-[#F4B41A] hover:bg-[#D97706] text-[#0F2D46] text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                title="Register New Commercial Establishment"
              >
                <UserPlus className="w-4 h-4 text-[#0F2D46] shrink-0" />
                <span>New Registration</span>
              </button>

              {/* Enter as Demo User Button + Role Switcher */}
              <div className="relative inline-flex items-center rounded" ref={demoMenuRef}>
                <button
                  type="button"
                  disabled={authenticatingRoleId !== null}
                  onClick={() => handleDemoSelect(DEMO_ROLES[0])}
                  className="h-10 px-3.5 sm:px-4 rounded-l border border-[#CBD5E1] bg-white hover:bg-[#F3F5F7] text-[#0F2D46] font-bold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer"
                  title="Direct 1-click login as Demo Trader"
                >
                  {authenticatingRoleId === 'trader' ? (
                    <Loader2 className="w-4 h-4 text-[#1F4FA3] animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-[#1F4FA3]" />
                  )}
                  <span>Enter as Demo User</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDemoMenuOpen(!demoMenuOpen)}
                  className="h-10 px-2.5 rounded-r border border-l-0 border-[#CBD5E1] bg-white hover:bg-[#F3F5F7] text-[#0F2D46] font-bold transition-colors flex items-center justify-center cursor-pointer"
                  aria-expanded={demoMenuOpen}
                  aria-haspopup="true"
                  title="Choose other stakeholder roles (Officer, Supervisor, GATC, Applicant)"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${demoMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu for Demo Roles */}
                {demoMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 bg-white rounded-md shadow-xl border border-[#CBD5E1] text-slate-900 py-2 z-50 animate-fade-in text-left">
                    <div className="px-4 py-2 border-b border-[#CBD5E1] bg-[#F3F5F7]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0F2D46] uppercase tracking-wider">
                          Select Stakeholder Role
                        </span>
                        <span className="text-xs font-bold text-[#0F2D46] bg-[#F4B41A]/30 border border-[#F4B41A] px-2 py-0.5 rounded">
                          1-Click Direct Entry
                        </span>
                      </div>
                      <p className="text-xs text-[#475569] mt-0.5">
                        Click any role to enter the portal immediately:
                      </p>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto p-1.5 space-y-1">
                      {DEMO_MENU_ROLES.map((role) => {
                        const isThisRoleAuthenticating = authenticatingRoleId === role.id;
                        return (
                          <button
                            key={role.id}
                            type="button"
                            disabled={authenticatingRoleId !== null}
                            onClick={() => handleDemoSelect(role)}
                            className="w-full text-left p-2 rounded-sm hover:bg-[#F3F5F7] border border-transparent hover:border-[#CBD5E1] transition-all flex items-start justify-between gap-2.5 group cursor-pointer disabled:opacity-60"
                          >
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-800 group-hover:text-[#0F2D46]">
                                  {role.name}
                                </span>
                                <span className="text-xs font-semibold text-[#0F2D46] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                                  {role.badge}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate">{role.description}</p>
                              <div className="text-xs font-mono text-slate-400 flex items-center gap-2 pt-0.5">
                                <span>{role.email}</span>
                              </div>
                            </div>
                            <div className="shrink-0 pt-1">
                              {isThisRoleAuthenticating ? (
                                <Loader2 className="w-4 h-4 text-[#1F4FA3] animate-spin" />
                              ) : (
                                <span className="text-xs font-bold text-[#0F2D46] bg-[#F4B41A] border border-[#B45309] px-2 py-0.5 rounded group-hover:bg-[#D97706] transition-colors">
                                  Enter Portal →
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="px-4 py-2 border-t border-[#CBD5E1] bg-[#F3F5F7] text-xs text-slate-600 flex items-center justify-between">
                      <span>Clicking any role redirects inside</span>
                      <button
                        type="button"
                        onClick={() => setDemoMenuOpen(false)}
                        className="text-[#0F2D46] hover:underline font-bold cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* 3. LAYER 3: CONVENTIONAL GOVERNMENT-PORTAL NAVIGATION STRIP (GIGW-STYLE FLAT TABS) */}
        <div className="bg-[#0F2D46] text-white select-none border-t border-[#091E2F]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center flex-wrap lg:flex-nowrap" aria-label="Portal Primary Navigation">
              {/* Home */}
              <button
                type="button"
                onClick={() => {
                  setActiveSection('home');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`h-11 px-4 sm:px-5 text-[14px] sm:text-[15px] font-medium flex items-center border-b-2 transition-colors cursor-pointer shrink-0 ${
                  activeSection === 'home'
                    ? 'bg-[#1F4FA3] text-white border-[#F4B41A] font-semibold'
                    : 'text-slate-100 hover:bg-[#123A5A] hover:text-white border-transparent'
                }`}
              >
                <span>Home</span>
              </button>

              {/* About Us */}
              <button
                type="button"
                onClick={() => {
                  setActiveSection('about');
                  setAboutSubtopic('overview');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`h-11 px-3.5 sm:px-4 text-[14px] sm:text-[15px] font-medium flex items-center border-b-2 transition-colors cursor-pointer shrink-0 ${
                  activeSection === 'about'
                    ? 'bg-[#1F4FA3] text-white border-[#F4B41A] font-semibold'
                    : 'text-slate-100 hover:bg-[#123A5A] hover:text-white border-transparent'
                }`}
              >
                <span>About Us</span>
              </button>

              {/* Information */}
              <button
                type="button"
                onClick={() => {
                  setActiveSection('information');
                  setInfoSubtopic('standards');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`h-11 px-3.5 sm:px-4 text-[14px] sm:text-[15px] font-medium flex items-center border-b-2 transition-colors cursor-pointer shrink-0 ${
                  activeSection === 'information'
                    ? 'bg-[#1F4FA3] text-white border-[#F4B41A] font-semibold'
                    : 'text-slate-100 hover:bg-[#123A5A] hover:text-white border-transparent'
                }`}
              >
                <span>Information</span>
              </button>

              {/* e-Services */}
              <button
                type="button"
                onClick={() => {
                  setActiveSection('eservices');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`h-11 px-3.5 sm:px-4 text-[14px] sm:text-[15px] font-medium flex items-center border-b-2 transition-colors cursor-pointer shrink-0 ${
                  activeSection === 'eservices'
                    ? 'bg-[#1F4FA3] text-white border-[#F4B41A] font-semibold'
                    : 'text-slate-100 hover:bg-[#123A5A] hover:text-white border-transparent'
                }`}
              >
                <span>e-Services</span>
              </button>

              {/* FAQ */}
              <button
                type="button"
                onClick={() => {
                  setActiveSection('faq');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`h-11 px-3.5 sm:px-4 text-[14px] sm:text-[15px] font-medium flex items-center border-b-2 transition-colors cursor-pointer shrink-0 ${
                  activeSection === 'faq'
                    ? 'bg-[#1F4FA3] text-white border-[#F4B41A] font-semibold'
                    : 'text-slate-100 hover:bg-[#123A5A] hover:text-white border-transparent'
                }`}
              >
                <span>FAQ</span>
              </button>

              {/* Contact Us */}
              <button
                type="button"
                onClick={() => {
                  setActiveSection('contact');
                  setContactSubtopic('contact-hq');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`h-11 px-3.5 sm:px-4 text-[14px] sm:text-[15px] font-medium flex items-center border-b-2 transition-colors cursor-pointer shrink-0 ${
                  activeSection === 'contact'
                    ? 'bg-[#1F4FA3] text-white border-[#F4B41A] font-semibold'
                    : 'text-slate-100 hover:bg-[#123A5A] hover:text-white border-transparent'
                }`}
              >
                <span>Contact Us</span>
              </button>

              {/* Archive */}
              <button
                type="button"
                onClick={() => {
                  setActiveSection('archive');
                  setArchiveSubtopic('gazette');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`h-11 px-3.5 sm:px-4 text-[14px] sm:text-[15px] font-medium flex items-center border-b-2 transition-colors cursor-pointer shrink-0 ${
                  activeSection === 'archive'
                    ? 'bg-[#1F4FA3] text-white border-[#F4B41A] font-semibold'
                    : 'text-slate-100 hover:bg-[#123A5A] hover:text-white border-transparent'
                }`}
              >
                <span>Archive</span>
              </button>

              {/* Verify Public QR — Dedicated Public Service Link */}
              <a
                href="#public"
                onClick={() => {
                  window.location.hash = '#public';
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }}
                className="h-11 px-4 sm:px-5 text-[14px] sm:text-[15px] font-semibold text-[#F4B41A] hover:text-white hover:bg-[#123A5A] transition-colors flex items-center gap-1.5 ml-auto cursor-pointer border-b-2 border-transparent"
                title="Verify genuine scale digital certificates with Zero-PII QR scan"
              >
                <QrCode className="w-4 h-4 text-[#F4B41A]" />
                <span>Verify Public QR</span>
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* 3. Main Portal Body Layout (Disciplined 2-Column Government Grid) */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex items-start justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Dynamically Switchable Government Content Section */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* SECTION 1: HOME */}
            {activeSection === 'home' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-gov-navy/5 border border-gov-navy/10 text-gov-navy text-xs font-semibold mb-2">
                    <Shield className="w-3.5 h-3.5 text-gov-blue" />
                    <span>Statutory Digital Metrology Service • Government of India</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gov-navy tracking-tight leading-snug">
                    National Legal Metrology Digital Verification &amp; Certification
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    Unified statutory platform for periodic verification, calibration recording, physical stamping ledger, and cryptographic digital certification under <strong className="text-slate-800">The Legal Metrology Act, 2009</strong> and <strong className="text-slate-800">The Legal Metrology (General) Rules, 2011</strong>.
                  </p>
                </div>

                {/* OFFICIAL PUBLIC QR SERVICE PANEL */}
                <div className="bg-white border-l-4 border-l-gov-blue border-y border-r border-slate-200 rounded-r p-5 shadow-card space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-gov-blue uppercase tracking-wider">
                        Public Service Directive
                      </span>
                      <h3 className="text-base font-bold text-gov-navy leading-tight">
                        Public Scale Certificate Verification (Zero-PII QR)
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Citizens, commercial traders, and enforcement officers can instantly verify genuine digital verification certificates, calibration validity, and physical stamp ledgers without login.
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 text-gov-navy">
                      <QrCode className="w-5 h-5 text-gov-blue" />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                    <a
                      href="#public"
                      onClick={() => {
                        window.location.hash = '#public';
                        window.dispatchEvent(new HashChangeEvent('hashchange'));
                      }}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-gov-navy hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-card cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>Verify Certificate via Public QR →</span>
                    </a>
                    <span className="text-xs text-slate-400">
                      Statutory record lookup under Section 24
                    </span>
                  </div>
                </div>

                {/* MANDATORY COMPLIANCE DIRECTIVES */}
                <div className="bg-white border border-slate-200 rounded p-5 shadow-card space-y-3.5">
                  <div className="border-b border-slate-200 pb-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Mandatory Metrological Compliance Directives
                    </h3>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs text-slate-600">
                    <div className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-800 block">Section 24 Mandatory Periodic Verification</span>
                          <span className="text-slate-500">Commercial weighing instruments (Class I, II, III, IV) must be submitted for statutory verification within prescribed periods.</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRegisterOpen(true)}
                        className="shrink-0 text-xs font-semibold text-gov-blue hover:underline pt-0.5 cursor-pointer"
                      >
                        Apply →
                      </button>
                    </div>

                    <div className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-800 block">Immutable Digital Certificates</span>
                          <span className="text-slate-500">Certificates are cryptographically hashed (SHA-256) and verified through zero-PII public QR references.</span>
                        </div>
                      </div>
                      <a
                        href="#public"
                        onClick={() => {
                          window.location.hash = '#public';
                          window.dispatchEvent(new HashChangeEvent('hashchange'));
                        }}
                        className="shrink-0 text-xs font-semibold text-gov-blue hover:underline pt-0.5 cursor-pointer"
                      >
                        Verify QR →
                      </a>
                    </div>

                    <div className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-800 block">Physical Stamping &amp; Seal Chain</span>
                          <span className="text-slate-500">Physical stamp impressions, laser markings, and security lead seals are reconciled against an active inspector inventory ledger.</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDemoSelect(DEMO_ROLES[1])}
                        className="shrink-0 text-xs font-semibold text-gov-blue hover:underline pt-0.5 cursor-pointer"
                      >
                        LMO Workspace →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Statutory Advisory Notice */}
                <div className="flex items-start gap-2 text-xs text-slate-500 px-1">
                  <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    Using unverified or non-standard weights &amp; measures is an offence under Section 30 of The Legal Metrology Act, 2009 punishable with fine and imprisonment.
                  </span>
                </div>
              </div>
            )}

            {/* SECTION 2: ABOUT US */}
            {activeSection === 'about' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-gov-navy/5 border border-gov-navy/10 text-gov-navy text-xs font-semibold mb-2">
                    <Building2 className="w-3.5 h-3.5 text-gov-blue" />
                    <span>Statutory Mandate • Directorate of Legal Metrology</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gov-navy tracking-tight leading-snug">
                    About Legal Metrology &amp; Verification Framework
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    Department of Consumer Affairs, Ministry of Consumer Affairs, Food &amp; Public Distribution, Government of India.
                  </p>
                </div>

                {/* Submenu Navigation Strip */}
                <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setAboutSubtopic('overview')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      aboutSubtopic === 'overview'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Overview &amp; Role
                  </button>
                  <button
                    type="button"
                    onClick={() => setAboutSubtopic('acts')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      aboutSubtopic === 'acts'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    The Legal Metrology Act, 2009
                  </button>
                  <button
                    type="button"
                    onClick={() => setAboutSubtopic('rules')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      aboutSubtopic === 'rules'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    General Rules, 2011 &amp; Amendments
                  </button>
                  <button
                    type="button"
                    onClick={() => setAboutSubtopic('org')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      aboutSubtopic === 'org'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Organizational Structure
                  </button>
                </div>

                {/* Selected Subtopic Detail Card */}
                {STATUTORY_TOPICS[aboutSubtopic === 'overview' ? 'about' : aboutSubtopic] && (
                  <div className="bg-white border border-slate-200 rounded p-5 shadow-card space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-gov-blue uppercase tracking-wider block">
                          {STATUTORY_TOPICS[aboutSubtopic === 'overview' ? 'about' : aboutSubtopic].badge}
                        </span>
                        <h3 className="text-base font-bold text-gov-navy">
                          {STATUTORY_TOPICS[aboutSubtopic === 'overview' ? 'about' : aboutSubtopic].title}
                        </h3>
                      </div>
                      <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-gov-navy shrink-0">
                        <BookOpen className="w-4 h-4 text-gov-blue" />
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-100">
                      {STATUTORY_TOPICS[aboutSubtopic === 'overview' ? 'about' : aboutSubtopic].summary}
                    </p>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        Statutory Provisions &amp; Implementation
                      </span>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded bg-white overflow-hidden">
                        {STATUTORY_TOPICS[aboutSubtopic === 'overview' ? 'about' : aboutSubtopic].points.map((pt, idx) => (
                          <div key={idx} className="p-3 flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-slate-800 block text-xs sm:text-sm">
                                {pt.title}
                              </span>
                              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                                {pt.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsRegisterOpen(true)}
                        className="px-3.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer border border-amber-500 shadow-card"
                      >
                        Register New Commercial Establishment (Form LM-REG-01) →
                      </button>
                      <a
                        href="#public"
                        onClick={() => {
                          window.location.hash = '#public';
                          window.dispatchEvent(new HashChangeEvent('hashchange'));
                        }}
                        className="text-xs font-semibold text-gov-blue hover:underline cursor-pointer"
                      >
                        Verify Scale Certificate →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 3: INFORMATION */}
            {activeSection === 'information' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-gov-navy/5 border border-gov-navy/10 text-gov-navy text-xs font-semibold mb-2">
                    <FileText className="w-3.5 h-3.5 text-gov-blue" />
                    <span>Technical Specifications &amp; Tariffs</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gov-navy tracking-tight leading-snug">
                    Standards, Model Approval Guidelines &amp; Fee Tariffs
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    Prescribed technical specifications, tolerance limits (MPE), and statutory verification tariffs.
                  </p>
                </div>

                {/* Submenu Navigation Strip */}
                <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setInfoSubtopic('standards')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      infoSubtopic === 'standards'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Verification Standards (OIML R 76-1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoSubtopic('models')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      infoSubtopic === 'models'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Model Approval (LM-MOD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoSubtopic('fees')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      infoSubtopic === 'fees'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Fee Schedules &amp; Tariffs
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoSubtopic('gatc-info')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      infoSubtopic === 'gatc-info'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    GATC Testing Laboratories
                  </button>
                </div>

                {/* Selected Subtopic Detail Card */}
                {STATUTORY_TOPICS[infoSubtopic] && (
                  <div className="bg-white border border-slate-200 rounded p-5 shadow-card space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-gov-blue uppercase tracking-wider block">
                          {STATUTORY_TOPICS[infoSubtopic].badge}
                        </span>
                        <h3 className="text-base font-bold text-gov-navy">
                          {STATUTORY_TOPICS[infoSubtopic].title}
                        </h3>
                      </div>
                      <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-gov-navy shrink-0">
                        <Scale className="w-4 h-4 text-gov-blue" />
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-100">
                      {STATUTORY_TOPICS[infoSubtopic].summary}
                    </p>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        Technical Directives &amp; Schedules
                      </span>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded bg-white overflow-hidden">
                        {STATUTORY_TOPICS[infoSubtopic].points.map((pt, idx) => (
                          <div key={idx} className="p-3 flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-slate-800 block text-xs sm:text-sm">
                                {pt.title}
                              </span>
                              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                                {pt.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsRegisterOpen(true)}
                        className="px-3.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer border border-amber-500 shadow-card"
                      >
                        Submit Verification Application →
                      </button>
                      <span className="text-xs text-slate-400">
                        Under Legal Metrology (General) Rules, 2011
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 4: E-SERVICES */}
            {activeSection === 'eservices' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-gov-navy/5 border border-gov-navy/10 text-gov-navy text-xs font-semibold mb-2">
                    <UserCheck className="w-3.5 h-3.5 text-gov-blue" />
                    <span>Citizen &amp; Trader Portal</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gov-navy tracking-tight leading-snug">
                    Statutory Metrological Online Services
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    End-to-end digital services for commercial scale registration, periodic verification scheduling, and QR certification.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Service 1 */}
                  <div className="bg-white border border-slate-200 rounded p-4 shadow-card flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-xs uppercase">Form LM-REG-01</span>
                        <h3 className="font-bold text-sm text-gov-navy">Establishment &amp; Weighing Scale Registration</h3>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Mandatory digital registration of retail shops, mandis, factories, and commercial scale units under Rule 11.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRegisterOpen(true)}
                      className="px-3.5 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shrink-0 transition-colors cursor-pointer border border-amber-500 shadow-card"
                    >
                      Register Now →
                    </button>
                  </div>

                  {/* Service 2 */}
                  <div className="bg-white border border-slate-200 rounded p-4 shadow-card flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-xs uppercase">Section 24</span>
                        <h3 className="font-bold text-sm text-gov-navy">Mandatory Periodic Scale Verification</h3>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Apply for annual scale verification, NAWI eccentricity/repeatability testing, and stamping by authorized LMOs.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRegisterOpen(true)}
                      className="px-3.5 py-2 rounded bg-gov-navy hover:bg-slate-800 text-white font-semibold text-xs shrink-0 transition-colors cursor-pointer shadow-card"
                    >
                      Apply for Verification →
                    </button>
                  </div>

                  {/* Service 3 */}
                  <div className="bg-white border border-slate-200 rounded p-4 shadow-card flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-xs uppercase">Zero-PII</span>
                        <h3 className="font-bold text-sm text-gov-navy">Zero-PII Public QR Certificate Verification</h3>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Verify authentic cryptographic digital verification certificates, calibration status, and physical stamp ledgers without login.
                      </p>
                    </div>
                    <a
                      href="#public"
                      onClick={() => {
                        window.location.hash = '#public';
                        window.dispatchEvent(new HashChangeEvent('hashchange'));
                      }}
                      className="px-3.5 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shrink-0 transition-colors cursor-pointer shadow-card flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Verify Public QR →</span>
                    </a>
                  </div>

                  {/* Service 4 */}
                  <div className="bg-white border border-slate-200 rounded p-4 shadow-card flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-xs uppercase">Field Inspection</span>
                        <h3 className="font-bold text-sm text-gov-navy">Physical Stamping &amp; Inspector Inventory Ledger</h3>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Authorized LMOs and GATCs record physical punch impressions, serialized lead seals, and laser barcodes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDemoSelect(DEMO_ROLES[1])}
                      className="px-3.5 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs shrink-0 transition-colors cursor-pointer"
                    >
                      Officer Sign In →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 5: FAQ */}
            {activeSection === 'faq' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-gov-navy/5 border border-gov-navy/10 text-gov-navy text-xs font-semibold mb-2">
                    <HelpCircle className="w-3.5 h-3.5 text-gov-blue" />
                    <span>Compliance Guidance &amp; Citizen FAQs</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gov-navy tracking-tight leading-snug">
                    Frequently Asked Questions (Legal Metrology Compliance)
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    Official guidance on periodic verification cycles, certificate validation, and statutory penalty avoidance.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded p-5 shadow-card space-y-3">
                  <div className="divide-y divide-slate-100">
                    {STATUTORY_TOPICS.faq.points.map((pt, idx) => (
                      <div key={idx} className="py-3 first:pt-0 last:pb-0 space-y-1">
                        <span className="font-bold text-slate-800 text-xs sm:text-sm block">
                          {pt.title}
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {pt.desc}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                    <a
                      href="#public"
                      onClick={() => {
                        window.location.hash = '#public';
                        window.dispatchEvent(new HashChangeEvent('hashchange'));
                      }}
                      className="px-3.5 py-1.5 rounded bg-gov-navy hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-card flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>Verify Certificate via Public QR →</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setIsRegisterOpen(true)}
                      className="text-xs font-semibold text-gov-blue hover:underline cursor-pointer"
                    >
                      Register New Establishment →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 6: CONTACT US */}
            {activeSection === 'contact' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-gov-navy/5 border border-gov-navy/10 text-gov-navy text-xs font-semibold mb-2">
                    <Phone className="w-3.5 h-3.5 text-gov-blue" />
                    <span>Official Directories &amp; Helplines</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gov-navy tracking-tight leading-snug">
                    National Legal Metrology Directory &amp; Consumer Support
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    Official contact channels for Central Directorate, State Controllers, and 24x7 National Consumer Helpline.
                  </p>
                </div>

                {/* Submenu Navigation Strip */}
                <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setContactSubtopic('contact-hq')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      contactSubtopic === 'contact-hq'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Directorate HQ (Krishi Bhawan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactSubtopic('contact-states')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      contactSubtopic === 'contact-states'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    State Controllers Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactSubtopic('helpline')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      contactSubtopic === 'helpline'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    National Consumer Helpline (1915)
                  </button>
                </div>

                {/* Selected Subtopic Detail Card */}
                {STATUTORY_TOPICS[contactSubtopic] && (
                  <div className="bg-white border border-slate-200 rounded p-5 shadow-card space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-gov-blue uppercase tracking-wider block">
                          {STATUTORY_TOPICS[contactSubtopic].badge}
                        </span>
                        <h3 className="text-base font-bold text-gov-navy">
                          {STATUTORY_TOPICS[contactSubtopic].title}
                        </h3>
                      </div>
                      <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-gov-navy shrink-0">
                        <Phone className="w-4 h-4 text-gov-blue" />
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-100">
                      {STATUTORY_TOPICS[contactSubtopic].summary}
                    </p>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        Verified Contact Coordinates
                      </span>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded bg-white overflow-hidden">
                        {STATUTORY_TOPICS[contactSubtopic].points.map((pt, idx) => (
                          <div key={idx} className="p-3 flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-slate-800 block text-xs sm:text-sm">
                                {pt.title}
                              </span>
                              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                                {pt.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs text-slate-500">
                      <span>National Toll-Free Consumer Helpline: <strong>1915</strong></span>
                      <span>Working Hours: 09:00 AM – 05:30 PM</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 7: ARCHIVE */}
            {activeSection === 'archive' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-gov-navy/5 border border-gov-navy/10 text-gov-navy text-xs font-semibold mb-2">
                    <BookOpen className="w-3.5 h-3.5 text-gov-blue" />
                    <span>Public Records &amp; Gazette Archives</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gov-navy tracking-tight leading-snug">
                    Statutory Gazette Archive &amp; Directorate Circulars
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    Official gazetted notifications, subordinate legislation, and annual metrological administration reports.
                  </p>
                </div>

                {/* Submenu Navigation Strip */}
                <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setArchiveSubtopic('gazette')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      archiveSubtopic === 'gazette'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Gazette Notifications (2011–2026)
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchiveSubtopic('circulars')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      archiveSubtopic === 'circulars'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Statutory Circulars
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchiveSubtopic('reports')}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      archiveSubtopic === 'reports'
                        ? 'bg-gov-navy text-white shadow-card'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Annual Metrology Reports
                  </button>
                </div>

                {/* Selected Subtopic Detail Card */}
                {STATUTORY_TOPICS[archiveSubtopic] && (
                  <div className="bg-white border border-slate-200 rounded p-5 shadow-card space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-gov-blue uppercase tracking-wider block">
                          {STATUTORY_TOPICS[archiveSubtopic].badge}
                        </span>
                        <h3 className="text-base font-bold text-gov-navy">
                          {STATUTORY_TOPICS[archiveSubtopic].title}
                        </h3>
                      </div>
                      <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-gov-navy shrink-0">
                        <FileText className="w-4 h-4 text-gov-blue" />
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-100">
                      {STATUTORY_TOPICS[archiveSubtopic].summary}
                    </p>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        Gazetted Publications &amp; Directives
                      </span>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded bg-white overflow-hidden">
                        {STATUTORY_TOPICS[archiveSubtopic].points.map((pt, idx) => (
                          <div key={idx} className="p-3 flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-slate-800 block text-xs sm:text-sm">
                                {pt.title}
                              </span>
                              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                                {pt.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs text-slate-500">
                      <span>Department of Legal Metrology • Official Archives</span>
                      <a
                        href="#public"
                        onClick={() => {
                          window.location.hash = '#public';
                          window.dispatchEvent(new HashChangeEvent('hashchange'));
                        }}
                        className="font-semibold text-gov-blue hover:underline cursor-pointer"
                      >
                        Verify Scale Certificate →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right Column: Portal Authentication Container */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-white rounded border border-slate-200 shadow-card overflow-hidden">
              
              {/* Header */}
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gov-navy">{t.loginTitle}</h2>
                  <p className="text-xs text-slate-500">Authorized Stakeholder Sign In</p>
                </div>
                <div className="w-7 h-7 rounded bg-slate-200/70 flex items-center justify-center text-slate-700">
                  <Lock className="w-3.5 h-3.5 text-gov-navy" />
                </div>
              </div>

              {/* Form Body */}
              <div className="p-5 space-y-4">
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {/* Email Input */}
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.loginEmailLabel} <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue transition-colors"
                      placeholder="e.g. trader@example.com or officer@gov.in"
                      autoComplete="email"
                      autoFocus
                      required
                    />
                  </div>

                  {/* Password Input */}
                  <div>
                    <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.loginPasswordLabel} <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 pr-9 bg-white focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue transition-colors"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded focus:outline-none cursor-pointer"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Error Message Display */}
                  {error && (
                    <div className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 flex items-start gap-2" role="alert">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Primary Sign In Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded bg-gov-navy hover:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-card transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Authenticating Credentials...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t.loginButton}</span>
                      </>
                    )}
                  </button>
                </form>

                {/* 1-Click Quick Demo Sign-In Buttons */}
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-gov-navy uppercase tracking-wider block mb-1.5">
                    Quick Demo User Access (1-Click Entry)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDemoSelect(DEMO_ROLES[0])}
                      className="py-1.5 px-2 rounded bg-slate-100 hover:bg-amber-100 text-slate-800 font-semibold text-xs transition-colors border border-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <UserCheck className="w-3 h-3 text-amber-700 shrink-0" />
                      <span>Trader Portal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoSelect(DEMO_ROLES[1])}
                      className="py-1.5 px-2 rounded bg-slate-100 hover:bg-blue-100 text-slate-800 font-semibold text-xs transition-colors border border-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Shield className="w-3 h-3 text-gov-blue shrink-0" />
                      <span>LMO Officer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoSelect(DEMO_ROLES[2])}
                      className="py-1.5 px-2 rounded bg-slate-100 hover:bg-emerald-100 text-slate-800 font-semibold text-xs transition-colors border border-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Building2 className="w-3 h-3 text-emerald-700 shrink-0" />
                      <span>Supervisor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoSelect(DEMO_ROLES[3])}
                      className="py-1.5 px-2 rounded bg-slate-100 hover:bg-blue-100 text-slate-800 font-semibold text-xs transition-colors border border-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3 h-3 text-gov-blue shrink-0" />
                      <span>Admin Portal</span>
                    </button>
                  </div>
                </div>

                {/* Secondary Registration Section */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center space-y-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        New Commercial Establishment or Scale Owner?
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                        Register under The Legal Metrology Act to submit statutory scale verification applications.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRegisterOpen(true)}
                      className="w-full py-2 px-3 rounded bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-amber-500 shadow-card"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                      <span>Register New Establishment (Form LM-REG-01) →</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Security Advisory Footer */}
              <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
                <p>
                  Protected government system under the Information Technology Act, 2000 &amp; Section 25 of The Legal Metrology Act, 2009.
                </p>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* 4. Institutional Footer */}
      <footer className="bg-[#0F2D46] text-slate-300 text-xs border-t border-[#091E2F] py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="space-y-0.5 text-center sm:text-left">
            <div className="font-semibold text-white">© {new Date().getFullYear()} Department of Legal Metrology</div>
            <div className="text-slate-300">
              Ministry of Consumer Affairs, Food &amp; Public Distribution, Government of India
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-slate-300">
            <span>NIC / MeitY</span>
            <span aria-hidden="true">•</span>
            <span>Privacy Policy</span>
            <span aria-hidden="true">•</span>
            <span>Terms of Service</span>
            <span aria-hidden="true">•</span>
            <span>Accessibility</span>
            <span aria-hidden="true">•</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>

      {/* 5. Establishment Registration Modal */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
      />
    </div>
  );
};