import { StatutoryKnowledgeItem } from './types.js';

export const STATUTORY_CORPUS: StatutoryKnowledgeItem[] = [
  // --- 1. THE LEGAL METROLOGY ACT, 2009 ---
  {
    category: 'ACT',
    act_name: 'The Legal Metrology Act, 2009',
    section_rule_ref: 'Section 19',
    title: 'Verification and Stamping of Weight or Measure',
    citation_label: 'Legal Metrology Act 2009 § 19',
    keywords: ['verification', 'stamping', 'lmo', 'gatc', 'physical test', 'mandatory verification', 'inspection'],
    content: `Every person possessing, using, or intending to use any weight or measure in any commercial transaction or for industrial production or protection shall get such weight or measure verified and stamped by a Legal Metrology Officer (LMO) or at a Government Approved Test Centre (GATC) before putting it into use. No unverified or unstamped weight/measure may be used in trade or commerce.`,
    portal_action: {
      label: 'Apply for Verification',
      action_type: 'NAVIGATE',
      target_tab: 'trader',
      description: 'Submit an online verification application on the Trader Portal',
    },
  },
  {
    category: 'ACT',
    act_name: 'The Legal Metrology Act, 2009',
    section_rule_ref: 'Section 22',
    title: 'Mandatory Central Model Approval',
    citation_label: 'Legal Metrology Act 2009 § 22',
    keywords: ['model approval', 'certificate of approval', 'ind approval', 'manufacturer', 'importer', 'specifications'],
    content: `Every person manufacturing or importing any weight or measure must obtain prior Model Approval from the Central Government Directorate of Legal Metrology before marketing, selling, or distributing the instrument. The certificate of Model Approval assigns a statutory approval reference (e.g. IND/09/2026/XXX). Unapproved models cannot be legally verified, stamped, or sold in India.`,
    portal_action: {
      label: 'View Approved Models',
      action_type: 'NAVIGATE',
      target_tab: 'trader',
      description: 'Search the Government Approved Model Catalog',
    },
  },
  {
    category: 'ACT',
    act_name: 'The Legal Metrology Act, 2009',
    section_rule_ref: 'Section 24',
    title: 'Periodic Re-Verification and Deadlines',
    citation_label: 'Legal Metrology Act 2009 § 24',
    keywords: ['re-verification', 'renewal', 'expiry', 'validity', 'annual', 'biennial', 'due date', 'counter scale', 'weighbridge'],
    content: `Every weight or measure verified and stamped under this Act shall be re-verified at prescribed periodic intervals. Commercial Non-Automatic Weighing Instruments (NAWI) such as retail counter scales, platform scales, and electronic weighbridges are subject to mandatory periodic re-verification (typically 12 or 24 months as per state rules). Using an instrument past its validity expiry date constitutes a statutory offence under Section 30.`,
    portal_action: {
      label: 'Check Instrument Due Dates',
      action_type: 'NAVIGATE',
      target_tab: 'trader',
      description: 'View registered machines and verification validity in your Trader Dashboard',
    },
  },
  {
    category: 'PENALTIES_COMPOUNDING',
    act_name: 'The Legal Metrology Act, 2009',
    section_rule_ref: 'Section 30 & 33',
    title: 'Penalty for Using Unverified Weights & Measures',
    citation_label: 'Legal Metrology Act 2009 § 30 & 33',
    keywords: ['penalty', 'fine', 'prosecution', 'unverified', 'broken seal', 'tampering', 'compounding', 'seizure'],
    content: `Whoever uses any unverified or unstamped weight or measure in any commercial transaction shall be punished with a fine up to ₹10,000 for the first offence, and for a second or subsequent offence with imprisonment for a term which may extend to one year and with fine. Tampering with or altering an approved weight or measure attracts a fine up to ₹25,000 and possible prosecution. Most first-time non-fraudulent offences can be compounded under Section 48 upon payment of the compounding sum.`,
  },
  {
    category: 'PENALTIES_COMPOUNDING',
    act_name: 'The Legal Metrology Act, 2009',
    section_rule_ref: 'Section 48',
    title: 'Compounding of Offences',
    citation_label: 'Legal Metrology Act 2009 § 48',
    keywords: ['compounding', 'settlement', 'notice', 'lmo', 'controller', 'adjudication'],
    content: `Any offence punishable under the Act (other than repeated fraudulent offences) may, either before or after the institution of the prosecution, be compounded by the Controller or authorized Legal Metrology Officer on payment of such compounding sum as prescribed. On compounding, no further criminal proceedings are initiated against the person for that offence.`,
  },

  // --- 2. LEGAL METROLOGY (GENERAL) RULES, 2011 ---
  {
    category: 'GENERAL_RULES',
    act_name: 'Legal Metrology (General) Rules, 2011',
    section_rule_ref: 'Seventh Schedule & Rule 14',
    title: 'Non-Automatic Weighing Instruments (NAWI) Accuracy Classes',
    citation_label: 'General Rules 2011 Schedule VII',
    keywords: ['nawi', 'accuracy class', 'class i', 'class ii', 'class iii', 'class iiii', 'jewellery', 'commercial', 'industrial', 'weighbridge'],
    content: `Weighing instruments are classified into four accuracy classes:
- Class I (Special Accuracy): Ultra-precision micro/analytical laboratory balances (e ≤ 1 mg).
- Class II (High Accuracy): Jewellery, bullion, and pharmaceutical precision balances (e: 1 mg to 50 mg).
- Class III (Medium Accuracy): Commercial retail counter scales, grocery scales, platform machines, and weighbridges (e: 100 mg to 5 kg).
- Class IIII (Ordinary Accuracy): Coarse industrial and construction material scales.
Every scale must operate within the Maximum Permissible Error (MPE) specified for its accuracy class.`,
  },
  {
    category: 'GENERAL_RULES',
    act_name: 'Legal Metrology (General) Rules, 2011',
    section_rule_ref: 'Schedule VII, Table 1',
    title: 'Maximum Permissible Errors (MPE) on Verification',
    citation_label: 'General Rules 2011 Schedule VII Table 1',
    keywords: ['mpe', 'maximum permissible error', 'tolerance', 'error limit', 'initial verification', 're-verification', 'scale interval e'],
    content: `For Class III (Medium Accuracy) instruments:
- For loads from 0 to 500e: MPE is ±0.5e at initial verification / ±1.0e in service (re-verification).
- For loads from >500e to 2000e: MPE is ±1.0e at initial verification / ±2.0e in service.
- For loads >2000e: MPE is ±1.5e at initial verification / ±3.0e in service.
Example: On a 30 kg / 5 g retail scale (where e = 5 g), at a test load of 10 kg (2000e), the error must not exceed ±5 g on initial verification and ±10 g on re-verification.`,
  },
  {
    category: 'FEE_SCHEDULE',
    act_name: 'Legal Metrology (General) Rules, 2011',
    section_rule_ref: 'Twelfth Schedule',
    title: 'Statutory Verification & Stamping Fee Schedule',
    citation_label: 'General Rules 2011 Schedule XII',
    keywords: ['fee', 'verification fee', 'stamping fee', 'charges', 'cost', 'scale price', 'weighbridge fee'],
    content: `Statutory verification fees are determined by instrument capacity and service mode:
- Counter Scales & Balances (≤ 50 kg): ₹100 – ₹200.
- Platform Scales (50 kg to 500 kg): ₹200 – ₹500.
- Heavy Industrial Scales (500 kg to 5 tonne): ₹500 – ₹2,000.
- Electronic Weighbridges (10 tonne to 100 tonne): ₹3,000 – ₹5,000.
- Petrol/Diesel Fuel Dispensing Pumps: ₹1,000 per nozzle.
- Length Measures & Capacity Measures: ₹20 – ₹100.
Re-verification fees after repair or out-of-premises on-site inspection may include applicable departmental conveyance/inspector travel allowances.`,
    portal_action: {
      label: 'Estimate Verification Fee',
      action_type: 'NAVIGATE',
      target_tab: 'trader',
      description: 'Compute exact verification fees when creating an application',
    },
  },
  {
    category: 'GENERAL_RULES',
    act_name: 'Legal Metrology (General) Rules, 2011',
    section_rule_ref: 'Rule 27 & Schedule IX',
    title: 'Physical Stamping and Security Sealing Procedure',
    citation_label: 'General Rules 2011 Rule 27',
    keywords: ['stamp', 'seal', 'lead wire', 'hologram', 'tamper evident', 'physical mark', 'security seal'],
    content: `Upon successful verification, the Legal Metrology Officer (or GATC Assessor) must affix:
1. An official lead-wire or metallic seal passing through the calibration adjustment switch/housing to prevent unauthorized alteration.
2. A verification stamp/sticker indicating the year, quarter, and state code.
3. The digital certificate is issued following physical sealing and records the unique physical seal number (e.g. DL-SEAL-2026-XXXX). Breaking this seal invalidates the verification.`,
  },

  // --- 3. LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011 ---
  {
    category: 'PACKAGED_COMMODITIES',
    act_name: 'Legal Metrology (Packaged Commodities) Rules, 2011',
    section_rule_ref: 'Rule 6(1)',
    title: 'Mandatory Declarations on Pre-Packaged Goods',
    citation_label: 'Packaged Commodities Rules 2011 Rule 6(1)',
    keywords: ['packaged commodities', 'mandatory declarations', 'label', 'packaging', 'mrp', 'net quantity', 'manufacturer name', 'expiry', 'consumer care'],
    content: `Every package containing pre-packed commodities must prominently display:
1. Name and complete address of the Manufacturer / Packer / Importer.
2. Generic or common name of the commodity contained in the package.
3. Net quantity in standard units of weight (g/kg), volume (ml/L), or number.
4. Month and year of manufacture or packing or import.
5. Maximum Retail Price (MRP) in format: "MRP ₹ xx.xx (inclusive of all taxes)".
6. Unit Sale Price (USP) for packages containing more than 1 kg or 1 L.
7. Customer care contact details (Name, Address, Telephone number, and Email).
Failure to display these declarations is an offence punishable under Section 36.`,
  },
  {
    category: 'PACKAGED_COMMODITIES',
    act_name: 'Legal Metrology (Packaged Commodities) Rules, 2011',
    section_rule_ref: 'Rule 6(10) & E-Commerce Guidelines',
    title: 'Mandatory Declarations on E-Commerce Marketplaces',
    citation_label: 'Packaged Commodities Rules 2011 Rule 6(10)',
    keywords: ['e-commerce', 'online marketplace', 'amazon', 'flipkart', 'digital display', 'country of origin', 'mrp online'],
    content: `E-commerce entities displaying pre-packaged commodities for sale must display all mandatory declarations on the digital marketplace product page, including:
- Country of Origin.
- Name and address of the manufacturer/importer.
- Net quantity and Unit Sale Price.
- MRP (inclusive of all taxes).
- Expiry date / best before date where applicable.`,
  },
  {
    category: 'PACKAGED_COMMODITIES',
    act_name: 'Legal Metrology (Packaged Commodities) Rules, 2011',
    section_rule_ref: 'First Schedule',
    title: 'Maximum Permissible Error (MPE) in Net Quantity',
    citation_label: 'Packaged Commodities Rules 2011 Schedule I',
    keywords: ['net weight tolerance', 'underweight package', 'short delivery', 'net quantity mpe', 'pre-packaged tolerance'],
    content: `The actual net quantity in a package must not fall below the declared net quantity by more than the Maximum Permissible Error:
- Packages 50 g to 100 g: MPE is 4.5 g.
- Packages 100 g to 200 g: MPE is 4.5%.
- Packages 200 g to 300 g: MPE is 9 g.
- Packages 300 g to 500 g: MPE is 3%.
- Packages 500 g to 1 kg: MPE is 15 g.
- Packages 1 kg to 10 kg: MPE is 1.5%.
Short deliveries beyond these tolerances attract fines up to ₹25,000 per violation under Section 36.`,
  },

  // --- 4. GATC RULES 2013 ---
  {
    category: 'GATC_RULES',
    act_name: 'Government Approved Test Centre (GATC) Rules, 2013',
    section_rule_ref: 'Rule 3 & 4',
    title: 'GATC Accreditation & Verification Scope',
    citation_label: 'GATC Rules 2013 Rule 3 & 4',
    keywords: ['gatc', 'private testing center', 'accreditation', 'test report', 'rrsl calibration', 'working standard', 'scope'],
    content: `Government Approved Test Centres (GATC) are third-party laboratories accredited by the State Legal Metrology Department to verify and test specified weights and measures. GATC centres must maintain traceable working reference standards calibrated by Regional Reference Standard Laboratories (RRSL) or NPL India. They are authorized to test Class II, III, and IIII instruments up to their approved maximum capacity rating.`,
    portal_action: {
      label: 'View GATC Lab Console',
      action_type: 'NAVIGATE',
      target_tab: 'gatc',
      description: 'Access the GATC testing and verification workspace',
    },
  },

  // --- 5. PORTAL GUIDES & FAQS ---
  {
    category: 'PORTAL_FAQ',
    act_name: 'e-Metrology Digital Platform User Guide',
    section_rule_ref: 'Trader Guide FAQ 1',
    title: 'How to Register an Instrument on the Portal',
    citation_label: 'e-Metrology Platform Guide § 1',
    keywords: ['how to register', 'register instrument', 'add machine', 'serial number', 'model selection', 'machine registration'],
    content: `To register a weighing/measuring instrument:
1. Log in to the Trader Portal using your registered email/phone and OTP.
2. Click "+ Register New Instrument" on your dashboard.
3. Select the Government-Approved Model from the dropdown (e.g. Phoenix Counter Scale, Avery Weighbridge).
4. Enter the physical machine Serial Number, Year of Manufacture, and Facility location.
5. Click Save. An opaque tamper-resistant Digital Token (e.g. TOKEN-2026-XXXX) is generated automatically.`,
    portal_action: {
      label: 'Register New Instrument',
      action_type: 'NAVIGATE',
      target_tab: 'trader',
      description: 'Open the instrument registration modal on Trader Portal',
    },
  },
  {
    category: 'PORTAL_FAQ',
    act_name: 'e-Metrology Digital Platform User Guide',
    section_rule_ref: 'Trader Guide FAQ 2',
    title: 'How to Book a Verification Appointment',
    citation_label: 'e-Metrology Platform Guide § 2',
    keywords: ['book appointment', 'schedule verification', 'verification slot', 'departmental lab', 'on site visit', 'gatc centre'],
    content: `To schedule verification:
1. Go to "My Verification Applications" on the Trader Portal.
2. Select your registered instrument and choose Service Mode: On-Site Inspection, Departmental Metrology Lab, or GATC Test Centre.
3. Select an available date/time slot from the calendar.
4. Pay the assessed statutory fee online or upload the treasury challan receipt.
5. The assigned Legal Metrology Officer or GATC verifier will conduct the testing at the scheduled slot.`,
  },
  {
    category: 'PORTAL_FAQ',
    act_name: 'e-Metrology Digital Platform User Guide',
    section_rule_ref: 'Public Verification FAQ 3',
    title: 'How to Verify a Digital Certificate using QR Code',
    citation_label: 'e-Metrology Platform Guide § 3',
    keywords: ['verify qr', 'qr code', 'check certificate', 'authenticity', 'public verify', 'certificate validity', 'counterfeit'],
    content: `Every genuine verification certificate issued by the department contains an opaque 256-bit QR code.
1. Scan the QR code using any smartphone camera or navigate to the "Public QR Verify" tab on this portal.
2. The portal securely queries the PostgreSQL ledger and displays:
   - Certificate Number & Status (ISSUED / VALID / EXPIRED / SUSPENDED).
   - Machine Model, Masked Serial Number, and Applied Physical Seal Number.
   - Verification Date, Validity Due Date, and Cryptographic HSM Signature hash.
Never trust paper certificates that do not validate against the live government ledger.`,
    portal_action: {
      label: 'Open Public QR Verifier',
      action_type: 'NAVIGATE',
      target_tab: 'public',
      description: 'Scan or verify any certificate token live',
    },
  },
];
