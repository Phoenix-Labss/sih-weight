# Statutory Multi-Language Localization (i18n) Backlog & Roadmap

> **Status:** Backlog / To Be Refactored & Enhanced  
> **Target Scope:** Full End-to-End Bilingual (English & Hindi) & Scheduled 8th Schedule Indian Languages Coverage  
> **Statutory Citation:** The Legal Metrology Act, 2009 & General Rules, 2011 (Official Form & Notice Bilingual Requirements)

---

## 1. Executive Summary & Current State

The current internationalization (`i18n`) foundation provides basic header/navbar, metric card titles, and active tab switching between English (`en`) and Hindi (`hi`). However, deep UI views, multi-step wizards, test entry grids, modal dialogs, validation error banners, and printable documents still contain hardcoded English strings.

This document tracks all incomplete translation areas and defines the exact roadmap to achieve 100% full-portal bilingual compliance.

---

## 2. Exhaustive List of Items to be Translated & Enhanced

### A. Trader Portal & Registration Modals
- [ ] **Instrument Registration Wizard (`InstrumentRegisterModal.tsx`)**:
  - Form labels: Category, Model, Serial Number, Year of Manufacture, Intended Commercial Use, Facility Location.
  - Accuracy Class dropdowns (`Class I`, `Class II`, `Class III`, `Class IIII`) and unit selectors (`kg`, `g`, `mg`, `t`, `L`, `ml`).
  - Validation warning toasts and required field error messages.
- [ ] **Verification Application Wizard (`VerificationWizard.tsx`)**:
  - Step 1: Instrument selection & verification type (`INITIAL`, `PERIODIC_REVERIFICATION`, `POST_REPAIR`).
  - Step 2: Service location toggle (`On-site at premises` vs. `At Legal Metrology Laboratory`).
  - Step 3: Statutory fee assessment breakdown table (Base fee, inspection surcharge, total).
  - Step 4: Final declaration checklist & statutory submission confirmation.
- [ ] **Fee Payment Modal (`FeePaymentModal.tsx`)**:
  - Payment mode selectors (`Net Banking / UPI`, `Bharatkosh Treasury Challan`, `POS Terminal`).
  - Simulation buttons, gateway redirect disclaimer, and failure retry alerts.
- [ ] **Receipt & Certificate Viewers (`ReceiptViewer.tsx`, `CertificateModal.tsx`)**:
  - Itemized treasury receipt fields and download button labels.
  - Form 8 certificate layout labels (Issuing authority, verifier notes, validity period, sealed positions).
- [ ] **Query Response Dialog (`QueryResponseModal.tsx`)**:
  - Officer clarification remarks and trader reply submission text area.

---

### B. Officer & GATC Workspace
- [ ] **Application Scrutiny Queue (`ScrutinyQueue.tsx`)**:
  - Application cards, applicant details, filtering tabs (`All`, `Pending`, `Queried`, `Accepted`, `Rejected`).
  - Action modals: Accept confirmation modal, Query dialog with mandatory statutory reason, Rejection modal.
- [ ] **Guided Test Observation Grid (`TestObservationGrid.tsx`)**:
  - NAWI test sections: True Zero Error ($E_0$), Linearity Load Steps (Ascending/Descending), 5-Position Platform Eccentricity, Repeatability spread ($P_{\max} - P_{\min}$), Tare error balancing.
  - Live MPE indicator badges (`WITHIN_TOLERANCE` / `EXCEEDS_MPE`).
  - Liquid Fuel Dispenser volumetric delivery test rows ($5\text{ L}$, $10\text{ L}$, $20\text{ L}$ Fast & Slow flow runs).
  - Length & Capacity measures observation tables.
- [ ] **Physical Stamping & Sealing Ledger (`StampingLedger.tsx`)**:
  - Seal type options (`Lead Wire Seal`, `Security Sticker Hologram`, `Metal Punch Mark`).
  - Seal identification number input and verification badge.
- [ ] **Disposition & Cryptographic Signing Modal (`DispositionModal.tsx`)**:
  - Disposition outcomes (`Pass — Pending Authorization`, `Verification Failed`, `Incomplete Verification`).
  - Digital signature PIN entry, HSM key status, and certificate issuance trigger.

---

### C. Supervisor & Controller Dashboard
- [ ] **Pendency Analysis Table (`PendencyTable.tsx`)**:
  - Column headers: Application No., Trader Name, Category, Days Pending, SLA Status.
  - SLA age filters and export report buttons.
- [ ] **Audit Trail Viewer (`AuditTrailViewer.tsx`)**:
  - Action event descriptions (`APPLICATION_ACCEPTED`, `DISPOSITION_RECORDED`, `SEAL_AFFIXED`, `CERTIFICATE_ISSUED`).
  - IP address, actor role, timestamp, and entity ID column headers.

---

### D. GATC Centers & Legacy Migration Console
- [ ] **GATC Center Management (`GATCManagement.tsx`)**:
  - Center profile registration, accreditation validity dates, accuracy class scope check calculator.
- [ ] **Legacy Migration Console (`LegacyMigrationConsole.tsx`)**:
  - Batch file upload zone, duplicate resolution actions, CSV template instructions, and migration progress indicators.

---

### E. Public QR Verification Page & System Messages
- [ ] **Public Verification (`PublicVerificationPage.tsx`)**:
  - Status display cards (`VALID`, `EXPIRED`, `REVOKED`, `SUSPENDED`, `SUPERSEDED`).
  - Disclaimer notice explaining that digital verification does not replace physical inspection of seals.
- [ ] **Global Toasts & Notifications (`Toast.tsx`, `NotificationContext.tsx`)**:
  - Success, error, and info toast message bodies.
- [ ] **Footer & Legal Disclaimers (`Footer.tsx`)**:
  - Copyright notices, ministry links, and DPDP Act 2023 compliance texts.

---

## 3. Technical Implementation Plan for Future Refactor

1. **Adopt Standard i18n Framework**:
   - Migrate from custom React context to `i18next` + `react-i18next` for nested namespaces (e.g., `translation:trader`, `translation:officer`, `translation:errors`).
2. **Dynamic Language Pluralization & Currency/Number Formatting**:
   - Integrate `Intl.NumberFormat('hi-IN')` for Indian numbering system (Lakhs / Crores) and Devanagari numerals where statutory forms require.
3. **Automated Translation Coverage Linter**:
   - Add a pre-commit / CI script to detect untranslated raw strings in `.tsx` files.
4. **Official Hindi Metrology Terminology Standardization**:
   - Cross-check all terminology against the official CSTT (Commission for Scientific and Technical Terminology) glossaries for Legal Metrology.

---

*This backlog file is maintained in the root directory for tracking future localization enhancements.*
