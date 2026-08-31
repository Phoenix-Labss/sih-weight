import { StatutoryKnowledgeItem } from './types.js';

export const STATUTORY_CORPUS: StatutoryKnowledgeItem[] = [
  // --- 1. CITIZEN & TRADER PRACTICAL SCENARIOS ---
  {
    category: 'PORTAL_FAQ',
    act_name: 'e-Metrology Digital Platform User Guide',
    section_rule_ref: 'Digital Certificate Management § 4',
    title: 'Lost Certificate & Duplicate Certificate Download',
    citation_label: 'Digital Certificate Management § 4',
    keywords: [
      'lost',
      'certificate is lost',
      'lost certificate',
      'misplaced certificate',
      'duplicate certificate',
      'lost my certificate',
      'copy of certificate',
      'download again',
      'lost paper',
      'print certificate',
      'get certificate copy',
      'kho gaya',
    ],
    content: `If your verification certificate is lost or misplaced, you do **not** need to pay duplicate paper fees or visit the department office:
1. **100% Digital & Traceable:** All certificates generated on this portal are digitally authenticated and permanently stored in the PostgreSQL ledger.
2. **Instant Download:** Log in to your **Trader Portal** $\\to$ navigate to **'My Verification Applications'** $\\to$ click **'Download Signed Certificate (PDF)'**.
3. **Instant QR Verification:** You can also scan the QR code sticker on your weighing machine or enter your Certificate/Token number on the **Public QR Verify** page to view and download the official signed certificate anytime.`,
    portal_action: {
      label: 'Go to My Certificates',
      action_type: 'NAVIGATE',
      target_tab: 'trader',
      description: 'Download signed digital certificates from your dashboard',
    },
  },
  {
    category: 'ACT',
    act_name: 'The Legal Metrology Act, 2009',
    section_rule_ref: 'Section 24 & Rule 27',
    title: 'Broken Physical Seal or Damaged Tamper Stamp',
    citation_label: 'Legal Metrology Act 2009 § 24 & Rule 27',
    keywords: [
      'broken seal',
      'seal damaged',
      'seal broken',
      'wire broken',
      'tampered seal',
      'repair seal',
      'lead seal broken',
      'seal toot gaya',
      'broken stamp',
      'seal cut',
    ],
    content: `If the official lead-wire physical seal on your weighing machine is broken, cut, or damaged:
1. **Stop Commercial Use Immediately:** Using an unsealed or tampered scale in commercial transactions is a punishable offence under Section 30 of The Legal Metrology Act, 2009.
2. **Notify the Department within 7 Days:** Submit an intimation to your jurisdictional Legal Metrology Officer (LMO).
3. **Repair by Licensed Technician:** If the seal broke due to machine malfunction, have it repaired by a licensed Legal Metrology Repairer who will issue a de-stamping/repair memo.
4. **Apply for Re-Verification:** Submit an online re-verification application on the Trader Portal so an LMO can test the machine and affix a new official physical seal.`,
    portal_action: {
      label: 'Apply for Re-Verification',
      action_type: 'NAVIGATE',
      target_tab: 'trader',
      description: 'Book a re-verification session for broken seal or repair',
    },
  },
  {
    category: 'PORTAL_FAQ',
    act_name: 'Legal Metrology Citizen Charter & General Rules, 2011',
    section_rule_ref: 'Citizen Charter SLA & Rule 27',
    title: 'Verification Testing Duration and Turnaround Time',
    citation_label: 'Citizen Charter & General Rules 2011',
    keywords: [
      'time',
      'duration',
      'how long',
      'how much time',
      'take to test',
      'turnaround',
      'testing time',
      'inspection duration',
      'sla',
      'hours',
      'minutes',
      'kitna time',
    ],
    content: `The physical verification and testing duration varies by instrument type and testing mode:
- **Retail Counter Scales (≤ 50 kg):** Approximately 15 to 30 minutes per unit (includes Eccentricity, Repeatability, and Weighing MPE linearity test).
- **Platform Scales (50 kg to 500 kg):** Approximately 30 to 45 minutes.
- **Heavy Industrial Weighbridges (10 Tonne to 100 Tonne):** Approximately 1.5 to 3 hours (requires Mobile Test Unit with certified standard weights up to maximum operational load).
- **Turnaround & Certificate Issuance:** Once the testing is recorded and verified by the LMO or GATC verifier, the digital certificate and QR code are generated and issued within **24 to 48 hours** as per the Departmental Citizen Charter SLA.`,
    portal_action: {
      label: 'Book Verification Slot',
      action_type: 'NAVIGATE',
      target_tab: 'trader',
      description: 'Schedule a verification appointment on Trader Portal',
    },
  },
  {
    category: 'PORTAL_FAQ',
    act_name: 'Legal Metrology Departmental Procedure',
    section_rule_ref: 'Rule 16 & Application Checklist',
    title: 'Documents Required for Instrument Verification',
    citation_label: 'Departmental Procedure & Rule 16',
    keywords: [
      'documents',
      'docs',
      'papers',
      'invoice',
      'what documents',
      'requirements',
      'application checklist',
      'needed',
      'kagaz',
    ],
    content: `The following documents are required when submitting an application for verification:
1. **Invoice / Bill of Sale:** Proving legal purchase, manufacturer name, model, and serial number.
2. **Central Model Approval Certificate (Section 22):** Mandatory for new/first-time verifications.
3. **Previous Verification Certificate:** Required for periodic re-verification renewals.
4. **GSTIN / Trade Registration Certificate:** Identification of the trader/establishment.
5. **Repairer Certificate (Form VR):** Required only if the instrument underwent repair or seal de-stamping prior to re-verification.`,
  },
  {
    category: 'PORTAL_FAQ',
    act_name: 'e-Metrology Digital Platform User Guide',
    section_rule_ref: 'Instrument Lifecycle § 5',
    title: 'Transfer of Machine Ownership & Relocation',
    citation_label: 'e-Metrology Platform Guide § 5',
    keywords: [
      'transfer',
      'transfer machine',
      'sold scale',
      'change location',
      'move machine',
      'change owner',
      'transfer ownership',
      'relocate',
      'bech diya',
    ],
    content: `To transfer a registered weighing instrument to another business or new location:
1. Log in to the **Trader Portal** $\\to$ go to **'Registered Instruments'**.
2. Select the machine and click **'Transfer Ownership / Relocate'**.
3. Enter the new owner's GSTIN / Trade ID or new facility address.
4. The system updates the immutable chain-of-custody ledger.
5. If the instrument is relocated to a different state/jurisdiction, an on-site re-verification is required to verify local gravity calibration.`,
    portal_action: {
      label: 'Manage Registered Instruments',
      action_type: 'NAVIGATE',
      target_tab: 'trader',
      description: 'View or transfer registered weighing instruments',
    },
  },
  {
    category: 'ACT',
    act_name: 'The Legal Metrology Act, 2009',
    section_rule_ref: 'Section 15',
    title: 'Inspector Powers of Search, Seizure and Inspection',
    citation_label: 'Legal Metrology Act 2009 § 15',
    keywords: [
      'inspector visit',
      'inspection',
      'lmo powers',
      'search and seizure',
      'section 15',
      'officer rights',
      'raid',
      'checking',
    ],
    content: `Under Section 15 of The Legal Metrology Act, 2009, an authorized Legal Metrology Officer has statutory powers to:
1. Enter any commercial premises during normal trading hours to inspect any weight, measure, or pre-packaged commodity.
2. Demand production of verification certificates, purchase invoices, and calibration records.
3. Seize unverified, non-standard, tampered, or fraudulent weights and measures and issue a formal Seizure Memo.
4. Officers must display official departmental ID credentials upon request.`,
  },
  {
    category: 'ACT',
    act_name: 'The Legal Metrology Act, 2009',
    section_rule_ref: 'Section 23',
    title: 'Licensing of Manufacturers, Repairers, and Dealers',
    citation_label: 'Legal Metrology Act 2009 § 23',
    keywords: [
      'license',
      'dealer license',
      'manufacturer license',
      'repairer license',
      'section 23',
      'how to become repairer',
      'licence',
    ],
    content: `Under Section 23 of The Legal Metrology Act, 2009:
- No person may manufacture, repair, or sell any commercial weight or measure without a valid license issued by the State Controller of Legal Metrology.
- Statutory Licenses include: **Manufacturer License (Form LM-1)**, **Repairer License (Form LR-1)**, and **Dealer License (Form LD-1)**.
- Operating without a license is an offence punishable under Section 45.`,
  },

  // --- 2. STATUTORY LEGAL PROVISIONS ---
  {
    category: 'ACT',
    act_name: 'The Legal Metrology Act, 2009',
    section_rule_ref: 'Section 19',
    title: 'Verification and Stamping of Weight or Measure',
    citation_label: 'Legal Metrology Act 2009 § 19',
    keywords: [
      'verification',
      'stamping',
      'lmo',
      'gatc',
      'physical test',
      'mandatory verification',
      'inspection',
      'how to verify',
    ],
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
    keywords: [
      'model approval',
      'certificate of approval',
      'ind approval',
      'manufacturer',
      'importer',
      'specifications',
      'model certificate',
    ],
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
    keywords: [
      're-verification',
      'renewal',
      'expiry',
      'validity',
      'annual',
      'biennial',
      'due date',
      'counter scale',
      'weighbridge',
      'timeline',
      'how often',
      'validity period',
    ],
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
    keywords: [
      'penalty',
      'fine',
      'prosecution',
      'unverified',
      'compounding',
      'seizure',
      'illegal scale',
      'punishment',
      'jurmana',
    ],
    content: `Whoever uses any unverified or unstamped weight or measure in any commercial transaction shall be punished with a fine up to ₹10,000 for the first offence, and for a second or subsequent offence with imprisonment for a term which may extend to one year and with fine. Tampering with or altering an approved weight or measure attracts a fine up to ₹25,000 and possible prosecution. Most first-time non-fraudulent offences can be compounded under Section 48 upon payment of the compounding sum.`,
  },
  {
    category: 'PENALTIES_COMPOUNDING',
    act_name: 'The Legal Metrology Act, 2009',
    section_rule_ref: 'Section 48',
    title: 'Compounding of Offences',
    citation_label: 'Legal Metrology Act 2009 § 48',
    keywords: [
      'compounding',
      'settlement',
      'notice',
      'lmo',
      'controller',
      'adjudication',
      'pay fine',
    ],
    content: `Any offence punishable under the Act (other than repeated fraudulent offences) may, either before or after the institution of the prosecution, be compounded by the Controller or authorized Legal Metrology Officer on payment of such compounding sum as prescribed. On compounding, no further criminal proceedings are initiated against the person for that offence.`,
  },

  // --- 3. GENERAL RULES, 2011 ---
  {
    category: 'GENERAL_RULES',
    act_name: 'Legal Metrology (General) Rules, 2011',
    section_rule_ref: 'Seventh Schedule & Rule 14',
    title: 'Non-Automatic Weighing Instruments (NAWI) Accuracy Classes',
    citation_label: 'General Rules 2011 Schedule VII',
    keywords: [
      'nawi',
      'accuracy class',
      'class i',
      'class ii',
      'class iii',
      'class iiii',
      'jewellery',
      'commercial',
      'industrial',
      'weighbridge',
      'scale classes',
    ],
    content: `Weighing instruments are classified into four accuracy classes:
- **Class I (Special Accuracy):** Ultra-precision micro/analytical laboratory balances (e ≤ 1 mg).
- **Class II (High Accuracy):** Jewellery, bullion, and pharmaceutical precision balances (e: 1 mg to 50 mg).
- **Class III (Medium Accuracy):** Commercial retail counter scales, grocery scales, platform machines, and weighbridges (e: 100 mg to 5 kg).
- **Class IIII (Ordinary Accuracy):** Coarse industrial and construction material scales.
Every scale must operate within the Maximum Permissible Error (MPE) specified for its accuracy class.`,
  },
  {
    category: 'GENERAL_RULES',
    act_name: 'Legal Metrology (General) Rules, 2011',
    section_rule_ref: 'Schedule VII, Table 1',
    title: 'Maximum Permissible Errors (MPE) on Verification',
    citation_label: 'General Rules 2011 Schedule VII Table 1',
    keywords: [
      'mpe',
      'maximum permissible error',
      'tolerance',
      'error limit',
      'initial verification',
      're-verification',
      'scale interval e',
      'allowable error',
    ],
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
    keywords: [
      'fee',
      'verification fee',
      'stamping fee',
      'charges',
      'cost',
      'scale price',
      'weighbridge fee',
      'how much',
      'payment rate',
      'shulk',
    ],
    content: `Statutory verification fees are determined by instrument capacity and service mode:
- **Counter Scales & Balances (≤ 50 kg):** ₹100 – ₹200.
- **Platform Scales (50 kg to 500 kg):** ₹200 – ₹500.
- **Heavy Industrial Scales (500 kg to 5 tonne):** ₹500 – ₹2,000.
- **Electronic Weighbridges (10 tonne to 100 tonne):** ₹3,000 – ₹5,000.
- **Petrol/Diesel Fuel Dispensing Pumps:** ₹1,000 per nozzle.
- **Length Measures & Capacity Measures:** ₹20 – ₹100.
Re-verification fees after repair or out-of-premises on-site inspection may include applicable departmental conveyance/inspector travel allowances.`,
    portal_action: {
      label: 'Estimate Verification Fee',
      action_type: 'NAVIGATE',
      target_tab: 'trader',
      description: 'Compute exact verification fees when creating an application',
    },
  },
  {
    category: 'PACKAGED_COMMODITIES',
    act_name: 'Legal Metrology (Packaged Commodities) Rules, 2011',
    section_rule_ref: 'Rule 6(1)',
    title: 'Mandatory Declarations on Pre-Packaged Goods',
    citation_label: 'Packaged Commodities Rules 2011 Rule 6(1)',
    keywords: [
      'packaged commodities',
      'mandatory declarations',
      'label',
      'packaging',
      'mrp',
      'net quantity',
      'manufacturer name',
      'expiry',
      'consumer care',
      'rule 6',
      'packet',
    ],
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
    category: 'GATC_RULES',
    act_name: 'Government Approved Test Centre (GATC) Rules, 2013',
    section_rule_ref: 'Rule 3 & 4',
    title: 'GATC Accreditation & Verification Scope',
    citation_label: 'GATC Rules 2013 Rule 3 & 4',
    keywords: [
      'gatc',
      'private testing center',
      'accreditation',
      'test report',
      'rrsl calibration',
      'working standard',
      'scope',
      'private lab',
    ],
    content: `Government Approved Test Centres (GATC) are third-party laboratories accredited by the State Legal Metrology Department to verify and test specified weights and measures. GATC centres must maintain traceable working reference standards calibrated by Regional Reference Standard Laboratories (RRSL) or NPL India. They are authorized to test Class II, III, and IIII instruments up to their approved maximum capacity rating.`,
    portal_action: {
      label: 'View GATC Lab Console',
      action_type: 'NAVIGATE',
      target_tab: 'gatc',
      description: 'Access the GATC testing and verification workspace',
    },
  },
  {
    category: 'PORTAL_FAQ',
    act_name: 'e-Metrology Digital Platform User Guide',
    section_rule_ref: 'Trader Guide FAQ 1',
    title: 'How to Register an Instrument on the Portal',
    citation_label: 'e-Metrology Platform Guide § 1',
    keywords: [
      'how to register',
      'register instrument',
      'add machine',
      'serial number',
      'model selection',
      'machine registration',
      'new scale',
    ],
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
    section_rule_ref: 'Public Verification FAQ 3',
    title: 'How to Verify a Digital Certificate using QR Code',
    citation_label: 'e-Metrology Platform Guide § 3',
    keywords: [
      'verify qr',
      'qr code',
      'check certificate',
      'authenticity',
      'public verify',
      'certificate validity',
      'counterfeit',
      'scan qr',
    ],
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
