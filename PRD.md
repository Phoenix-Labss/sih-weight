# 🇮🇳 PRODUCT REQUIREMENTS DOCUMENT (PRD)
## National Unified Legal Metrology Digital Verification, Certification & Lifecycle Management Platform (`e-Metrology`)
**Document Version:** `v3.0.0 — Definitive Deep Research Edition`  
**Classification:** Government of India / Ministry of Consumer Affairs, Food & Public Distribution | Legal Metrology Division  
**Target Runtimes:** Fastify v5 (Node.js 24 LTS), PostgreSQL 18, React 18 / Vite 6, Google Gemini 3.6 Flash / 3.5 Flash Lite Hybrid RAG  
**Statutory Authorities:** The Legal Metrology Act, 2009 | Legal Metrology (General) Rules, 2011 | GATC Rules, 2013 | Legal Metrology (Packaged Commodities) Rules, 2011 | OIML R76-1:2006  

---

# 📑 TABLE OF CONTENTS
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Statutory Legal & Metrological Foundation](#2-statutory-legal--metrological-foundation)
3. [System Architecture & Modern Tech Stack](#3-system-architecture--modern-tech-stack)
4. [Exact Metrological Calculation Engine & NAWI Testing](#4-exact-metrological-calculation-engine--nawi-testing)
5. [National Reference Standards Traceability Pyramid & Fail-Closed Safety](#5-national-reference-standards-traceability-pyramid--fail-closed-safety)
6. [Physical-Digital Separation & Anti-Cloning Defenses](#6-physical-digital-separation--anti-cloning-defenses)
7. [Multi-Tenancy, Jurisdictional Isolation & Security Architecture](#7-multi-tenancy-jurisdictional-isolation--security-architecture)
8. [Statutory State Machine Lifecycles & Transition Invariants](#8-statutory-state-machine-lifecycles--transition-invariants)
9. [Authoritative 22-Entity Data Model & Schema Specification](#9-authoritative-22-entity-data-model--schema-specification)
10. [Core Functional Modules & Detailed User Workflows](#10-core-functional-modules--detailed-user-workflows)
    - 10.1 [Multi-Role Authentication & Access Control](#101-multi-role-authentication--access-control)
    - 10.2 [Trader & Instrument Owner Portal](#102-trader--instrument-owner-portal)
    - 10.3 [Legal Metrology Officer (LMO) Workspace](#103-legal-metrology-officer-lmo-workspace)
    - 10.4 [Supervisor & Assistant Controller SLA Oversight Dashboard](#104-supervisor--assistant-controller-sla-oversight-dashboard)
    - 10.5 [National Admin & Master Governance Portal](#105-national-admin--master-governance-portal)
    - 10.6 [GATC (Government Approved Test Centre) Management](#106-gatc-government-approved-test-centre-management)
    - 10.7 [Legacy Paper Register Migration & OCR Ingestion Pipeline](#107-legacy-paper-register-migration--ocr-ingestion-pipeline)
    - 10.8 [Public Zero-PII QR Verification & Authenticity Portal](#108-public-zero-pii-qr-verification--authenticity-portal)
    - 10.9 [Bilingual Ground-Truth AI Assistant (Nikks Mascot & Voice Engine)](#109-bilingual-ground-truth-ai-assistant-nikks-mascot--voice-engine)
    - 10.10 [Evidence & Photo Custody Protocol](#1010-evidence--photo-custody-protocol)
    - 10.11 [Offline-First Field Verification Protocol](#1011-offline-first-field-verification-protocol)
    - 10.12 [Treasury & Statutory Fee Reconciliation](#1012-treasury--statutory-fee-reconciliation)
11. [Complete REST API Specification](#11-complete-rest-api-specification)
12. [Non-Functional Requirements & Performance SLOs](#12-non-functional-requirements--performance-slos)
13. [Quality Assurance & 5-Tier Testing Framework](#13-quality-assurance--5-tier-testing-framework)
14. [Deployment Topology, Rollout Milestones & Disaster Recovery](#14-deployment-topology-rollout-milestones--disaster-recovery)

---

# 1. Executive Summary & Problem Statement

### 1.1 The Real-World National Metrological Crisis
In India, over **50 Million (5 Crore) commercial weighing and measuring instruments**—ranging from retail grocery scales, gold analytical balances, and fuel dispenser nozzles to 100-tonne highway weighbridges—are subject to statutory initial verification and periodic re-verification under **The Legal Metrology Act, 2009**.

The legacy verification regime suffers from four systemic vulnerabilities:
1. **Zero Real-Time Public Verification:** 1.4 Billion consumers have no reliable mechanism to verify whether a scale at a market counter or petrol pump has valid calibration, an intact seal, or official legal standing.
2. **Rampant Certificate Forgery:** Paper certificates and localized stamp records are easily counterfeited with fake government seals, fictitious serial numbers, or photocopied credentials.
3. **Expired & Untracked Reference Standards:** In field inspections, working standard weights are frequently used past their statutory 24-month calibration validity from Regional Reference Standards Laboratories (RRSL) or NPL India, invalidating legal traceability.
4. **Revenue Drift & Fragmented Governance:** Manual cash collections, localized challan registers, and siloed state IT systems cause massive revenue leakage and prevent central regulatory oversight across States and Union Territories (UTs).

### 1.2 The Platform Mission (`e-Metrology`)
The **e-Metrology Platform** is a unified, multi-tenant national transactional control plane designed to:
- Digitize the entire lifecycle of legal metrology instruments from initial registration and model approval scrutiny to periodic re-verification, physical stamping, digital certification, and eventual decommissioning.
- Enforce strict mathematical metrology via **28-digit rational decimal arithmetic** implementing OIML R76 stepped Maximum Permissible Error (MPE) algorithms.
- Establish cryptographic parity between physical lead-wire seals and digital certificates using **RFC 8785 JSON Canonicalization Scheme (JCS)**, **Ed25519 HSM/DSC digital signing**, and **256-bit high-entropy opaque QR tokens**.
- Provide seamless, role-tailored web and mobile applications for Traders, Legal Metrology Officers (LMOs), Supervisors, National Administrators, GATCs, and Citizens.
- Power citizen engagement through a **Bilingual Ground-Truth Retrieval-Augmented Generation (RAG) AI Assistant** with real-time word-boundary speech synthesis and dynamic portal deep-linking.

---

# 2. Statutory Legal & Metrological Foundation

The platform strictly encodes and enforces the provisions of Indian Legal Metrology legislation and international OIML standards:

```
                               ┌───────────────────────────────────────────────┐
                               │       THE LEGAL METROLOGY ACT, 2009           │
                               │              (Act No. 1 of 2010)              │
                               └───────────────────────┬───────────────────────┘
                                                       │
         ┌─────────────────────────────────────────────┼─────────────────────────────────────────────┐
         ▼                                             ▼                                             ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐             ┌───────────────────────────────┐
│ Legal Metrology (General)     │             │ Government Approved Test      │             │ Legal Metrology (Packaged     │
│ Rules, 2011                   │             │ Centre (GATC) Rules, 2013     │             │ Commodities) Rules, 2011      │
│ - Seventh Sched: NAWI Classes │             │ - Rule 3: Third-party Lab     │             │ - Rule 6(1): 7 Mandatory      │
│ - Twelfth Sched: Fee Schedule │             │   Accreditation Scope         │             │   Declarations on Pre-Packed  │
│ - Rule 27: Physical Stamping  │             │ - Competency & Delegated Test │             │ - Second Sched: Maximum       │
│ - Section 19/24: Stamping     │             │   Reporting Matrix            │             │   Allowable Quantity Error    │
└───────────────────────────────┘             └───────────────────────────────┘             └───────────────────────────────┘
```

### 2.1 Statutory Legal Metrology Act, 2009 Mapping
| Section / Rule | Legal Mandate | Platform Automated Implementation |
| :--- | :--- | :--- |
| **Section 15** | Power of inspection, search, seizure, and summons | Mobile enforcement module with digital seizure memos, geo-tagged photo evidence, and audit logs. |
| **Section 19** | Mandatory initial verification & stamping before commercial sale/use | Mandatory Initial Verification workflow; blocks instrument status to `UNVERIFIED` until signed certificate is issued. |
| **Section 22** | Mandatory Central Model Approval (`IND/09/YYYY/XXX`) | Model Registry enforces unique approval reference, capacity envelope, and scale interval $e$ validation. |
| **Section 24** | Mandatory periodic re-verification (12 or 24 months) | Automated statutory validity engine; triggers SMS/email renewal alerts at 30/15/7 days prior to expiry. |
| **Section 30 & 33** | Penalties for using unverified/altered weights and measures | Automated flagging of overdue/unverified instruments; Seizure Notice drafting under Section 36. |
| **Section 48** | Compounding of non-fraudulent offences | Audit-tracked compounding fee calculation, receipt generation, and double-entry treasury reconciliation. |
| **Seventh Schedule** | NAWI Accuracy Classes (Class I, II, III, IIII) & MPE Stepped Functions | Exact `Decimal.js` evaluator computing turning point $P$, error $E$, corrected error $E_c$, and MPE boundaries. |
| **Twelfth Schedule** | Prescribed statutory verification fee schedule | Versioned, effective-dated JSON fee policy packs pinned to each application at creation time. |
| **Rule 27** | Tamper-evident physical lead-wire and embossing seal requirements | Physical Stamp & Seal inventory tracking (`physical_stamp_actions`) linking lead wire serials with digital certificates. |

---

# 3. System Architecture & Modern Tech Stack

The platform is designed as a **High-Integrity Modular Monolith Transactional Control Plane** paired with dedicated asynchronous background workers.

```
+-----------------------------------------------------------------------------------------------------------------------+
|                                                  PRESENTATION LAYER                                                   |
|  ┌─────────────────────────────┐   ┌─────────────────────────────┐   ┌────────────────────────┐   ┌─────────────────┐  |
|  │  apps/verification-web      │   │  apps/admin-portal          │   │  Public QR Verification│   │  Mobile PWA App │  |
|  │  (React 18 + Vite + i18n)   │   │  (Executive Admin + SLA)    │   │  (/verify/qr/:token)   │   │  (Offline-First)│  |
|  └──────────────┬──────────────┘   └──────────────┬──────────────┘   └───────────┬────────────┘   └────────┬────────┘  |
+-----------------┼─────────────────────────────────┼──────────────────────────────┼─────────────────────────┼----------+
                  │                                 │                              │                         │
                  ▼                                 ▼                              ▼                         ▼
+-----------------------------------------------------------------------------------------------------------------------+
|                                    TRANSACTIONAL CONTROL PLANE (Fastify v5 + TypeScript)                              |
|  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  |
|  │ Middlewares: Auth Parser (JWT/Header) | Multi-Tenant Guard | Role ABAC/RBAC Guard | Rate Limiter | Helmet (CSP) │  |
|  └────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┘  |
|                                                           │                                                           |
|  ┌────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┐  |
|  │ Domain Routers (/api/v1):                                                                                       │  |
|  │  • /auth         • /tenants/:id/instruments    • /tenants/:id/applications    • /tenants/:id/sessions           │  |
|  │  • /certificates • /tenants/:id/stamps         • /tenants/:id/evidence        • /admin & /approvals             │  |
|  │  • /public/certificates/verify/:token          • /chat/query (Bilingual RAG)                                    │  |
|  └────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┘  |
|                                                           │                                                           |
|  ┌─────────────────────────┐   ┌──────────────────────────┴───────────┐   ┌────────────────────────────────────────┐  |
|  │  Statutory Metrology    │   │  Security & Cryptographic DSC        │   │  Hybrid RAG & Knowledge Engine         │  |
|  │  • Decimal.js Exact Math│   │  • RFC 8785 JSON Canonicalization    │   │  • Statutory Corpus Vector + Token     │  |
|  │  • Stepped MPE Evaluator│   │  • SHA-256 Digest & Ed25519 Signing  │   │  • Google Gemini 3.6 Flash / Lite      │  |
|  │  • Standards Validator  │   │  • Simulated HSM DSC Key Ring        │   │  • Local Rule Synthesizer Fallback     │  |
|  │  • Canonical Trace Gen  │   │  • High-Entropy Opaque QR Generator  │   │  • Speech STT & TTS Boundary Tracking  │  |
|  │  • Standards Traceability│  │  • Pure TypeScript PDF/A-1b Renderer │   │  • Portal Intent Deep-Linking          │  |
|  └─────────────────────────┘   └──────────────────────────────────────┘   └────────────────────────────────────────┘  |
+-----------------------------------------------------------┬-----------------------------------------------------------+
                                                            │
                                                            ▼
+-----------------------------------------------------------------------------------------------------------------------+
|                                           PERSISTENCE & STORAGE LAYER                                                 |
|  ┌──────────────────────────────────────────────────────┐   ┌──────────────────────────────────────────────────────┐  |
|  │  Authoritative Relational Database (PostgreSQL 18)   │   │  Tamper-Evident Object Storage (S3-Compatible)       │  |
|  │  • 22 Domain Entities via Prisma ORM 6.x             │   │  • Rendered PDF/A-1b Archival Certificates           │  |
|  │  • Exact Precision: DECIMAL(18,6) & DECIMAL(12,2)    │   │  • SHA-256 Hashed Geo-Tagged Inspection Photos       │  |
|  │  • Tenant & Jurisdiction Logical Scoping Indexes     │   │  • Immutable Versioned Procedure & Policy Packs      │  |
|  └──────────────────────────────────────────────────────┘   └──────────────────────────────────────────────────────┘  |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 3.1 Technology Stack Inventory
- **Server Runtime:** Node.js v24.x LTS with TypeScript 5.x.
- **Web Framework:** Fastify v5 with `@fastify/cors`, `@fastify/helmet` (CSP + HSTS), `@fastify/rate-limit`, `fast-json-stringify`.
- **Database & ORM:** PostgreSQL 18 with Prisma ORM 6.x.
- **Exact Rational Arithmetic:** `decimal.js` (28-digit precision, `ROUND_HALF_UP`).
- **Cryptography & DSC:** Node.js `crypto` (Ed25519 key-pairs, SHA-256), RFC 8785 JSON Canonicalization Scheme (JCS).
- **Document Renderer:** Pure TypeScript Binary PDF/A-1b Document Generator (Zero external binary dependencies).
- **Frontend Applications:** React 18.x with Vite 6.x, Tailwind CSS 3.x, Lucide Icons, Web Speech API (`en-IN` & `hi-IN`), QRCode.js.
- **AI & RAG Engine:** Google Gemini 3.6 Flash / 3.5 Flash Lite API + Local Statutory Fallback Synthesizer.

---

# 4. Exact Metrological Calculation Engine & NAWI Testing

### 4.1 Non-Automatic Weighing Instruments (NAWI) Accuracy Classes
Under OIML R76-1 and Schedule VII of the Legal Metrology (General) Rules, 2011:

| Accuracy Class | Designation | Verification Scale Interval ($e$) | Minimum Capacity ($	ext{Min}$) | Number of Scale Intervals ($n = 	ext{Max}/e$) |
| :--- | :--- | :--- | :--- | :--- |
| **Class I** | Special Accuracy | $0.001	ext{ g} le e$ | $100e$ | $50,000 le n$ |
| **Class II** | High Accuracy | $0.001	ext{ g} le e le 0.050	ext{ g}$<br>$0.1	ext{ g} le e$ | $20e$<br>$50e$ | $100 le n le 100,000$<br>$5,000 le n le 100,000$ |
| **Class III** | Medium Accuracy | $0.1	ext{ g} le e le 2	ext{ g}$<br>$5	ext{ g} le e$ | $20e$<br>$20e$ | $100 le n le 10,000$<br>$500 le n le 10,000$ |
| **Class IIII** | Ordinary Accuracy | $5	ext{ g} le e$ | $10e$ | $100 le n le 1,000$ |

### 4.2 Stepped Maximum Permissible Error (MPE) Formulas
The system evaluates observed load errors against statutory stepped limits:

#### Initial Verification MPE Table:
| Test Load Range ($m$) in Scale Intervals ($e$) | Class I | Class II | Class III | Class IIII |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 Load** | $0 le m le 50,000e implies pm 0.5e$ | $0 le m le 5,000e implies pm 0.5e$ | $0 le m le 500e implies pm 0.5e$ | $0 le m le 50e implies pm 0.5e$ |
| **Tier 2 Load** | $50,000e < m le 200,000e implies pm 1.0e$ | $5,000e < m le 20,000e implies pm 1.0e$ | $500e < m le 2,000e implies pm 1.0e$ | $50e < m le 200e implies pm 1.0e$ |
| **Tier 3 Load** | $200,000e < m implies pm 1.5e$ | $20,000e < m le 100,000e implies pm 1.5e$ | $2,000e < m le 10,000e implies pm 1.5e$ | $200e < m le 1,000e implies pm 1.5e$ |

> [!NOTE]
> **In-Service & Periodic Re-Verification Rule:** Under General Rules 2011 Schedule VII, the Maximum Permissible Error in service / periodic re-verification is **equal to twice the initial verification MPE** ($2 	imes 	ext{MPE}_{	ext{initial}}$).

### 4.3 Exact Mathematical Error Formulations
1. **Turning Point Indication ($P$):**
   $$P = I + 0.5e - Delta L$$
   *(where $I$ is Indicated Value, $e$ is verification interval, and $Delta L$ is additional fractional load added to shift to next digit).*
2. **Observed Error ($E$):**
   $$E = P - L = (I + 0.5e - Delta L) - L$$
   *(where $L$ is statutory reference standard load).*
3. **Zero-Load Error ($E_0$):**
   $$E_0 = (I_0 + 0.5e - Delta L_0) - 0$$
4. **Corrected Error ($E_c$):**
   $$E_c = E - E_0$$
   *Statutory Pass Invariant:* $|E_c| le 	ext{MPE}(L)$.
5. **5-Position Eccentricity (Corner Load) Test:**
   A test load of $rac{1}{3}	ext{Max}$ (or $rac{1}{4}	ext{Max}$ for instruments with $ge 4$ support points) is applied at Center, Front-Left, Front-Right, Back-Left, and Back-Right.  
   *Invariant:* $|E_{c, 	ext{pos}}| le 	ext{MPE}(rac{1}{3}	ext{Max})$ for all 5 positions.
6. **Repeatability Spread ($Delta P$):**
   Conducted with at least 3 load applications at $50%	ext{Max}$ and $100%	ext{Max}$.  
   $$Delta P = P_{max} - P_{min} le |	ext{MPE}(L)|$$

---

# 5. National Reference Standards Traceability Pyramid & Fail-Closed Safety

```
                                  ┌─────────────────────────────────────────────────┐
                                  │           NPL INDIA (NEW DELHI)                 │
                                  │       National Prototype Mass Standard          │
                                  └────────────────────────┬────────────────────────┘
                                                           │ Calibrated Every 5 Years
                                                           ▼
                                  ┌─────────────────────────────────────────────────┐
                                  │          RRSL (REGIONAL LABORATORIES)           │
                                  │         Reference Standard Weight Sets          │
                                  └────────────────────────┬────────────────────────┘
                                                           │ Calibrated Every 2 Years
                                                           ▼
                                  ┌─────────────────────────────────────────────────┐
                                  │      STATE SECONDARY STANDARD LABORATORIES      │
                                  │         Secondary Standard Weight Sets          │
                                  └────────────────────────┬────────────────────────┘
                                                           │ Calibrated Every 2 Years
                                                           ▼
                                  ┌─────────────────────────────────────────────────┐
                                  │         WORKING STANDARDS (LMO / GATC)          │
                                  │     Working Standard Weights (E2, F1, F2, M1)   │
                                  └────────────────────────┬────────────────────────┘
                                                           │ Field Verification
                                                           ▼
                                  ┌─────────────────────────────────────────────────┐
                                  │         COMMERCIAL INSTRUMENTS (NAWI)           │
                                  │      Retail Scales, Weighbridges, Balances      │
                                  └─────────────────────────────────────────────────┘
```

### 5.1 Working Standards Statutory Calibration Matrix
| Standard Accuracy Class | Allowed Use Cases | Mandatory Calibration Frequency | Traceable To |
| :--- | :--- | :--- | :--- |
| **Class $E_2$** | High-precision Class I analytical balances ($le 1	ext{ mg}$) | 24 Months (2 Years) | RRSL / NPL India |
| **Class $F_1$** | Class II laboratory scales ($1	ext{ mg} - 50	ext{ mg}$) | 24 Months (2 Years) | State Secondary Lab / RRSL |
| **Class $F_2$** | High-capacity Class II & Class III scales | 24 Months (2 Years) | State Secondary Lab |
| **Class $M_1$ / $M_2$**| Commercial retail scales & heavy weighbridges ($> 100	ext{ mg}$) | 24 Months (2 Years) | State Secondary Lab |

### 5.2 Automated Fail-Closed Calibration Safety Invariant
The Reference Standards Validator (`backend/src/metrology/standards.validator.ts`) checks:
1. **Status Active:** Standard must have `calibration_status == 'ACTIVE'`.
2. **Date Validity at Session Timestamp:** $	ext{test_timestamp} le 	ext{valid_until}$. If $	ext{test_timestamp} > 	ext{valid_until}$, the standard is immediately classified as `EXPIRED`.
3. **Expanded Uncertainty Guard:**
   $$U_{	ext{standard}} le rac{1}{3}	ext{MPE}_{	ext{step}}$$
4. **Hard-Blocking Invariant:** If any assigned standard fails, the verification session **HARD-BLOCKS** and returns `422 Unprocessable Entity`. No certificate can be generated.
5. **Impact Review Workflow:** If an RRSL calibration subsequently finds a standard out-of-tolerance, the system automatically flags all historical sessions conducted with that asset tag during the disputed interval for supervisory review.

---

# 6. Physical-Digital Separation & Anti-Cloning Defenses

### 6.1 Foundational Invariant: Physical & Digital Separation (ADR-004)
Under Section 24 and Rule 27 of The Legal Metrology Act, 2009, **digital certificates and QR tokens do not replace physical lead-wire stamping**.
- The **Physical Lead-Wire Seal** locks the mechanical calibration jumper, load cell junction box, and load-receptor housing against physical manipulation.
- The **Digital Certificate & 256-Bit QR Token** provide instant cryptographic authenticity, provenance verification, and tamper detection.

```
+-------------------------------------------------------------------------------------------------------+
|                                    4-LAYER ANTI-CLONING DEFENSE MATRIX                                |
+-------------------------------------------------------------------------------------------------------+
|  Layer 1: Visual Parity Reconciliation                                                                |
|  Citizen scan displays: Approved Model Name, Masked Serial (e.g. PH-***-991), and Embossed Lead-Wire  |
|  Seal Serial (e.g. SEAL-DL-2026-9941). If the physical scale label does not match, fraud is exposed.  |
+-------------------------------------------------------------------------------------------------------+
|  Layer 2: Tamper-Evident Destructible Vinyl Physical Stickers                                         |
|  QR stickers are printed on specialized void-destructible security vinyl that tears into fragments.   |
+-------------------------------------------------------------------------------------------------------+
|  Layer 3: Geolocation & Scan Anomaly Heuristics                                                       |
|  If a token registered to Chandni Chowk, Delhi is scanned concurrently from Mumbai, anomaly triggers.  |
+-------------------------------------------------------------------------------------------------------+
|  Layer 4: Sovereign Spot Inspections & Seizure Memos                                                  |
|  LMOs execute spot inspections under Section 15 with instant mobile seizure memo drafting.            |
+-------------------------------------------------------------------------------------------------------+
```

### 6.2 The 256-Bit High-Entropy Opaque QR Reference Token
**Anti-Pattern Avoidance:** Raw JSON or PII is **never encoded inside the QR code**.  
**Security Standard:**
1. A cryptographically random 256-bit opaque token is generated: `cert_tok_` + 32 base64url bytes (`256 bits entropy`).
2. The QR embeds only: `https://emetrology.gov.in/verify/qr/{opaque_token}`.
3. The server looks up the PostgreSQL cryptographic ledger, checks status, and projects a Zero-PII public verification summary.
4. **Sub-Millisecond Revocation:** Revoked/suspended certificates propagate instantly across all public scans.

### 6.3 Cryptographic DSC Signing Pipeline
```
[Render Immutable Canonical JSON Snapshot]
                 │
                 ▼
[RFC 8785 JSON Canonicalization Scheme (JCS) Sorting]
                 │
                 ▼
[Compute Cryptographic SHA-256 Digest]
                 │
                 ▼
[Sign with Ed25519 HSM / DSC Private Key]
                 │
                 ▼
[Generate Standalone Binary PDF/A-1b Archival Document]
                 │
                 ▼
[Store in Tamper-Proof Object Storage & Record Hash in Ledger]
```

---

# 7. Multi-Tenancy, Jurisdictional Isolation & Security Architecture

### 7.1 Multi-Tenant Logical Partitioning
- Every domain record belongs to an immutable `tenant_id` (State/UT level, e.g. `tenant-delhi`, `tenant-maharashtra`) and `jurisdiction_id` (e.g. `jur-dl-south-01`).
- Fastify middleware `tenantGuard` extracts `X-Tenant-Id` and `X-Jurisdiction-Id` headers and strictly restricts query execution.
- Cross-tenant probes immediately throw `403 Forbidden` and record a security incident in `audit_logs`.

### 7.2 Strict Role-Based & Attribute-Based Access Control (RBAC/ABAC) Matrix
| Role | Code | Scope & Permitted Actions |
| :--- | :--- | :--- |
| **Trader / Instrument Owner** | `OWNER` / `APPLICANT` | Register instruments, submit applications, pay statutory fees, view/download issued certificates. |
| **Legal Metrology Officer** | `LMO` | Scrutinize applications, issue queries, conduct 4-step NAWI tests, record lead seals, DSC sign certificates. |
| **GATC Verifier** | `GATC_VERIFIER` | Perform authorized verification tests within accredited capacity scope; submit Verification Test Reports. |
| **Supervisor / Assistant Controller** | `SUPERVISOR` / `CONTROLLER` | Monitor SLA pendency queues, reassign officers, inspect audit logs, approve high-impact adjustments. |
| **National / State Administrator** | `ADMIN` | Manage tenant/jurisdiction policies, provision users, register model approvals, master data governance. |
| **Statutory Auditor** | `AUDITOR` | Read-only access to immutable audit trails, ledger transactions, and compliance logs. |
| **Public Consumer** | `PUBLIC_VERIFIER` | Scan QR tokens, check real-time certificate validity, verify physical seal numbers, download valid PDF/A. |

### 7.3 Token Security & Refresh Token Rotation
- **Session Tokens:** Signed JWTs with short expiry (15 minutes).
- **Refresh Token Families:** Stored in database (`refresh_tokens`), bound to IP and User-Agent.  
- **Theft Detection:** If a revoked refresh token is reused, the entire token family is immediately revoked, forcing re-authentication.

---

# 8. Statutory State Machine Lifecycles & Transition Invariants

```
                               ┌─────────────────────────────────────────────────────────┐
                               │       VERIFICATION APPLICATION STATE MACHINE            │
                               └────────────────────────────┬────────────────────────────┘
                                                            │
                                                            ▼
    ┌──────────┐      Submit       ┌───────────┐     Scrutinize      ┌─────────────────┐
    │  DRAFT   │ ────────────────> │ SUBMITTED │ ──────────────────> │ UNDER_SCRUTINY  │
    └──────────┘                   └───────────┘                     └────────┬────────┘
                                                                              │
                                               ┌──────────────────────────────┼──────────────────────────────┐
                                               ▼                              ▼                              ▼
                                     ┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
                                     │   QUERY_RAISED   │           │     REJECTED     │           │     ACCEPTED     │
                                     └────────┬─────────┘           └──────────────────┘           └────────┬─────────┘
                                              │                                                             │
                                              │ Respond                                                     │ Assess Fee
                                              ▼                                                             ▼
                                     ┌──────────────────┐                                          ┌──────────────────┐
                                     │  QUERY_RESPONDED │ ───────────────────────────────────────> │   FEE_PENDING    │
                                     └──────────────────┘                                          └────────┬─────────┘
                                                                                                            │
                                                                                                            │ Pay Fee
                                                                                                            ▼
    ┌───────────┐      Complete      ┌──────────────────────────┐      Schedule / Start    ┌──────────────────┐
    │ COMPLETED │ <───────────────── │ VERIFICATION_IN_PROGRESS │ <─────────────────────── │ PAYMENT_RECONC   │
    └───────────┘                    └──────────────────────────┘                          └──────────────────┘
```

### 8.1 Verification Session State Machine
$$\text{PLANNED} \longrightarrow \text{IDENTITY\_CONFIRMED} \longrightarrow \text{IN\_PROGRESS} \longrightarrow \text{SUBMITTED} \longrightarrow \begin{cases} \text{PASSED\_PENDING\_AUTHORIZATION} \\ \text{FAILED} \\ \text{NEEDS\_REVIEW} \end{cases} \longrightarrow \text{FINALIZED}$$

### 8.2 Digital Certificate State Machine
$$\text{DRAFT} \longrightarrow \text{PENDING\_SIGNATURE} \longrightarrow \text{ISSUED} \longrightarrow \begin{cases} \text{VALID} \longrightarrow \text{EXPIRED} \\ \text{SUSPENDED} \\ \text{REVOKED} \\ \text{SUPERSEDED} \end{cases}$$

### 8.3 Reference Standard State Machine
$$\text{ACTIVE} \longrightarrow \text{DUE\_CALIBRATION} \longrightarrow \begin{cases} \text{UNDER\_CALIBRATION} \longrightarrow \text{ACTIVE} \\ \text{QUARANTINED} \\ \text{EXPIRED} \longrightarrow \text{RETIRED} \end{cases}$$

---

# 9. Authoritative 22-Entity Data Model & Schema Specification

The relational persistence layer is formally defined in Prisma schema (`backend/prisma/schema.prisma`):

| Entity Name | Primary Key | Key Attributes & Foreign Keys | Core Purpose |
| :--- | :--- | :--- | :--- |
| `Tenant` | `tenant_id` (UUID) | `state_code`, `state_name`, `status`, `config` | State/UT jurisdictional tenant container. |
| `Jurisdiction` | `jurisdiction_id` (UUID) | `tenant_id` (FK), `parent_jurisdiction_id` (FK), `code`, `level` | Hierarchical administrative boundaries (Zone $\to$ District $\to$ Office). |
| `Stakeholder` | `stakeholder_id` (UUID) | `tenant_id` (FK), `jurisdiction_id` (FK), `stakeholder_type`, `legal_name`, `identifier_value` | Legal entities (Traders, Manufacturers, Repairers, GATCs). |
| `Facility` | `facility_id` (UUID) | `tenant_id` (FK), `stakeholder_id` (FK), `district`, `gps_latitude`, `gps_longitude` | Physical premises where instruments or test benches reside. |
| `User` | `user_id` (UUID) | `tenant_id` (FK), `stakeholder_id` (FK), `email`, `role`, `password_hash`, `is_active` | Authenticated operators across all roles. |
| `LMOProfile` | `user_id` (PK/FK) | `tenant_id` (FK), `jurisdiction_id` (FK), `posting_order_number`, `digital_signature_cert_id` | Government officer authorization and posting credentials. |
| `GATCProfile` | `gatc_id` (UUID) | `tenant_id` (FK), `facility_id` (FK), `approval_order_number`, `approved_scope`, `valid_to` | Accredited third-party laboratory verification scope. |
| `InstrumentModel`| `model_id` (UUID) | `model_approval_number` (Unique), `accuracy_class`, `min_capacity`, `max_capacity`, `verification_scale_interval_e` | Central Model Approval registry (`IND/09/YYYY/XXX`). |
| `Instrument` | `instrument_id` (UUID) | `public_instrument_token` (Unique), `model_id` (FK), `owner_id` (FK), `serial_number`, `current_status`, `verification_due_date` | Registered physical weighing/measuring unit. |
| `FeeAssessment` | `fee_assessment_id` (UUID)| `tenant_id` (FK), `base_verification_fee`, `late_fee`, `total_assessed_amount`, `payment_status`, `receipt_number` | Itemized statutory fee calculations and challans. |
| `VerificationApplication` | `application_id` (UUID)| `application_number` (Unique), `instrument_id` (FK), `applicant_id` (FK), `assigned_lmo_id` (FK), `current_status`, `version` | Formal verification filing and scrutiny lifecycle. |
| `ReferenceStandard`| `standard_id` (String) | `tenant_id` (FK), `custodian_type`, `denomination_mass`, `accuracy_class`, `calibration_certificate_number`, `valid_until` | Physical standard weights traceable to RRSL/NPL. |
| `VerificationSession`| `session_id` (UUID) | `application_id` (FK), `instrument_id` (FK), `verifier_id` (FK), `procedure_pack_checksum`, `status`, `outcome` | On-site / in-lab verification execution record. |
| `SessionReferenceStandard`| `(session_id, standard_id)` | `snapshot_calibration_certificate`, `snapshot_valid_until`, `verified_suitable` | Immutable snapshot of standards used in a test session. |
| `TestObservation`| `observation_id` (UUID) | `session_id` (FK), `step_type`, `nominal_load`, `raw_indication_reading`, `observed_error`, `mpe_allowed`, `is_within_mpe`, `calculation_trace` | Append-only exact test point observation log. |
| `PhysicalStampAction`| `stamp_action_id` (UUID)| `session_id` (FK), `instrument_id` (FK), `verifier_id` (FK), `seal_type`, `seal_identification_number`, `photo_evidence_hash` | Embossed lead-wire and hologram stamp recording. |
| `Certificate` | `certificate_id` (UUID) | `certificate_number` (Unique), `public_verification_token` (Unique), `session_id` (FK), `certificate_bytes_sha256`, `pdf_storage_path` | Tamper-proof signed verification certificate. |
| `CertificateStatusEvent`| `status_event_id` (UUID)| `certificate_id` (FK), `previous_status`, `new_status`, `actor_id` (FK), `reason`, `statutory_authority_reference` | Append-only certificate lifecycle audit log. |
| `AuditLog` | `audit_id` (UUID) | `tenant_id`, `actor_id`, `action`, `entity_type`, `correlation_id`, `before_state`, `after_state`, `recorded_at` | Sovereign security and transactional audit ledger. |
| `RefreshToken` | `token_id` (UUID) | `user_id` (FK), `family_id`, `token_hash` (Unique), `expires_at`, `revoked_at` | Rotating session refresh token family. |
| `ProcedurePack` | `pack_id` (String) | `version`, `checksum_sha256`, `accuracy_class_scope`, `effective_from`, `schema_definition` | Immutable versioned procedure definitions. |
| `KnowledgeChunk` | `chunk_id` (UUID) | `category`, `act_name`, `section_rule_ref`, `title`, `content`, `keywords`, `citation_label` | Statutory ground-truth corpus for AI RAG. |

---

# 10. Core Functional Modules & Detailed User Workflows

### 10.1 Multi-Role Authentication & Access Control
- **Unified Login:** Supports Email/Password + OTP Step-Up + WebAuthn/Biometric.
- **Fast Persona Switching:** Single-click persona switcher for development/demonstration (`Trader`, `LMO`, `Supervisor`, `Admin`).
- **Session Protection:** `HttpOnly`, `SameSite=Strict` secure cookie handling with automated refresh token family rotation.

### 10.2 Trader & Instrument Owner Portal
1. **Instrument Registration:** Capture Make, Model, Central Model Approval No., Serial No., Year, and Counter Location.
2. **4-Step Verification Wizard:**
   - *Step 1:* Select registered instrument from list.
   - *Step 2:* Select Verification Type (Initial, Periodic Annual, After-Repair) and Service Mode (On-site vs Departmental Lab).
   - *Step 3:* View automated statutory fee assessment computed under Schedule XII.
   - *Step 4:* Accept legal truthfulness declaration under Section 19/24 and submit.
3. **Treasury Fee Payment:** Simulate or execute e-GRAS/BharatKosh gateway payment; instantly generates itemized government fee receipt with GSTIN and Transaction ID.
4. **Certificate Vault:** View green Form 8 Legal Metrology Verification Certificates with embedded QR code and download signed binary PDF/A files.

### 10.3 Legal Metrology Officer (LMO) Workspace
1. **Scrutiny Queue:** Inspect incoming applications, review trader documents, accept applications, or raise deficiency queries with automated SLA clock pause.
2. **Guided NAWI 4-Step Metrological Calculator:**
   - *Zero Load & Tare Test:* Validates indication return to $\pm 0.25e$.
   - *Linearity Load & Unload Test:* 5 distributed load points from Min to Max; real-time MPE badge (`WITHIN MPE` or `EXCEEDS MPE`).
   - *5-Position Eccentricity Test:* Center and 4 corner tests at $\frac{1}{3}\text{Max}$; evaluates corner deviation.
   - *Repeatability Test:* 3 consecutive runs at $50\%$ and $100\%$ Max; evaluates spread $\Delta P \le \text{MPE}$.
3. **Physical Stamp Ledger:** Record applied physical lead-wire seal serial number (`SEAL-DL-2026-XXXX`) and attach photo evidence.
4. **DSC Signing & Issuance:** Enter DSC PIN / token credentials to trigger Ed25519 cryptographic signing, generating authoritative PDF/A and 256-bit QR token.

### 10.4 Supervisor & Assistant Controller SLA Oversight Dashboard
1. **State-Wide Real-Time Metrics:** Total active instruments, compliance percentage, fee revenue collected, and active LMOs.
2. **Pendency Age Analysis:**
   - 🟢 `< 7 Days`: Citizen Charter Target (Optimal).
   - 🟡 `7 - 15 Days`: Normal Processing Window.
   - 🟠 `15 - 30 Days`: Pending Attention.
   - 🔴 `> 30 Days`: Red Alert (Statutory SLA Breach).
3. **Officer Workload Balancing & Task Reassignment:** View individual officer turnaround averages and reassign pending applications with logged justification.
4. **Security Audit Log Browser:** Full-fidelity append-only event stream tracking all high-impact actions.

### 10.5 National Admin & Master Governance Portal
- **Dedicated Application:** Built in `apps/admin-portal` for Ministry and State Controllers.
- **Master Data Governance:** Provision LMO profiles, approve GATC laboratories, register Central Model Approvals, manage fee schedules.
- **Two-Person Approval Workflow:** High-impact administrative actions (user provisioning, GATC approval) submit approval requests reviewed by a Controller.
- **System Health Monitor:** Real-time database connectivity, Redis cache latency, and background worker status.

### 10.6 GATC (Government Approved Test Centre) Management
- Manage third-party laboratory verification queues within accredited capacity limits (e.g. Class III up to 50 kg).
- Track calibration equipment custody and reference standard validity.
- Submit Verification Test Reports (VTR) for departmental endorsement.

### 10.7 Legacy Paper Register Migration & OCR Ingestion Pipeline
- Bulk import historical paper registers via CSV/JSON batches.
- **4-Tier Provenance Trust State Machine:**
  - `DIGITIZED_FROM_SOURCE`: Raw OCR scan parsed, pending verification.
  - `UNVERIFIED_LEGACY`: Partial match with discrepancies.
  - `VERIFIED_LEGACY`: Inspected and approved by jurisdictional LMO.
  - `CONFLICTED`: Duplicate serial or mismatched capacity flagged for manual resolution.

### 10.8 Public Zero-PII QR Verification & Authenticity Portal
- Citizen scans physical scale QR sticker or navigates to `/verify/qr/:token`.
- **Displayed Metadata:** Real-time status badge (`VALID`, `EXPIRED`, `REVOKED`), Certificate Number, Make/Model, Masked Serial (`PH-***-491`), Applied Physical Seal Serial (`SEAL-DL-2026-9941`), SHA-256 Document Hash.
- **Zero-PII Assurance:** Trader phone numbers, financial details, and personal residential addresses are completely omitted.

### 10.9 Bilingual Ground-Truth AI Assistant (Nikks Mascot & Voice Engine)
- **Hybrid RAG Pipeline:** Combines token matching and vector embeddings against vectorized Legal Metrology legislation chunks (`The Legal Metrology Act, 2009`, `General Rules, 2011`, `Packaged Commodities Rules, 2011`).
- **Strict Anti-Hallucination Prompting:** Powered by Google Gemini 3.6 Flash / 3.5 Flash Lite; strictly cites statutory Sections/Rules.
- **Local Statutory Synthesizer Fallback:** If internet or API fails, an internal deterministic rule engine answers queries with zero downtime.
- **Bilingual Web Speech API (STT & TTS):** Voice input in Hindi/English; audio readout with variable playback speeds (`0.8x` to `1.8x`) and real-time word boundary tracking (`onboundary` & `charIndex`).
- **Portal Action Deep-Linking:** RAG parses user intent and outputs interactive UI buttons directly navigating the user to application filing, fee payment, or certificate download.

### 10.10 Evidence & Photo Custody Protocol
- Client-side SHA-256 hashing of inspection photos before upload.
- Automated EXIF extraction (GPS coordinates, device timestamp, camera model) to detect backdated or falsified inspections.
- Tamper-evident storage in versioned S3 object storage with hash verification on download.

### 10.11 Offline-First Field Verification Protocol
- Local AES-256 encrypted SQLite storage bound to device hardware keystore.
- Pre-caches assigned applications and signed procedure packs before field visits.
- Captures observations offline and queues signed sync payloads in a Transactional Outbox.
- Upon connectivity restoration, the server re-evaluates all observations deterministically before signing the certificate.

### 10.12 Treasury & Statutory Fee Reconciliation
- Integrated with e-GRAS and BharatKosh payment gateways.
- Asynchronous webhook listeners with idempotent replay protection.
- Automated reconciliation between gateway settlement reports and internal double-entry fee ledgers.

---

# 11. Complete REST API Specification

Mounted under prefix `/api/v1` (with `/public/certificates/verify/:token` and `/verify/qr/:token` available publicly):

| Method | Endpoint Route | Pre-Handlers / Guards | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | RateLimit | Authenticate user; returns JWT session and sets refresh cookie. |
| `POST` | `/auth/refresh` | CookieGuard | Rotate refresh token family and issue new JWT. |
| `POST` | `/auth/logout` | AuthGuard | Revoke refresh token family and clear session. |
| `GET` | `/tenants/:tenantId/instruments` | TenantGuard, RBAC | List registered instruments for tenant/owner. |
| `POST` | `/tenants/:tenantId/instruments` | TenantGuard, RBAC | Register new physical instrument in registry. |
| `GET` | `/tenants/:tenantId/instruments/:id` | TenantGuard, RBAC | Get detailed instrument profile and certificate history. |
| `GET` | `/tenants/:tenantId/instruments/models`| TenantGuard | List approved instrument models. |
| `GET` | `/tenants/:tenantId/applications` | TenantGuard, RBAC | List verification applications (filtered by role). |
| `POST` | `/tenants/:tenantId/applications` | TenantGuard, RBAC | Submit new verification application. |
| `GET` | `/tenants/:tenantId/applications/:id` | TenantGuard, RBAC | Get application details, fee assessment, and timeline. |
| `POST` | `/tenants/:tenantId/applications/:id/scrutiny`| TenantGuard, LMO | Accept application, raise query, or reject. |
| `POST` | `/tenants/:tenantId/applications/:id/correction`| TenantGuard, Owner | Submit response/documents to raised query. |
| `POST` | `/tenants/:tenantId/applications/:id/fee` | TenantGuard, LMO | Assess Schedule XII statutory fees. |
| `POST` | `/tenants/:tenantId/applications/:id/pay` | TenantGuard, Owner | Simulate or record payment receipt and reconcile. |
| `POST` | `/tenants/:tenantId/applications/:id/schedule`| TenantGuard, LMO | Schedule inspection date and slot. |
| `GET` | `/tenants/:tenantId/sessions` | TenantGuard, RBAC | List verification sessions. |
| `POST` | `/tenants/:tenantId/sessions` | TenantGuard, LMO | Initialize verification session for application. |
| `POST` | `/tenants/:tenantId/sessions/:id/identity`| TenantGuard, LMO | Confirm physical serial number match on site. |
| `POST` | `/tenants/:tenantId/sessions/:id/start` | TenantGuard, LMO | Lock session and validate reference standards. |
| `POST` | `/tenants/:tenantId/sessions/:id/observations`| TenantGuard, LMO | Record batch of exact decimal test observations. |
| `POST` | `/tenants/:tenantId/sessions/:id/disposition`| TenantGuard, LMO | Finalize verification outcome (Passed / Failed). |
| `POST` | `/tenants/:tenantId/sessions/:id/stamps`| TenantGuard, LMO | Record applied lead-wire seal identification. |
| `GET` | `/tenants/:tenantId/certificates` | TenantGuard, RBAC | List certificates. |
| `POST` | `/tenants/:tenantId/certificates/issue`| TenantGuard, LMO | Sign and issue certificate with RFC 8785 Ed25519 DSC. |
| `POST` | `/tenants/:tenantId/certificates/:id/status`| TenantGuard, Supervisor | Update certificate status (Suspend / Revoke). |
| `GET` | `/tenants/:tenantId/certificates/:id/pdf`| TenantGuard, RBAC | Download binary PDF/A archival certificate. |
| `POST` | `/tenants/:tenantId/evidence/verify-and-ingest`| TenantGuard, LMO | Upload and verify client-side hashed photo evidence. |
| `GET` | `/public/certificates/verify/:token` | Public (RateLimit) | Zero-PII public certificate verification endpoint. |
| `GET` | `/verify/qr/:token` | Public (RateLimit) | Public resolver for physical QR stickers. |
| `POST` | `/chat/query` | Public/Auth (RateLimit)| Bilingual RAG legal query endpoint. |
| `GET` | `/chat/suggestions` | Public | Contextual prompt suggestions. |
| `GET` | `/chat/sources` | Public | List indexed statutory corpus records. |
| `GET` | `/admin/overview` | AdminGuard | Executive national/state KPI metrics. |
| `GET` | `/admin/health` | AdminGuard | System health and database connectivity. |
| `GET` | `/admin/jurisdictions` | GovernanceGuard | List jurisdictional boundaries. |
| `POST` | `/admin/users/provision` | GovernanceGuard | Provision new officers/verifiers. |
| `POST` | `/admin/gatc/register` | GovernanceGuard | Register and approve GATC laboratory. |
| `POST` | `/admin/models/register` | GovernanceGuard | Register Central Model Approval. |
| `POST` | `/admin/approvals/submit` | GovernanceGuard | Submit administrative approval request. |
| `POST` | `/admin/approvals/:id/review` | GovernanceGuard | Approve or reject administrative request. |
| `GET` | `/admin/db/:table` | AdminGuard | Browse raw database entity records. |
| `GET` | `/admin/audit-logs` | AdminGuard | Query append-only security audit log. |

---

# 12. Non-Functional Requirements & Performance SLOs

```
+-------------------------------------------------------------------------------------------------------+
|                                    SERVICE LEVEL OBJECTIVES (SLO)                                     |
+------------------------------------+----------------------------------+-------------------------------+
| Metric                             | Target SLA / SLO                 | Architectural Enforcement     |
+------------------------------------+----------------------------------+-------------------------------+
| System Availability                | 99.95% Annual Uptime             | Multi-AZ Kubernetes Deployment|
| API Latency (p95)                  | < 15 ms                          | Fastify v5 + Indexed Queries  |
| Public QR Scan Latency (p99)       | < 50 ms                          | Edge Redis In-Memory Cache    |
| Transaction Throughput             | > 35,000 req/sec                 | Node.js 24 Event Loop Tuning  |
| Recovery Point Objective (RPO)     | < 5 seconds                      | Continuous PostgreSQL WAL Rep |
| Recovery Time Objective (RTO)      | < 60 seconds                     | Automated Health-Check Failovr|
| Arithmetic Precision Drift         | 0.0000000000000000000000000000   | Decimal.js Rational Engine    |
| Certificate Generation Latency     | < 250 ms (PDF/A + Ed25519)       | Pure TypeScript In-Memory Gen |
+------------------------------------+----------------------------------+-------------------------------+
```

### 12.1 Security, Privacy & Regulatory Compliance
- **Data Protection:** 100% compliant with the **Digital Personal Data Protection (DPDP) Act, 2023** (Zero-PII on public endpoints, role-scoped data access).
- **Network Security:** Strict Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), and CORS policies via `@fastify/helmet`.
- **Cryptographic Rigor:** RFC 8785 JSON Canonicalization, SHA-256 message digests, Ed25519 digital signing, 256-bit entropy QR tokens.
- **Audit Trails:** Immutable, append-only audit ledger with correlation IDs, client IPs, and user agents for every write action.

### 12.2 Accessibility & Linguistic Inclusivity
- **WCAG 2.1 Level AA Compliance:** High-contrast color palettes, screen-reader aria attributes, keyboard navigation.
- **Bilingual Interface:** Full English and Hindi UI localization (`apps/verification-web/src/i18n`).
- **Voice-First Navigation:** Web Speech API STT and TTS with real-time word boundary tracking and speed modulation (`0.8x` to `1.8x`).

---

# 13. Quality Assurance & 5-Tier Testing Framework

The platform is validated through a rigorous **5-Tier Quality Assurance Framework** with **399 automated tests passing 100% green**:

```
                                  ┌─────────────────────────────────────────────────┐
                                  │      TIER 5: WHITE-BOX ADVERSARIAL HARNESS      │
                                  │  Adversarial Probes, Tampering, Negative Crypto │
                                  └────────────────────────┬────────────────────────┘
                                                           │
                                                           ▼
                                  ┌─────────────────────────────────────────────────┐
                                  │       TIER 4: END-TO-END SCENARIO SUITE         │
                                  │ Multi-Role Full Lifecycles (Trader -> LMO -> QR)│
                                  └────────────────────────┬────────────────────────┘
                                                           │
                                                           ▼
                                  ┌─────────────────────────────────────────────────┐
                                  │       TIER 3: PAIRWISE COMBINATORIAL SUITE      │
                                  │ Multi-Tenant, Jurisdictions & Cross-Role Probes │
                                  └────────────────────────┬────────────────────────┘
                                                           │
                                                           ▼
                                  ┌─────────────────────────────────────────────────┐
                                  │       TIER 2: BOUNDARY & STEPPED MPE SUITE      │
                                  │ Exact Load Steps (500e, 2000e), Scale Intervals │
                                  └────────────────────────┬────────────────────────┘
                                                           │
                                                           ▼
                                  ┌─────────────────────────────────────────────────┐
                                  │      TIER 1: FEATURE & UNIT COMPONENT SUITE     │
                                  │ Decimal.js Math, State Machines, JWT Auth, RAG  │
                                  └─────────────────────────────────────────────────┘
```

### 13.1 Test Suite Breakdown
| Test Suite / Tier | File Location | Tests | Validation Focus |
| :--- | :--- | :---: | :--- |
| **Unit Metrology & Decimal** | `backend/tests/unit/metrology.test.ts` | 42 | Exact arithmetic, turning point $P$, error $E_c$, rounding. |
| **Stepped MPE & Evaluator** | `backend/tests/mpe.test.ts` | 38 | Class I-IIII stepped MPE functions, initial vs in-service. |
| **NAWI Test Engine** | `backend/tests/nawi.evaluator.test.ts` | 35 | Eccentricity, repeatability, tare test, zero balance. |
| **Standards Validator** | `backend/tests/standards.validator.test.ts` | 28 | Calibration expiry, quarantine blocking, uncertainty ratio. |
| **State Machines** | `backend/tests/state-machines.test.ts` | 32 | Application, session, certificate, standard lifecycle guards. |
| **DSC & Cryptography** | `backend/tests/security.test.ts` | 26 | RFC 8785 JCS, SHA-256 digest, Ed25519 signing, QR token. |
| **Evidence Security** | `backend/tests/evidence.security.test.ts` | 22 | SHA-256 client-side hash verification, EXIF validation. |
| **Hybrid RAG & Corpus** | `backend/tests/rag.test.ts` | 24 | Statutory corpus retrieval, Gemini fallback synthesizer. |
| **Fastify API Integration** | `backend/tests/integration/api.test.ts` | 45 | All REST endpoints, multi-tenancy, RBAC/ABAC guards. |
| **Admin & Governance API** | `backend/tests/integration/admin.test.ts`| 34 | User provisioning, GATC registration, approval workflow. |
| **Auth & Refresh Tokens** | `backend/tests/integration/auth.test.ts` | 28 | Password hashing, JWT rotation, theft family revocation. |
| **Challenger Metrology Probes**| `backend/tests/challenger_metrology_probe.test.ts`| 25 | Stepped boundary microgram edge cases, zero drift. |
| **Challenger Adversarial** | `backend/tests/challenger2_adversarial.test.ts` | 20 | SQL injection, cross-tenant leaks, tampered tokens. |
| **Total Automated Tests** | **399 / 399 Tests Passing** | **100% Pass** | **$< 5.0\text{s}$ Total Execution Time** |

---

# 14. Deployment Topology, Rollout Milestones & Disaster Recovery

### 14.1 Production Cloud Architecture
- **Container Orchestration:** Kubernetes / OpenShift cluster across 3 Availability Zones (AZ).
- **Control Plane Pods:** Scaled Fastify Node.js containers with horizontal pod autoscalers (HPA) configured for CPU $> 70\%$ or memory $> 75\%$.
- **Database Cluster:** PostgreSQL 18 Primary with 2 Read Replicas (sync WAL replication within primary AZ, async to secondary AZ).
- **Caching Layer:** Redis Cluster (3-node master-replica) for high-frequency QR token resolution and session blacklist.
- **Storage:** MinIO / AWS S3 Object Storage with object lock and versioning enabled for immutable PDF/A storage.

```
                              ┌─────────────────────────────────────────────────────────┐
                              │     National Cloud Ingress / Load Balancer (HTTPS)      │
                              └────────────────────────────┬────────────────────────────┘
                                                           │
                                ┌──────────────────────────┴──────────────────────────┐
                                ▼                                                     ▼
              ┌───────────────────────────────────┐                 ┌───────────────────────────────────┐
              │   Availability Zone 1 (Primary)   │                 │  Availability Zone 2 (Secondary)  │
              │  • Fastify Control Plane Pods     │                 │  • Fastify Control Plane Pods     │
              │  • PostgreSQL 18 Primary          │ ──────────────> │  • PostgreSQL 18 Read Replica     │
              │  • Redis Primary Cache            │   Sync WAL      │  • Redis Replica Cache            │
              │  • Asynchronous Durable Workers   │                 │  • Asynchronous Durable Workers   │
              └───────────────────────────────────┘                 └───────────────────────────────────┘
```

### 14.2 National Phased Rollout Strategy
```
+-------------------------------------------------------------------------------------------------------+
| Phase 1: Foundation Pilot (Month 1 - 3)                                                                |
| Deploy in NCT of Delhi and Chandigarh UT; onboard 10,000 retail scales and 5 GATC test centers.       |
+-------------------------------------------------------------------------------------------------------+
| Phase 2: Regional Expansion (Month 4 - 6)                                                             |
| Expand to Maharashtra, Gujarat, and Karnataka; integrate BharatKosh and state treasury e-GRAS.        |
+-------------------------------------------------------------------------------------------------------+
| Phase 3: Nationwide Deployment (Month 7 - 12)                                                         |
| Roll out across all 28 States and 8 UTs; mandate 256-bit QR stickers on all commercial instruments.   |
+-------------------------------------------------------------------------------------------------------+
| Phase 4: Advanced Predictive AI & IoT Integration (Month 13+)                                         |
| Enable live IoT load-cell telemetry integration and AI anomaly detection for automated market raids.  |
+-------------------------------------------------------------------------------------------------------+
```

---

*Prepared by the Legal Metrology Digital Architecture Team for the Ministry of Consumer Affairs, Food & Public Distribution, Government of India.* 🇮🇳
