# ⚖️ e-Metrology: National Unified Legal Metrology Platform

> **Ministry of Consumer Affairs, Food & Public Distribution • Government of India**  
> *Statutory Digital Verification, Certification, and Lifecycle Management of Weighing and Measuring Instruments*  
> **Statutory Basis:** The Legal Metrology Act, 2009 • Legal Metrology (General) Rules, 2011 • GATC Rules, 2013 • OIML R76-1 / IS 9281

---

## 🏛️ Overview
`e-Metrology` is India's unified online platform for digital verification, cryptographic certification, and lifecycle tracking of commercial weighing and measuring instruments. It provides seamless workflows for traders, Legal Metrology Officers (LMOs), accredited GATC laboratories, supervisory controllers, and public citizens.

---

## 🌟 Key Capabilities
- **8 Statutory Persona Workspaces**: Trader/Applicant, Legal Metrology Officer (LMO), Supervisor/DDO, State Controller, System Administrator, GATC Laboratory Verifier, Legacy Migration Clerk, and Public Citizen.
- **28-Digit Rational Arithmetic**: Exact metrology tolerance calculation powered by `Decimal.js` enforcing stepped MPE (Maximum Permissible Error) limits.
- **Physical-Digital Separation**: Authoritative physical lead-wire seal recording paired with tamper-evident 256-bit opaque QR tokens.
- **Real-Time QR Camera Scanner**: Hardware video analysis (`jsQR` + `BarcodeDetector`) for instant citizen verification with zero PII exposure.
- **Strict GATC Laboratory Role Separation**: Independent verification consoles exclusively for accredited test centers.
- **Immutable Audit Ledgers**: HMAC-SHA256 chained transaction logs and append-only digital certificate states.

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Development Mode
```bash
npm run dev
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Production Build
```bash
npm run build
```

---

## 📜 Statutory Foundation & Standards
- **Primary Legislation**: The Legal Metrology Act, 2009 (Act No. 1 of 2010)
- **Technical Testing**: Legal Metrology (General) Rules, 2011 (Sixth & Seventh Schedules)
- **Accuracy Classes**: Class I (Special), Class II (High), Class III (Medium), Class IIII (Ordinary)
- **Digital Certificates**: OIML R76-1 & Form 8 Digital Stamping Certificate (DSC)
