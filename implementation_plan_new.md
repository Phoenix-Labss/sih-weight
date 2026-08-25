# Unified Weights and Measures Verification & Digital Certification Platform

## Production-Grade Implementation Plan

**Document status:** Planning baseline  
**Prepared on:** 23 August 2026  
**Scope:** Planning only; no application implementation  
**Primary source:** [Department of Consumer Affairs — The Legal Metrology Act](https://consumeraffairs.gov.in/pages/legal-metrology-act)

> System supports verification authorities. It does not replace statutory authority, physical verification, lawful stamping, or officer judgment. Digital certificate and QR code must supplement—not silently redefine—legal process.

---

## 1. Executive Summary

Build unified national/state-ready platform for registration, instrument lifecycle management, verification and re-verification applications, fee handling, scheduling, field/laboratory test execution, physical stamp/seal recording, digitally signed certificates, expiry reminders, public QR verification, dashboards, and audit.

Core design:

- **Modular transactional control plane** for stakeholders, instruments, applications, tests, certificates, payments, authorization, and audit.
- **Durable asynchronous workers** for documents, notifications, certificate rendering/signing, search indexing, integrations, and analytics.
- **Versioned jurisdiction and procedure packs** for instrument specifications, test steps, tolerances, validity periods, fees, forms, and authority scope.
- **Android-first offline field app** for LMOs/GATC personnel plus responsive stakeholder web portal.
- **Evidence-first certificate chain** linking application, instrument, observations, reference standards, authorized verifier, stamp/seal, signature, and certificate hash.

Expected result: business submits application online; system validates jurisdiction and instrument data; eligible LMO/GATC receives scheduled work; verifier follows approved procedure; observations and evidence are recorded; deterministic calculations flag pass/fail conditions; authorized officer decides outcome; immutable signed certificate becomes publicly verifiable; system tracks next due date and sends reminders.

---

## 2. Legal and Governance Foundation

### 2.1 Authoritative legal corpus

Legal team must consolidate and approve:

- Legal Metrology Act, 2009, corrigenda, commencement notifications, and applicable amendments.
- Legal Metrology (General) Rules, 2011, corrigendum, and all amendments.
- Legal Metrology (Government Approved Test Centre) Rules, 2013 and amendments.
- Legal Metrology (Approval of Models) Rules, 2011 where model approval applies.
- Legal Metrology (National Standards) Rules, 2011 and applicable amendments.
- Applicable State/UT Legal Metrology Enforcement Rules, fee schedules, forms, delegations, and workflows.
- Applicable notifications, circulars, advisories, recognized test procedures, and administrative orders.
- Jan Vishwas amendments and commencement/implementation notifications where relevant.

Official index reviewed on 23 August 2026 lists multiple General Rules amendments in 2025 and four entries in 2026, plus GATC amendments through 2026. Original 2011/2013 texts alone are unsafe implementation sources.

Supplied URL is legal-document index, not software training/test dataset. Project needs separate synthetic/de-identified workflow fixtures and approved instrument/test datasets.

### 2.2 Legal source lifecycle

For every source:

1. Retain official file and checksum.
2. Record title, gazette/notification number, jurisdiction, publication date, commencement/effective date, source URL, and superseded provisions.
3. Extract searchable text while preserving page/paragraph references.
4. Obtain Legal Metrology subject-matter review.
5. Convert approved requirements into versioned policy/procedure packs.
6. Add positive, negative, scope, authorization, expiry, and date-boundary golden tests.
7. Require legal and technical approval before activation.
8. Publish immutable version with release note and rollback plan.
9. Pin every application, verification session, fee quote, and certificate to versions used.

Track both legal-validity time and system-publication time.

### 2.3 Jurisdiction and procedure packs

Do not hardcode statutory periods, fees, forms, tolerances, or authority scope in UI/business code. Packs contain:

- Stable rule/procedure ID.
- Official citation and source checksum.
- Jurisdiction and effective period.
- Instrument category, subtype, accuracy class, capacity/range, and usage scope.
- Initial verification/re-verification/repair-related applicability.
- Authorized LMO/GATC scope and required competencies.
- Required reference standards and valid calibration conditions.
- Test steps, test points, formulas, units, tolerances, uncertainty rules, and environmental conditions.
- Required observations, photos, documents, stamps, and seals.
- Validity-period calculation.
- Fee policy and form/template version.
- Missing/invalid evidence behavior.
- Golden tests and approvals.

### 2.4 Authority and safe outcomes

System may compute and validate; authorized official/test-centre role records legal outcome. Use explicit states:

- `Verification passed — pending authorization`
- `Verification failed`
- `Needs review`
- `Incomplete verification`
- `Outside authorization scope`
- `Certificate issued`
- `Certificate expired`
- `Certificate suspended`
- `Certificate revoked`
- `Certificate superseded`

Digital certificate does not silently replace required physical stamp, seal, or mark. Record physical action and legal basis separately.

---

## 3. Product Scope

### 3.1 In scope

- Stakeholder registration, verification, profile, facilities, and authorization.
- Owner/user, manufacturer, dealer, repairer, LMO, GATC, controller, administrator, auditor, and public-verifier experiences.
- Instrument type/model/unit registry and ownership/location history.
- Verification/re-verification and approved related application types.
- Document/evidence upload and scrutiny/query workflow.
- Versioned fee quote, online/offline payment reference, receipt, reconciliation, and refund workflow where authorized.
- Scheduling, allocation, reassignment, route/slot management, and service-level monitoring.
- On-site, departmental office/laboratory, and GATC verification modes.
- Versioned digital test procedures and observation forms.
- Reference-standard, calibration, test-equipment, stamp, and seal traceability.
- Pass/fail calculations with officer disposition.
- Digitally signed PDF/A certificates with QR verification.
- Rejection/deficiency memo and rework/reapplication path.
- Expiry/due-date tracking and reminders.
- Search, repository, dashboards, exports, audit, and controlled public verification.
- Android field application with encrypted offline operation.
- APIs for approved identity, payment, signature, messaging, registry, and state systems.
- Legacy record migration with provenance and confidence.

### 3.2 Out of scope for first release

- Autonomous approval, rejection, penalty, prosecution, seizure, or enforcement action.
- Replacing legally required physical examination, stamp, seal, or reference standard.
- Treating uploaded manufacturer specifications as verified facts.
- Auto-issuing certificate from device/IoT readings without authorized procedure and officer approval.
- Unapproved inter-state sharing or public exposure of business/personal data.
- Scraping external registries or using external AI without legal/security approval.
- Laboratory accreditation, model approval, licensing, or enforcement case management unless separately approved.

### 3.3 Relationship to packaged-commodity platform

This is separate bounded context. If both systems share one enterprise platform, share only approved foundation services—identity, tenant, legal-source registry, evidence, notifications, audit, search infrastructure, and observability. Keep instrument verification, test observations, and certificates separate from packaged-commodity inspections and findings.

---

## 4. Users and Authorization

### 4.1 Roles

- **Instrument Owner/User:** Register instruments, apply, pay, schedule, track, download certificate, receive reminders.
- **Authorized Representative:** Act for organization under verified delegation.
- **Repairer/Manufacturer/Dealer:** Submit permitted records/applications and link instruments under approved scope.
- **Legal Metrology Officer:** Scrutinize, schedule, verify, record observations, stamp, decide, and sign within posting/authority.
- **GATC Operator/Verifier:** Process only authorized instrument categories, ranges, locations, personnel, and approval period.
- **Controller/Supervisor:** Allocate work, approve exceptions, monitor pendency, manage jurisdiction policy, and audit outcomes.
- **Finance/Reconciliation Officer:** Manage fee configuration, receipts, settlements, refunds, and reconciliation.
- **Rule/Procedure Administrator:** Draft packs; cannot self-approve production activation.
- **System Administrator:** Operate platform without default access to verification content.
- **Auditor:** Read immutable records, evidence, signatures, and policy versions.
- **Public Verifier:** Verify limited certificate authenticity/status by QR or reference.

### 4.2 Access model

Use RBAC plus attributes:

- State/UT, district, office, GATC, facility, instrument category/range, assignment, application, and record sensitivity.
- GATC approval scope and validity.
- LMO posting, delegation, competency, and jurisdiction.
- Four-eyes approval for procedure publication, certificate revocation, authorization changes, and high-risk corrections.
- MFA and step-up authentication for certificate signing, revocation, bulk export, and privilege changes.
- Public endpoint returns minimum safe certificate data only.

---

## 5. End-to-End Workflow

### 5.1 Registration and onboarding

1. Stakeholder creates account through approved identity flow.
2. Organization, facility, addresses, contacts, and representative authority are validated.
3. Supporting documents receive malware/type/size checks and immutable hashes.
4. Official reviews high-trust roles and organization claims.
5. Role, jurisdiction, facility, and authorization scope become effective-dated records.
6. Duplicate entity checks suggest matches; authorized reviewer decides merge.

Do not assume GSTIN, PAN, CIN, or another identifier is mandatory for every stakeholder. Configure requirements through jurisdiction policy.

### 5.2 Instrument registration

Capture:

- Instrument category/subtype and intended use.
- Manufacturer, make, model, model-approval reference where applicable.
- Serial number and other physical identifiers.
- Accuracy class, capacity/range, least count/division, units, configuration, and components.
- Installation/use location and owner/custodian.
- Manufacture/installation dates where relevant.
- Previous certificate, stamp/seal, repair, transfer, and re-verification history.
- Photographs and specification documents.

Serial number may not be globally unique. Match using manufacturer, model, serial, physical features, location, ownership, and history. Preserve merge/split decisions.

### 5.3 Application and scrutiny

1. User selects verified instrument or creates new draft.
2. System determines candidate jurisdiction, application type, procedure, required documents, and fee policy.
3. User selects service location/mode and submits declaration.
4. Idempotent submission creates immutable application version.
5. Scrutiny validates completeness, instrument identity, authority, previous history, model/scope prerequisites, and fee.
6. Officer accepts, raises structured query, returns for correction, transfers lawfully, or rejects with reason and review path.
7. Corrections create new versions; submitted history remains visible.

### 5.4 Fees and payment

- Generate versioned fee assessment with legal/policy source and itemization.
- Support approved state gateway, treasury/challan, POS, or offline receipt reconciliation.
- Use idempotency keys and signed gateway callbacks.
- Keep payment state separate from application state.
- Never mark paid from browser redirect alone.
- Handle under/overpayment, failed settlement, refund, waiver, and exemption through authorized workflow.
- Preserve gateway references without storing prohibited card/payment secrets.

### 5.5 Scheduling and allocation

Eligibility considers:

- Jurisdiction and application type.
- Instrument class/range and procedure competency.
- LMO posting/delegation or GATC approval scope and validity.
- Required reference standards/equipment and calibration validity.
- Site/lab capacity, geography, travel, availability, accessibility, and SLA.
- Conflict-of-interest and workload policy.

Automation may recommend assignment; authorized role confirms. Every reassignment records reason. Notify applicant of slot, prerequisites, fees, reschedule, and cancellation.

### 5.6 Verification execution

1. Verifier authenticates on managed device and opens assigned job.
2. System pins procedure pack effective for verification context.
3. Verifier confirms instrument identity, location, physical condition, seals, and application data.
4. System checks reference standard, test equipment, calibration, GATC/LMO authority, and procedure eligibility at test time.
5. Guided steps capture raw readings, reference values, repetitions, environmental conditions, photos, notes, and anomalies.
6. Deterministic engine calculates error/tolerance using exact decimal/unit arithmetic.
7. Missing step, expired standard, out-of-scope range, or invalid calibration blocks normal completion.
8. Verifier records disposition, physical stamp/seal/mark details, and reason.
9. Supervisor review occurs where policy requires.
10. Session becomes immutable; correction creates signed amendment/superseding session.

### 5.7 Certificate issuance

Certificate requires:

- Completed authorized verification session.
- Eligible instrument and procedure.
- Passing observations or legally approved disposition.
- Valid authority at verification and signing time.
- Recorded physical stamp/seal action where required.
- Fee state accepted under policy.
- Complete evidence and audit chain.

Generate deterministic certificate content, PDF/A where required, certificate hash, high-entropy public reference, QR, signature metadata, issue date, validity/due date, and policy versions. Digital signature uses approved CCA/government solution and key custody.

Corrections never overwrite issued bytes. Revoke, suspend, expire, or supersede through explicit workflow while preserving original signature and public status history.

### 5.8 Expiry and re-verification

- Calculate due date from approved jurisdiction/procedure pack, not UI constant.
- Recalculate only through traceable legal/policy migration.
- Generate reminders through durable scheduled workflow.
- Let organization configure channels/preferences within mandatory-notice policy.
- Notification delivery is recorded but is not treated as legal service unless policy says so.
- One-click renewal creates linked draft; does not copy unverifiable facts blindly.
- Dashboard distinguishes due soon, overdue, suspended, revoked, out of service, and unknown legacy status.

## 6. Test Procedure and Measurement Engine

### 6.1 Procedure template

Every instrument procedure version defines:

- Eligibility and legal source.
- Instrument metadata needed.
- Required competency and authorization.
- Reference standards, equipment, ranges, calibration status, and traceability.
- Pre-test checks and environmental constraints.
- Ordered test steps and repetitions.
- Observation type, unit, precision, allowed range, and required evidence.
- Formula, rounding rule, maximum permissible error/tolerance, and uncertainty treatment.
- Pass/fail/indeterminate behavior.
- Mandatory physical stamp/seal actions.
- Certificate fields, validity logic, and reviewer guidance.
- Golden examples approved by domain experts.

Procedure engine must be deterministic, reproducible, and usable offline from signed cached packs. Device must reject expired/untrusted pack and reconcile exact version on sync.

### 6.2 Measurement integrity

- Use decimal/rational arithmetic, never binary floating point for legal calculations.
- Preserve raw observation, normalized value, unit, correction, uncertainty, repetition, and operator entry order.
- Use versioned SI/unit vocabulary and dimensional validation.
- Capture instrument resolution/division and reference standard accuracy.
- Do not silently round before final prescribed step.
- Record formula and intermediate values in machine-readable evaluation trace.
- Treat manual override as reviewer disposition with reason; never alter original reading/calculation.

### 6.3 Reference standards and laboratory assets

Maintain:

- Asset identity, category, range, class, owner/custodian, and location.
- Calibration certificate, laboratory/source, traceability, dates, uncertainty, and file hash.
- Maintenance, repair, movement, seal, damage, and out-of-tolerance history.
- Availability and booking.
- Procedure compatibility.

Expired, unsuitable, out-of-range, quarantined, or out-of-tolerance standard blocks verification. If later calibration reveals out-of-tolerance condition, system must identify potentially affected certificates for controlled impact review; never revoke automatically.

### 6.4 Stamp and seal inventory

Track serialized stamp/seal/QR-label inventory where used:

- Issue, custody, assignment, use, return, loss, damage, cancellation, and reconciliation.
- Instrument/certificate association.
- Officer/test-centre association and authority period.
- Photo/evidence where required.

Platform QR is not statutory physical stamp unless approved law explicitly makes it so.

---

## 7. Certificate, QR, and Public Trust

### 7.1 Certificate contents

Exact form follows approved jurisdiction template. Platform data model should support:

- Issuing authority/GATC and authorization reference.
- Certificate number and version.
- Instrument owner/user, location, category, make/model/serial, class, range/capacity, and unit.
- Verification type, place, date, result, and validity/due date.
- Procedure/rule version.
- Reference standards and calibration references at approved disclosure level.
- Stamp/seal/mark reference.
- Authorized verifier and signer.
- Signature, timestamp, document hash, QR, and verification URL.
- Limitations, supersession, or status notice.

### 7.2 QR design

QR should encode opaque high-entropy verification URL/reference, optionally with signed offline-verifiable payload approved by security. Do not place personal address, phone, payment data, or sensitive observations directly in QR.

Public page displays minimum necessary:

- Certificate number and current status.
- Issuing authority.
- Instrument identity summary.
- Verification/validity dates.
- Downloadable signed certificate only if disclosure policy permits.
- Hash/signature verification result.
- Revoked/suspended/superseded warning and replacement reference when public.

Protect endpoint with TLS, rate limits, bot/abuse controls, enumeration-resistant IDs, caching of non-sensitive status, and high availability. QR copy/cloning remains possible; public page must compare instrument identifiers and current status, not show green check alone.

### 7.3 Signing and key custody

- Use approved digital-signature/eSign/DSC service and certificate policy.
- Keep private keys in HSM/approved key service; never application configuration.
- Separate document rendering from authorization/signing.
- Bind signature to exact immutable bytes.
- Timestamp and record signer authority at signing time.
- Verify signatures periodically and during download.
- Define key rotation, compromise, revocation, archival validation, and provider outage procedures.

---

## 8. User Experience

### 8.1 Stakeholder portal

- Guided registration and application wizard.
- Saved drafts and document checklist.
- Instrument registry with due-date timeline.
- Fee assessment, payment status, receipt, appointment, queries, and actions.
- Certificate download and authenticity check.
- Organization users/delegations.
- Notification preferences and contact verification.
- Accessible multilingual interface and status explanations.

### 8.2 LMO/GATC workspace

- Jurisdiction/scope-aware work queue.
- Scrutiny checklist and structured deficiency queries.
- Calendar, map, route, lab slot, and equipment availability.
- Instrument history and duplicate warnings.
- Guided procedure with required-step enforcement.
- Raw observation grid, automatic calculations, anomaly alerts, and evidence capture.
- Stamp/seal allocation and reconciliation.
- Review, sign, reject, return, suspend, revoke, and supersede workflows subject to role.

### 8.3 Field mobile app

- Android-first; weak-network and one-handed operation.
- Encrypted offline assignments and procedure packs.
- Device-bound authentication and expiring offline authorization.
- Camera capture with timestamp/location accuracy and document scan.
- Barcode/QR/NFC/serial entry where available; manual fallback.
- Offline observation forms with unit/range validation.
- External Bluetooth/device integration only after approved protocol and calibration controls.
- Visible sync queue, retry, conflict resolution, remote revocation, and no silent data loss.

### 8.4 Dashboards

**Owner/business:** instrument status, applications, fees, appointments, due/overdue, certificates.  
**LMO:** assignments, today's route, scrutiny queue, pending signatures, due inspections.  
**GATC:** authorization coverage, capacity, personnel, standards, calibration expiry, turnaround.  
**Supervisor:** pendency, SLA aging, pass/fail trends, district/office workload, reassignments, overdue instruments.  
**Administrator:** registrations, rule/procedure versions, integrations, notification delivery, security/operations.  
**Auditor:** certificate issuance/revocation, scope violations, observation corrections, stamp/seal gaps, out-of-tolerance impact.

Dashboards must distinguish operational trends from enforcement conclusions and enforce tenant/geography access.

---

## 9. Reference Architecture

### 9.1 Architecture style

Use modular monolith for transactional control plane, with independently scalable workers. Avoid premature microservices.

Control-plane modules:

- Identity, tenant, organization, delegation, and authorization.
- Stakeholder/facility registry.
- Instrument/model/ownership registry.
- Application, scrutiny, query, and workflow.
- Fee, payment, receipt, and reconciliation.
- Scheduling, allocation, competency, and resource booking.
- Procedure packs, standards, test sessions, observations, and evaluations.
- Stamp/seal inventory.
- Certificate lifecycle, signature, QR, and public status.
- Evidence/document custody.
- Notification and reminder policy.
- Search, dashboard projection, audit, and integrations.

Workers:

- File safety/derivative generation.
- Certificate/report rendering.
- Signature-provider orchestration.
- Reminder and message delivery.
- Search indexing and dashboard aggregation.
- Legacy import and reconciliation.
- External integration synchronization.

### 9.2 Platform components

- Responsive TypeScript web portal.
- Android-first secure field app.
- Python application/API stack unless ADR selects equivalent.
- PostgreSQL-compatible authoritative database.
- S3-compatible versioned object storage with retention controls.
- OpenSearch-compatible search projection.
- Durable workflow/queue for long-running, scheduled, and retryable work.
- Cache for disposable acceleration/rate limits.
- OCI containers on Kubernetes/OpenShift-compatible runtime.
- OpenTelemetry-compatible logs, metrics, and traces.
- Approved identity, payment, messaging, signature, and key-management integrations.

Prefer government-cloud/on-prem portable interfaces. No core workflow should depend irreversibly on one cloud.

### 9.3 Multi-tenancy and federation

Support national platform with State/UT tenant boundaries:

- Tenant and jurisdiction keys on every owned record.
- Application authorization plus database row-level controls.
- Separate object namespaces/encryption context, search aliases, cache keys, and audit views.
- Central public certificate index exposing minimum data.
- Configurable central analytics using approved de-identified/aggregated events.
- Dedicated deployment/database for policy-sensitive tenants when required.
- Cross-tenant negative tests on every access path.

### 9.4 Durable workflow rules

- At-least-once delivery; all consumers idempotent.
- Bounded retries, timeout, dead-letter/quarantine, cancellation, and operator replay.
- Correlation/causation IDs and schema-versioned events.
- Transactional outbox or equivalent for state/event consistency.
- Long timers for appointment/reminder/expiry in durable scheduler, not application memory.
- Duplicate payment callback, upload, notification, and signature request must not duplicate state.

---

## 10. Core Data Model

Main records:

- Tenant, jurisdiction, office, organization, facility, user, role, delegation.
- LMO posting/competency and GATC approval/scope/personnel.
- Instrument type, model, approval reference, instrument unit, component, ownership/location history.
- Application/version, document, query/response, declaration, workflow transition.
- Fee policy, assessment, payment attempt, settlement, receipt, refund/waiver.
- Appointment, assignment, route, resource booking.
- Legal source, policy pack, procedure pack, test step, tolerance rule.
- Reference standard, calibration, maintenance, custody, impact review.
- Verification session, observation, environmental reading, evidence, evaluation, disposition.
- Stamp/seal inventory and use event.
- Certificate, signature, status event, public verification event.
- Notification schedule/attempt/preference.
- Audit event, integration event, import batch, legacy provenance.

Critical invariants:

- Certificate cannot be issued without completed eligible verification and authorized signer.
- Instrument, serial, owner, certificate, and test data are versioned; issued history is not overwritten.
- GATC/LMO scope is valid at assignment, test, disposition, and signing checkpoints.
- Reference standards are suitable and valid at test time.
- Due date is derived from pinned policy, not manually edited without authorized correction.
- Public identifiers are non-sequential and enumeration-resistant.
- Search/cache/analytics are rebuildable and not authoritative.
- Timestamps use UTC plus preserved local timezone/source time.
- Monetary and measurement values use exact decimal representations.

## 11. API and Integration Plan

### 11.1 API principles

- Version contracts and validate at trust boundary.
- Server derives tenant, role, authority, fee, result, and certificate eligibility.
- Idempotency for submission, upload, payment initiation/callback, scheduling, observation sync, and signing.
- Structured error codes plus safe human messages.
- Pagination, export caps, rate limits, and tenant quotas.
- Short-lived direct object upload authorization followed by server verification.
- Authorized expiring evidence access; no permanent raw object URLs.
- Immutable audit for privileged reads and writes.

### 11.2 Candidate integrations

Subject to owner approval and ADR:

- Government/state SSO or approved OIDC/SAML identity.
- State treasury/payment gateway and reconciliation feed.
- Approved CCA-compatible digital-signature/eSign/time-stamp provider.
- SMS, email, push, and approved messaging gateways.
- DigiLocker or equivalent certificate delivery if legally/technically approved.
- Existing state Legal Metrology portals and registries.
- Model approval, licensing, or GATC registries.
- GIS/address services approved for data residency and licensing.
- ERP/finance and government analytics systems.

Use adapters, timeout, circuit breaker, signed callbacks, replay protection, reconciliation jobs, and manual fallback. External system failure must not corrupt authoritative state.

---

## 12. Security, Privacy, and Fraud Controls

### 12.1 Core controls

- Least privilege, deny by default, MFA, step-up authentication, short privileged sessions.
- RBAC plus jurisdiction, office, GATC, facility, assignment, and instrument-scope attributes.
- Encryption in transit and at rest; approved key/secrets management.
- Managed-device policy for field users where feasible.
- File signature/type validation, malware scan, decompression/pixel limits, and quotas.
- Rate limiting, bot protection, safe exports, and abuse monitoring.
- Sensitive-data redaction in logs/metrics/traces.
- Append-only business/security audit with tamper detection.
- Production egress deny except approved integrations.
- SBOM, signed artifacts, dependency/license/secret/source/IaC/container scans.
- VAPT, mobile/API testing, accessibility audit, and independent security review before production.

### 12.2 Main fraud/threat scenarios

Threat model must cover:

- Forged or altered certificate.
- QR cloning and certificate-number enumeration.
- Backdated test or certificate.
- Unauthorized GATC category/range/personnel.
- Expired reference standard used in test.
- Observation changed after result.
- Stamp/seal inventory theft or replay.
- Duplicate instrument identity or serial substitution.
- Insider self-approval or unauthorized revocation.
- Payment callback spoofing.
- Offline device clock/location manipulation.
- Cross-tenant record access.
- Bulk harvesting from public verification.
- Malicious document upload and resource exhaustion.

Mitigate with immutable timestamps, authority snapshots, cryptographic hashes/signatures, independent server time, explicit correction history, inventory reconciliation, high-entropy IDs, anomaly alerts, separation of duties, and sampled audits. GPS is supporting evidence, not sole proof.

### 12.3 Privacy and public disclosure

Perform current Indian legal/policy review, including applicable DPDP, CERT-In, departmental retention, archival, and state requirements. Define data owner, purpose, retention, legal hold, correction, sharing, and deletion.

Public page must not expose personal phone/email/address, payment, raw observations, uploaded documents, officer private data, device details, or audit history unless law/policy explicitly requires it. Log and cap bulk access.

---

## 13. Evidence, Records, and Migration

### 13.1 Evidence integrity

- Preserve original upload/capture bytes and hash at ingestion.
- Store derivatives separately with transformation lineage.
- Record actor, device, source, time, location accuracy, and custody events.
- Verify hashes on retrieval, report inclusion, export, backup restore, and integrity scan.
- Keep signed certificates immutable; correction creates superseding version.
- Apply retention lock/legal hold according to policy.
- Audit evidence access as well as mutation.

### 13.2 Legacy migration

1. Inventory state/GATC paper registers, spreadsheets, local databases, certificate formats, and data quality.
2. Define canonical mapping and jurisdiction ownership.
3. Scan/import in resumable, signed batches with source manifest and checksums.
4. Deduplicate organizations/instruments using deterministic and reviewed matching.
5. Label confidence: `Verified legacy`, `Digitized from source`, `Unverified legacy`, or `Conflicted`.
6. Link scanned certificate/register page when permitted.
7. Reconcile counts, totals, sample records, and due dates with source office.
8. Obtain custodian sign-off and keep rollback/re-import plan.

Do not present imported unsigned record as natively authenticated digital certificate. Preserve source limitations prominently.

---

## 14. Reliability, Scale, and Operations

### 14.1 Planning workload tiers

Validate through discovery; these are architecture targets, not demand claims.

| Tier | Daily applications | Registered instruments | Use |
|---|---:|---:|---|
| Pilot | 500–2,000 | 50,000–200,000 | Selected districts/types |
| State | 10,000–30,000 | 1–5 million | State-wide operations |
| Multi-state/national | 100,000+ | Tens of millions | Federated rollout |

Reminder bursts, public QR scans, payment callbacks, and certificate downloads may exceed application rate. Size independently.

### 14.2 Scaling strategy

- Stateless APIs and horizontal scaling.
- Direct object-storage upload.
- Separate worker pools for certificates, notifications, imports, indexing, and integrations.
- Queue backpressure, tenant fairness, quotas, and poison-job quarantine.
- Database partition/read replicas based on measured query/load.
- Search and dashboard projections from authoritative events.
- CDN/cache only for safe public certificate status/artifacts.
- Archival tiers governed by retention; never delete legal records to reduce cost.
- Load/cost model by application, certificate, notification, and public verification.

### 14.3 Initial SLO proposals

Confirm with stakeholders:

- Authenticated portal/API availability: 99.9% monthly.
- Public certificate verification: 99.95% monthly.
- Common metadata request p95: under 500 ms.
- Scoped search p95: under 2 seconds.
- Field sync acknowledgement: under 5 seconds after connection under normal load.
- Certificate rendering/signing p95: under 60 seconds excluding provider outage.
- Dashboard freshness: under 15 minutes.
- Reminder generation: within 30 minutes of scheduled window.
- Transactional RPO: 15 minutes or better.
- Core-service RTO: 4 hours or better.

### 14.4 Resilience and observability

- Multi-zone production, point-in-time database recovery, object versioning/replication, durable queues.
- Quarterly restore drill and annual DR exercise.
- Structured logs, metrics, traces, correlation IDs, health/readiness, alerting, and runbooks.
- Monitor latency/error/saturation, queue age, sync failures, payment mismatch, pending signatures, reminder delivery, certificate verification errors, GATC scope blocks, expired standards, correction/revocation rate, hash mismatch, and cross-tenant denials.
- Graceful degradation: field capture can continue offline; optional analytics outage cannot block verification; signature outage queues approved issuance safely.

---

## 15. Testing and Quality Gates

### 15.1 Required test suites

- Domain/state-machine tests.
- Procedure golden tests for each instrument type/range/class and effective date.
- Exact decimal/unit/formula/rounding tests.
- LMO/GATC authorization-scope and expiry tests.
- Reference-standard calibration/range/out-of-tolerance tests.
- Application, query, scheduling, payment, and certificate integration tests.
- Duplicate callback/upload/sync/job idempotency tests.
- Offline process-death, clock skew, revoked user, partial sync, conflict, and app-upgrade tests.
- Signature/hash/QR/revocation/supersession tests.
- Cross-tenant and unauthorized-access negative tests.
- Malicious file, rate-limit, export, and public enumeration tests.
- Accessibility, localization, report visual, browser/device tests.
- Migration reconciliation and rollback tests.
- Load, soak, spike, failover, backup restore, and DR tests.

### 15.2 Critical scenarios

- Amendment effective between application and test date.
- Fee/policy changes after draft but before submission.
- GATC approval expires before scheduled test.
- Reference standard calibration expires during offline assignment.
- Instrument exceeds GATC authorized range.
- Same serial registered by two owners.
- Failed instrument submitted after repair.
- Observation corrected after verifier submission.
- Payment succeeds but callback repeats or is delayed.
- Signature provider times out after signing.
- QR scanned after certificate supersession/revocation.
- Officer transferred between test and signature.
- Lost seal inventory used in certificate attempt.
- Legacy record claims validity without source proof.

### 15.3 Release gates

- 100% approved legal/procedure golden tests pass.
- No unresolved critical/high tenant, certificate, payment, or evidence security issue.
- Cross-tenant tests pass.
- Signature and public verification independently validate.
- Backup restore meets RPO/RTO.
- Pilot procedure calculations match expert manual results on approved sample.
- Accessibility and field/offline acceptance pass for supported workflows.
- Legal, operational, security, and product owners approve limitations.

---

## 16. Delivery Roadmap

### Phase 0 — Legal/state discovery: Weeks 1–4

- Select pilot State/UT, offices, GATCs, instrument families, languages, and payment/signature systems.
- Consolidate law, state rules, forms, fees, validity periods, authority delegations, and procedures.
- Observe current LMO/GATC workflow and legacy records.
- Approve data classification, threat model, success metrics, and architecture decisions.
- Build procedure golden examples; no production code before legal workflow baseline.

### Phase 1 — Foundation and prototype: Weeks 3–8

- Inspector/business UX prototype.
- Tenant, identity, organization, instrument, application, state-machine, audit, and evidence design.
- Procedure-pack, measurement, standard, certificate, and QR contracts.
- Deployment, offline sync, migration, observability, and security design.
- Test with pilot users and refine.

### Phase 2 — Operational MVP: Weeks 7–16

- Registration/profile, instrument registry, application/scrutiny/query.
- Fee assessment/payment integration.
- Scheduling/allocation.
- Initial approved instrument procedures.
- Online field/lab observations and deterministic calculations.
- Stamp/seal record.
- Signed QR certificate, repository, search, reminders, basic dashboards.
- RBAC/ABAC, audit, evidence, backup, and monitoring.

### Phase 3 — Field/offline pilot: Weeks 14–22

- Android offline assignment, procedure, evidence, and sync.
- Reference-standard/calibration and GATC authorization management.
- Legacy import pilot.
- Advanced scheduling, reconciliation, notification delivery, and supervisor dashboards.
- Parallel run against existing manual process.

### Phase 4 — Production hardening: Weeks 20–28

- Multi-zone scale, performance, DR, VAPT, privacy, accessibility, SBOM/signing.
- Certificate key/provider failover and public verification hardening.
- Support playbooks, SLOs, alerts, training, and amendment release drill.
- Resolve pilot gaps and obtain go-live approvals.

### Phase 5 — Controlled rollout: Weeks 28–36

- Roll out by office/instrument family.
- Daily quality and pendency review.
- Migrate approved legacy batches.
- Train-the-trainer and support.
- Measure time, errors, adoption, cost, and certificate trust.

### Phase 6 — Multi-state/national growth

- Add jurisdiction packs, languages, instrument families, GATCs, integrations, and federated analytics.
- Split services only from measured scale/security/ownership need.

## 17. Prioritized Backlog

### P0 — Credible pilot

- Approved legal/jurisdiction/procedure packs and golden tests.
- Stakeholder onboarding and scoped authorization.
- Instrument registry and history.
- Application, scrutiny, query, fee, payment, and appointment workflow.
- LMO/GATC assignment eligibility.
- Guided verification, exact calculations, evidence, and disposition.
- Reference-standard validity and stamp/seal recording.
- Signed QR certificate and public verification.
- Due dates, reminders, repository, search, dashboards, audit, backup, monitoring.

### P1 — Field-ready production

- Encrypted offline mobile workflow and resilient sync.
- Legacy migration tooling and reconciliation.
- GATC approval/personnel/facility lifecycle.
- Advanced scheduling/routes/resource booking.
- Multi-channel notifications and finance reconciliation.
- Multi-language/accessibility completion.
- Multi-zone DR, VAPT, performance, and operational hardening.

### P2 — Scale and extension

- Additional states/instrument families.
- Approved device/IoT reading integration.
- NFC/secure physical tag support.
- DigiLocker/registry interoperability.
- Advanced anomaly/risk analytics with human oversight.
- Public APIs and federated national aggregates under governance.

---

## 18. Team and Governance

Core team:

- Product/domain lead.
- Central and State Legal Metrology SMEs.
- LMO and GATC pilot champions.
- Legal/policy counsel.
- Solution architect and backend/web/mobile engineers.
- Measurement/procedure engineer.
- QA/SDET and test-data lead.
- Platform/SRE/DevSecOps engineers.
- Security/privacy lead.
- UX/accessibility/localization specialists.
- Data migration/reconciliation lead.
- Technical writer/training/support lead.

Governance:

- **Legal/Procedure Board:** sources, jurisdiction packs, test procedures, validity, fees, forms.
- **Certificate Trust Board:** certificate form, signatures, keys, QR/public disclosure, revocation.
- **Security/Privacy Board:** threat model, tenancy, processors, retention, incidents.
- **Operations Board:** rollout, SLOs, pendency, support, capacity, continuity.

No author may self-approve legal pack, production procedure, or signing authorization.

---

## 19. Success Metrics

### Service

- Application completion and rejection-for-incompleteness rate.
- Submission-to-scrutiny, scrutiny-to-slot, test-to-certificate, and total turnaround.
- Appointment no-show/reschedule rate.
- Pendency by age, office, type, and cause.
- First-time digital completion and support rate.

### Quality and trust

- Procedure calculation agreement with expert ground truth.
- Observation correction and certificate supersession/revocation rate.
- Certificates with complete authority, standard, evidence, stamp, and policy trace: target 100%.
- Invalid-scope test/certificate prevented.
- Public signature/hash validation success.
- Legacy reconciliation accuracy and unresolved conflict count.

### Reliability/security

- SLO attainment, sync success, payment reconciliation, notification delivery.
- Evidence/certificate hash mismatch: target zero.
- Unauthorized cross-tenant access: target zero.
- Restore drills meeting RPO/RTO.
- Cost per application/certificate/public verification.

### Adoption

- Active stakeholders, LMOs, GATCs, and offices.
- Instruments with current trusted status.
- Reminder-to-reapplication conversion.
- User satisfaction, accessibility defects, and training completion.

---

## 20. Major Risks

| Risk | Mitigation |
|---|---|
| Outdated central/state rule implementation | Official source registry, effective dates, legal approval, golden tests |
| One workflow forced across differing states | Jurisdiction packs and configurable forms/fees while keeping core invariants |
| Digital certificate mistaken for physical stamp replacement | Explicit separate records, legal wording, training, approved templates |
| GATC operates outside scope | Effective-dated category/range/personnel/facility checks at assignment/test/signing |
| Expired/unsuitable standard used | Hard eligibility checks, offline expiry protection, impact review |
| Forged certificate or cloned QR | Signed immutable bytes, hash, high-entropy reference, current-status public page |
| Offline data tampering/clock manipulation | Encrypted device, signed packs, server time, audit, conflict review, device policy |
| Payment/callback inconsistency | Idempotency, signed callbacks, reconciliation, separate payment/application states |
| Duplicate/incorrect instrument identity | Composite matching, photos/history, human merge, immutable provenance |
| Legacy data presented as trusted | Confidence labels, source scans, custodian sign-off, no retroactive authentication |
| Insider fraud or unauthorized correction | Separation of duties, immutable history, anomaly alerts, sampled audit |
| Reminder flood and messaging cost | Durable batching, preferences, throttling, delivery analytics, quotas |
| Public endpoint leaks data | Minimum disclosure, non-sequential IDs, rate limits, monitoring |
| Premature microservices increase failure/cost | Modular monolith, split only with measured need and ADR |
| State infrastructure/integration variance | Portable deployment, adapters, manual fallback, early pilot integration tests |

---

## 21. First 30 Days

### Week 1

- Appoint legal, state, GATC, product, engineering, security, and pilot owners.
- Select pilot instrument families, offices, GATCs, and languages.
- Inventory central/state sources, forms, fees, certificates, procedures, and systems.
- Observe real application, field/lab test, stamping, and certificate work.

### Week 2

- Produce legal/jurisdiction matrix and first procedure definitions.
- Map roles, authorization, GATC scope, standards, stamps, payments, and signatures.
- Draft data model, state machines, threat model, retention, and migration strategy.
- Prototype stakeholder and verifier journeys.

### Week 3

- Approve golden test cases with experts.
- Choose signing, payment, identity, messaging, and hosting integration constraints.
- Validate offline procedure and observation UX with LMOs/GATCs.
- Define pilot SLOs, volume, quality, and reconciliation gates.

### Week 4

- Approve architecture decisions, MVP backlog, ownership, delivery plan, and risk register.
- Freeze pilot legal/procedure scope.
- Begin implementation only after legal, product, security, and architecture gates pass.

---

## 22. ADRs Required Before Coding

1. Standalone system versus shared Legal Metrology platform boundaries.
2. Repository/stack and modular-monolith modules.
3. State/national tenancy and data-sharing model.
4. Deployment target and data residency.
5. Identity, stakeholder proofing, delegation, and high-trust roles.
6. Legal/jurisdiction/procedure pack representation and approvals.
7. Measurement arithmetic, units, rounding, uncertainty, and golden tests.
8. Instrument identity/deduplication and ownership transfer.
9. GATC/LMO authorization and competency model.
10. Evidence immutability and chain of custody.
11. Offline mobile security and synchronization conflicts.
12. Durable workflow, scheduled reminders, and idempotency.
13. Fee/payment/reconciliation architecture.
14. Reference-standard/calibration and impact-review model.
15. Stamp/seal inventory and physical/digital relationship.
16. Certificate rendering, signature, QR, public verification, and revocation.
17. Legacy migration trust levels and reconciliation.
18. Search/analytics/public disclosure boundaries.
19. SLO, RPO/RTO, backup, DR, and observability.
20. External integration and egress policy.

---

## 23. Production Readiness Checklist

### Legal/operational

- [ ] Pilot central/state corpus and procedure packs approved.
- [ ] Authority, GATC scope, fees, forms, validity, stamp/seal, and certificate policy approved.
- [ ] Golden tests pass and amendment rollback/drill completed.
- [ ] Manual fallback and business-continuity process documented.

### Trust/security

- [ ] Tenant isolation, MFA, signing keys, public endpoint, audit, and evidence controls tested.
- [ ] Threat/privacy assessments and VAPT complete.
- [ ] SBOM and signed release artifacts available.
- [ ] Certificate/hash/signature/revocation independently verified.

### Field/data

- [ ] Supported procedures match expert results.
- [ ] Offline sync/recovery and device revocation pass field tests.
- [ ] Standards/calibration/stamp inventory workflows reconcile.
- [ ] Legacy migration batch reconciles and trust labels display correctly.

### Reliability/usability

- [ ] Load, failover, restore, and DR meet targets.
- [ ] Alerts/runbooks/on-call/support tested.
- [ ] Accessibility and supported-language reviews pass.
- [ ] Users trained and pilot acceptance signed.

---

## 24. Definition of Done

First production release is done only when:

- Complete bounded workflow works from trusted registration through public certificate verification and re-verification reminder.
- Legal/procedure/fee/validity/authority versions are pinned and reproducible.
- Every issued certificate traces to eligible instrument, authorized verifier, valid standards, observations, evidence, physical stamp/seal record, signer, and immutable bytes.
- Corrections, suspension, revocation, expiry, and supersession preserve history.
- Cross-tenant, offline, payment, signing, migration, security, accessibility, load, backup, and DR tests pass.
- Pilot demonstrates lower turnaround/pendency without weakening statutory controls.
- Legal Metrology, security, operations, and product owners approve production scope and limitations.

---

## 25. Final Recommendation

Build certificate trust chain first, dashboard polish later:

1. Consolidate current central/state law and procedures.
2. Model authority, instrument identity, reference standards, and physical stamp/seal.
3. Make workflow and measurement calculations deterministic and versioned.
4. Preserve immutable evidence, observations, and certificate history.
5. Keep authorized human at test disposition and certificate boundary.
6. Prove offline field workflow and payment/signature reconciliation in one pilot.
7. Harden tenancy, public verification, security, DR, and operations.
8. Scale by adding jurisdiction/procedure packs, not duplicated state codebases.

This path creates useful pilot quickly while preserving legally defensible, fraud-resistant, multi-state production architecture.
