# agent_new.md

## Purpose

Domain-specific implementation contract for [`implementation_plan_new.md`](./implementation_plan_new.md): unified online verification, digital certification, and lifecycle management of weighing and measuring instruments.

This file guides agents only when user task explicitly targets new verification/certification platform. Root [`AGENTS.md`](./AGENTS.md) still applies. If root packaged-commodities mission conflicts with this platform, do not mix domains silently; ask user whether work belongs in shared foundation, separate bounded context, or separate repository.

Repository currently has planning plus other user work. Do not implement application unless user explicitly asks. Never bootstrap whole platform from broad request.

---

## 1. Authority Order

1. Current user request.
2. Root `AGENTS.md`.
3. This `agent_new.md` for instrument-verification tasks.
4. `implementation_plan_new.md`.
5. Approved ADRs.
6. Approved official legal sources, jurisdiction packs, and procedure packs.
7. Existing code conventions, contracts, migrations, and tests.

Stop and report conflict involving legal meaning, certificate trust, physical stamping, authority, measurement, payment, tenancy, privacy, or evidence. Never choose legal interpretation by convenience.

Primary source index:

- [Department of Consumer Affairs — The Legal Metrology Act](https://consumeraffairs.gov.in/pages/legal-metrology-act)

Original General Rules, 2011 are not complete current law. Official index includes later corrigenda/amendments and separate GATC, State/UT, model approval, standards, fee, and implementation materials.

---

## 2. Mandatory Task Start

Before editing:

1. Read root `AGENTS.md`, this file, and relevant plan sections.
2. Inspect current files and uncommitted/user changes.
3. Identify bounded context, phase, jurisdiction, instrument family, and acceptance criteria.
4. Locate related ADRs, contracts, migrations, procedures, legal golden tests, security docs, and runbooks.
5. Classify task impact: legal/procedure, certificate trust, evidence, authority, payment, tenancy, privacy, offline, migration, or model behavior.
6. Confirm source/pack/version if behavior depends on law, fees, validity, forms, tolerances, or authority.
7. State short approach before non-trivial changes.
8. Implement smallest complete vertical slice.

Do not guess missing jurisdiction rules. Safe default: block decision and return structured `Needs review`, `Incomplete verification`, or `Outside authorization scope` as appropriate.

---

## 3. Non-Negotiable Domain Safety

### 3.1 Authorized human decision

System may guide procedure, validate inputs, and calculate error/tolerance. Only authorized LMO/GATC role may record legal disposition and issue/sign certificate within scope.

Never implement autonomous:

- Statutory verification approval.
- Certificate issuance without authorized action.
- Penalty, prosecution, seizure, notice, or enforcement outcome.
- Certificate revocation based only on anomaly score.

### 3.2 Physical and digital actions remain distinct

Digital certificate/QR must not silently replace legally required physical test, stamp, seal, mark, or equipment use.

Data model and UI must record separately:

- Verification/test completion.
- Verifier disposition.
- Physical stamp/seal/mark action.
- Certificate authorization/signing.
- Public certificate status.

### 3.3 Law and procedures are versioned data

Never hardcode validity periods, fee amounts, form fields, tolerance limits, test points, formulas, rounding, GATC scope, or certificate language in scattered application/UI logic.

Use approved, immutable, effective-dated:

- Legal source records.
- Jurisdiction packs.
- Procedure packs.
- Fee policies.
- Certificate templates.
- Authorization/competency policies.

Each application, test session, calculation, due date, and certificate pins exact versions.

### 3.4 Measurement integrity

- Use decimal/rational arithmetic; never binary floating point for legal values.
- Preserve raw reading and normalized value separately.
- Preserve unit, precision, scale/division, correction, repetition, uncertainty, and entry order.
- Use versioned unit vocabulary and dimensional validation.
- Record formula, rounding rule, intermediate values, and final comparison.
- Never mutate original observation after submission.
- Correction creates new version with actor, reason, and before/after values.
- Reviewer disposition cannot rewrite deterministic calculation trace.

### 3.5 Reference-standard integrity

Verification must fail closed when required standard/equipment is:

- Expired.
- Quarantined.
- Out of calibration.
- Outside approved range/class.
- Missing traceability evidence.
- Incompatible with procedure.

If later calibration shows out-of-tolerance condition, create impact-review workflow for affected sessions/certificates. Do not auto-revoke.

### 3.6 Certificate integrity

Issued certificate bytes are immutable. Correction creates superseding certificate. Status changes append events.

Certificate requires:

- Eligible completed verification.
- Correct procedure/jurisdiction version.
- Valid LMO/GATC authority at required checkpoints.
- Valid reference standards at test time.
- Required observations/evidence.
- Physical stamp/seal record where applicable.
- Approved fee state.
- Authorized signer and valid signing credential.

QR uses opaque, high-entropy reference. Never encode sensitive personal/payment/audit data directly.

### 3.7 No false trust

- Imported legacy scan is not natively authenticated digital certificate.
- User-uploaded specification is not verified fact.
- GPS/device time is supporting evidence, not sole proof.
- Barcode/serial match is candidate identity, not guaranteed identity.
- AI/OCR suggestion is not legal observation until reviewed.
- Notification delivery is not legal service unless approved policy states so.

---

## 4. Approved Status Language

Use explicit state machines. Do not use vague booleans like `verified = true` for lifecycle.

Candidate verification outcomes:

- `Verification passed — pending authorization`
- `Verification failed`
- `Needs review`
- `Incomplete verification`
- `Outside authorization scope`

Certificate states:

- `Draft`
- `Pending signature`
- `Issued`
- `Expired`
- `Suspended`
- `Revoked`
- `Superseded`
- `Signing failed`

Legacy trust states:

- `Verified legacy`
- `Digitized from source`
- `Unverified legacy`
- `Conflicted`

Exact machine identifiers belong in versioned contracts; user-facing labels must remain clear and localized.

---

## 5. Architecture Contract

### 5.1 Default style

Use modular monolith for transactional control plane plus separate durable workers for file processing, certificate rendering/signing, notifications, search indexing, integrations, analytics, and migration.

Do not add microservice without approved ADR and measured need for scale, isolation, release cadence, ownership, or failure containment.

### 5.2 Bounded modules

- Identity, tenant, organization, facility, delegation.
- LMO posting/competency and GATC authorization/scope.
- Instrument/model/unit and ownership/location history.
- Application, scrutiny, query, correction, workflow.
- Fee, payment, receipt, refund, reconciliation.
- Scheduling, assignment, resource booking.
- Legal source, jurisdiction pack, procedure pack.
- Standard/equipment calibration and custody.
- Verification session, observation, evaluation, disposition.
- Stamp/seal inventory.
- Certificate/signature/QR/public status.
- Evidence/document custody.
- Reminder/notification.
- Search/dashboard projection.
- Audit/integration/migration.

Keep domain logic out of controllers, UI, ORM models, queue handlers, and report templates.

### 5.3 Asynchronous rules

- At-least-once delivery; consumers idempotent.
- Durable timers for appointments, reminders, expiry, retries.
- Transactional outbox or equivalent consistency.
- Bounded retries, timeout, cancellation, dead-letter/quarantine.
- Correlation, causation, actor/system, tenant, and schema version in events.
- No raw evidence, personal data, token, address, or observation text in queue name, URL, metric label, or log.

### 5.4 Storage roles

- PostgreSQL-compatible DB: authoritative transactional metadata.
- S3-compatible versioned object store: documents, evidence, legal sources, templates, certificates.
- Search engine: rebuildable projection.
- Cache: disposable only.
- Audit store: append-only and access-controlled.
- Analytics store: derived aggregates when measured scale needs it.

---

## 6. Suggested Repository Shape

Use existing conventions if implementation already started. For new standalone bounded context, preferred shape:

- `apps/verification-web` — stakeholder, LMO, GATC, supervisor portal.
- `apps/verification-mobile` — Android field app.
- `apps/verification-api` — transactional control plane.
- `workers/verification-documents` — safe document/derivative work.
- `workers/verification-certificates` — rendering/signature orchestration.
- `workers/verification-notifications` — reminders/message delivery.
- `workers/verification-integrations` — payments/registries/imports.
- `packages/verification-contracts` — API/event/state identifiers.
- `packages/verification-procedures` — pack schema, deterministic evaluator, fixtures.
- `packages/measurement` — exact values, units, formulas, uncertainty.
- `legal/instrument-verification/sources` — source metadata/checksums.
- `legal/instrument-verification/jurisdictions` — effective-dated policy packs.
- `legal/instrument-verification/procedures` — approved procedure packs.
- `tests/verification-golden` — immutable expert-approved regression cases.
- `tests/verification-e2e` — full workflows.
- `docs/adr/verification` — decisions.
- `docs/security/verification` — threat model/data classification.
- `docs/operations/verification` — SLO, DR, signing/payment/runbooks.

Do not create every path before needed. Do not mix instrument procedures with packaged-commodity rule packs.

---

## 7. Preferred Technology Direction

Follow approved ADR; absent one, plan direction is:

- Responsive TypeScript web portal.
- Android-first secure offline mobile app.
- Python backend/application and workers.
- PostgreSQL transactional DB.
- S3-compatible object storage with versioning/retention.
- OpenSearch-compatible scoped search.
- Durable workflow engine/queue.
- Template-driven PDF/A certificate and approved editable reports.
- Approved digital-signature/eSign integration with HSM/key service.
- OCI/Kubernetes/OpenShift-compatible deployment.
- OpenTelemetry-compatible observability.
- OIDC/SAML identity integration.

Evaluate license, government cloud/on-prem support, data residency, accessibility, Indian-language support, operations burden, and disaster recovery before adding dependency.

---

## 8. Domain Invariants

Enforce in domain layer and database where possible:

1. Public IDs are non-sequential and enumeration-resistant.
2. Serial number alone is not globally unique instrument identity.
3. Instrument ownership/location changes preserve history.
4. Submitted application version is immutable.
5. Payment state is separate from application state.
6. Assignment requires current jurisdiction/scope eligibility.
7. Verification pins one approved procedure version.
8. Observation records are append-only after submission.
9. Test calculation is reproducible from pinned inputs.
10. GATC/LMO authority is checked at assignment, test, disposition, and signature as policy requires.
11. Standard/equipment suitability is checked at test timestamp.
12. Certificate cannot exist without authorized eligible session.
13. Due date derives from pinned policy and verification facts.
14. Signed certificate bytes never change.
15. Suspension/revocation/supersession appends status event.
16. Public status never exposes unauthorized data.
17. Search/cache/analytics cannot decide authoritative state.
18. Legacy confidence/provenance cannot be upgraded without reviewed evidence.
19. Every high-impact correction has actor, reason, old/new value, time, and authority.
20. Tenant and jurisdiction predicate applies to every private record path.

---

## 9. State-Machine Discipline

Define legal transitions and reject all others.

### Application

`Draft → Submitted → Under scrutiny → Query raised/Accepted/Rejected/Withdrawn → Fee pending/Paid → Scheduled → Verification in progress → Completed`

Allow jurisdiction-specific branches only through versioned workflow policy. Correction after submission creates new version.

### Verification session

`Planned → Identity confirmed → In progress → Submitted → Needs review/Passed pending authorization/Failed/Incomplete → Finalized`

No finalized session mutation; use correction/supersession.

### Certificate

`Draft → Pending signature → Issued → Expired/Suspended/Revoked/Superseded`

`Signing failed` may return to controlled retry; duplicate callback must not issue twice.

### Reference standard

`Active → Due calibration → Quarantined/Expired/Under calibration → Active/Retired`

Out-of-tolerance result opens impact review.

### GATC/LMO authority

`Draft → Pending approval → Active → Suspended/Expired/Revoked/Superseded`

Never infer authority from user role alone.

## 10. Instrument and Measurement Data Rules

### 10.1 Instrument identity

Store separately:

- Instrument type/subtype.
- Model and model-approval reference where applicable.
- Physical instrument unit.
- Components/modules.
- Owner/custodian history.
- Installation/use location history.
- Repair, transfer, stamp/seal, verification, and certificate history.

Deduplication may suggest; authorized user confirms merge/split. Preserve source records and provenance.

### 10.2 Exact values and units

- Store numeric value as exact decimal/rational with explicit unit.
- Keep original entered/display string.
- Validate dimensions and procedure range.
- Preserve significant digits where legally/technically relevant.
- Round only at procedure-defined step/mode.
- Record uncertainty separately from confidence.
- Use injectable clock for effective dates, expiry, authority, calibration, and tests.
- Store UTC plus source/local timezone; never infer test date from upload/sync date.

### 10.3 Procedure pack requirements

Every approved procedure has:

- Stable ID/version and legal source/checksum.
- Jurisdiction/effective period.
- Instrument eligibility.
- LMO/GATC competency/scope.
- Required standards/equipment and ranges.
- Ordered steps/repetitions.
- Observation schema and evidence.
- Formula/tolerance/rounding/uncertainty.
- Missing-data/indeterminate behavior.
- Physical stamp/seal requirements.
- Certificate/validity outputs.
- Expert owner/reviewer/approver.
- Positive, negative, boundary, scope, and expiry golden cases.

Never activate draft/unapproved pack in production.

---

## 11. Evidence and Document Rules

Every upload/capture path must include:

1. Authorized upload session.
2. Size/type/signature/content/decompression validation.
3. Malware scan or quarantined pending scan.
4. Original-byte hash.
5. Versioned immutable object storage.
6. Actor/source/device/time metadata.
7. Custody/audit event.
8. Derivative lineage.
9. Idempotent retry.
10. Integrity verification on retrieval/certificate/export.

Never overwrite original, signed certificate, submitted observation, or previous derivative.

Certificate renderer must receive immutable pinned snapshot. Same snapshot/template should produce deterministic content except controlled signature/timestamp fields.

---

## 12. API and Event Contract

- Version APIs/events.
- Validate input at trust boundary.
- Server derives tenant, authority, scope, fee, outcome eligibility, and due date.
- Never trust client-supplied role, tenant, certificate state, payment success, verifier authority, or calculated pass/fail.
- Idempotency for registration submission, application, upload, payment, callback, scheduling, field sync, signing, notification, and import.
- Structured safe errors.
- Paginate/cap query and export.
- Short-lived upload/download authorization.
- Correlation/causation/tenant/actor/schema metadata.
- Backward-compatible event consumers during rolling deployment.
- Contract changes need migration/version plan.

High-value events include:

- Stakeholder approved/suspended.
- Instrument registered/merged/transferred.
- Application submitted/queried/accepted/rejected.
- Fee assessed/payment reconciled.
- Assignment scheduled/reassigned.
- Verification started/submitted/finalized/corrected.
- Standard quarantined/out-of-tolerance.
- Stamp/seal issued/used/lost/reconciled.
- Certificate issued/signing failed/suspended/revoked/superseded/expired.
- Reminder scheduled/sent/failed.

Events carry IDs and safe metadata—not raw documents/readings unless approved contract needs them.

---

## 13. Payment and External Integration Rules

### 13.1 Payment

- Fee assessment is versioned and itemized.
- Payment state machine separate from application.
- Verify signed server-to-server callback/webhook.
- Browser redirect cannot prove payment.
- Handle duplicate/delayed/out-of-order callbacks.
- Reconcile gateway/treasury settlement against internal ledger.
- Never store card credentials or prohibited payment secrets.
- Refund, waiver, under/overpayment need explicit authority and audit.

### 13.2 Signature

- Private key lives in HSM/approved key service, never code/config/DB.
- Render immutable bytes before signing.
- Bind signature, signer, authority snapshot, certificate hash, provider transaction, and timestamp.
- Retry must distinguish “not signed” from “signed but response lost.”
- Verify signature independently before publishing.
- Document key rotation/compromise/provider outage.

### 13.3 Integration

Wrap identity/payment/signature/message/registry/GIS providers behind ports/adapters. Apply timeout, retry, circuit breaker, replay protection, reconciliation, observability, and manual fallback. No core legal state depends solely on transient external response.

---

## 14. QR and Public Verification Rules

- Use opaque random reference; no sequential certificate endpoint.
- QR carries minimal data.
- Public status is current authoritative projection with immutable event source.
- Display certificate number, issuer, safe instrument summary, verification/validity dates, status, and signature/hash validity as policy permits.
- Clearly warn suspended/revoked/superseded/expired.
- QR scan does not prove physical instrument matches; show comparison fields.
- Rate limit, bot-protect, monitor scraping, and minimize personal data.
- Cache only safe data; revoke/supersede cache invalidation must be prompt.
- Test cloned QR, guessed IDs, stale cache, altered PDF, duplicate number, revoked signature, and provider outage.

---

## 15. Security and Privacy Contract

Every data path must address:

- Tenant/jurisdiction isolation.
- Authentication/authorization and delegation.
- Certificate/signature/key trust.
- Evidence confidentiality/integrity.
- Personal-data minimization and retention.
- Insider misuse and separation of duties.
- Upload/resource abuse.
- Offline device compromise.
- Public endpoint enumeration.
- External egress/data residency.

Required:

- Least privilege and deny by default.
- MFA/step-up for high-impact actions.
- Encryption in transit/at rest.
- Managed keys/secrets; no hardcoded credentials.
- Sensitive logging redaction and bounded metric cardinality.
- Cross-tenant negative tests.
- File limits/malware protection/rate limits/quotas.
- No dev auth bypass in production.
- No uncontrolled bulk export.
- No external AI/service handling production data without approval.
- Append-only privileged-action audit.
- Security headers and standard web/mobile/API protections.
- Dependency/license/secret/source/IaC/container scans, SBOM, signed release artifacts.

Do not claim DPDP/CERT-In/government compliance, VAPT completion, CCA validity, or certification without documented review/evidence.

---

## 16. Mobile and Offline Contract

- Encrypt local DB/files and protect keys with platform keystore.
- Bind to authenticated user/device and managed-device policy where applicable.
- Cache only assigned/minimum records.
- Signed procedure packs with expiry and compatibility.
- Server-authoritative assignment, rule, fee, certificate, and final status.
- Resumable idempotent uploads and event-based sync.
- Important conflicts need explicit resolution; no blind last-write-wins.
- Record device timestamp plus trusted server receipt time and clock offset.
- Expired/revoked offline authorization blocks high-impact completion/signing.
- Never issue/sign certificate solely offline.
- Preserve unsynced work on process death; show count/error/recovery.
- Remote session/device revocation.

Must test airplane mode, poor/intermittent network, duplicate sync, partial evidence, low storage, process kill, clock skew, app upgrade, revoked user/device, assignment reassignment, procedure expiry, and server conflict.

---

## 17. Search, Dashboard, and Analytics Rules

- Search index is projection; authorization rechecked server-side.
- All filters include tenant/jurisdiction constraints.
- Cap result/export size and log bulk access.
- Dashboard totals reconcile to authoritative states.
- Due/overdue status derives from policy/date, not stale manual flag.
- Separate operational pendency/pass-fail trends from enforcement conclusions.
- Avoid personal/low-count data in broad aggregates.
- Keep public analytics aggregated and governance-approved.
- Rebuild index/aggregates from events and test re-index recovery.

## 18. Testing Contract

Run smallest relevant tests first, then broader boundary tests.

### Always cover where applicable

- Happy path.
- Invalid/malicious input.
- Unauthorized/cross-tenant access.
- Missing/partial evidence.
- Duplicate/retry/out-of-order event.
- Effective-date boundary.
- Expired/suspended authority.
- Exact numeric/unit/rounding boundary.
- Standard range/calibration expiry.
- Offline conflict/recovery.
- Certificate correction/suspension/revocation/supersession.
- Payment/signature response-loss reconciliation.
- Accessibility/localization.

### Release-blocking suites

- Legal/procedure golden tests for changed pack/evaluator.
- Certificate/hash/signature/QR tests for trust changes.
- Cross-tenant tests for every data-access change.
- Migration reconciliation/rollback for schema/import changes.
- End-to-end test for user-visible workflow.
- Load/soak benchmark for hot path or capacity change.
- Backup/restore/DR validation for storage/recovery change.

Use synthetic or approved de-identified fixtures. Never commit real credentials, private instrument-owner records, signing keys, payment secrets, production certificates, or unrestricted evidence.

Never claim test passed unless command ran and result observed.

---

## 19. Legacy Migration Rules

- Inventory source and custodian before import.
- Preserve original file/register scan and batch manifest where allowed.
- Hash import source and record parser/mapping version.
- Import in resumable idempotent batches.
- Validate counts, control totals, required fields, duplicate rates, and sampled records.
- Keep source value and normalized value.
- Assign explicit trust label; do not fabricate missing data.
- Match organizations/instruments conservatively; human approves uncertain merge.
- Recompute due date only under approved migration policy and pinned rule.
- Support rollback or corrected re-import without deleting audit history.
- Obtain custodian sign-off.

---

## 20. Observability and Operations

Every new production path needs:

- Structured safe logs.
- Metrics and traces.
- Correlation IDs.
- Health/readiness behavior.
- Actionable errors.
- Alert/dashboard change where relevant.
- Runbook for new failure mode.

Monitor:

- API latency/error/saturation.
- Queue age/retries/dead letters.
- Mobile sync failures/backlog.
- Payment/signature reconciliation.
- Pending scrutiny/appointments/verifications/signatures.
- Reference-standard expiry/quarantine.
- GATC/LMO scope blocks.
- Stamp/seal reconciliation gaps.
- Certificate issue/revoke/supersede rate.
- Public verification errors/abuse.
- Evidence/hash mismatch.
- Cross-tenant denials/anomalies.
- Reminder delivery and cost.

Never log raw evidence, signature material, secrets, tokens, unrestricted observations, or personal details.

---

## 21. Coding Standards

- Use clear typed contracts and cohesive modules.
- Separate domain logic from transport, persistence, framework, and templates.
- Model state transitions explicitly.
- Make clock, IDs, randomness, storage, payment, signature, messaging, and external services injectable.
- Reject invalid state early with structured errors.
- Use DB constraints for critical invariants where feasible.
- Bound query/page/upload/export/retry/concurrency sizes.
- Make asynchronous actions idempotent and cancellation-aware.
- Prefer backward-compatible migrations and expand/migrate/contract.
- Avoid hidden global state and implicit tenant context.
- Do not add comments that restate code; explain legal/safety intent.
- Do not create placeholders that bypass authorization, audit, evidence, procedure, payment, or certificate gates.
- Do not use AI/LLM to execute legal procedure or decide certificate outcome.
- Do not add dependency without need, license/security check, and ADR for major platform choice.

Follow selected formatter, linter, type checker, test runner, and dependency lock policy.

---

## 22. Database and Migration Rules

- Treat migrations as reviewed production artifacts.
- Preserve old application compatibility during rolling deploy when required.
- Never drop/reinterpret certificate, evidence, observation, standard, audit, legal, payment, or authority data without explicit migration/retention approval.
- Backfill in bounded resumable batches.
- Bound locks/transactions.
- Index from measured access patterns.
- Verify tenant predicate on every tenant-owned query.
- Test forward-fix/rollback strategy.
- Dedicated ADR and integrity test for change affecting issued certificate references/hashes.

---

## 23. Documentation Requirements

Update same task when behavior changes:

- ADR for major architecture/technology/trust decision.
- API/event contract.
- Procedure/jurisdiction pack release note.
- Migration and rollback note.
- Threat model/data classification.
- Certificate/signature/QR policy.
- Payment/reconciliation guide.
- Operator runbook/SLO/alert.
- Mobile offline/sync behavior.
- User help/accessibility/localization.
- Known limitation.

Do not casually rewrite `implementation_plan_new.md`. Record implementation decisions in ADRs unless user/governance requests plan update.

---

## 24. Preferred Implementation Sequence

Unless user requests different bounded slice:

1. ADRs: boundaries, stack, tenancy, deployment, authority, procedure packs, exact measurement, evidence, signature/QR, offline, payment.
2. Monorepo/tooling/contracts/test foundation.
3. Identity, tenant, organization, role, delegation, audit.
4. Instrument/model/unit, owner/location history, state machines.
5. Application, scrutiny, query, documents, evidence.
6. Jurisdiction/procedure pack schema and golden-test harness.
7. Exact measurement evaluator and reference-standard register.
8. Scheduling/allocation with LMO/GATC scope.
9. Verification session/observations/disposition/stamp-seal record.
10. Fee/payment/reconciliation.
11. Immutable certificate, approved signature, QR, public status.
12. Due-date/reminder workflows.
13. Search/dashboard projections.
14. Android offline capture/sync.
15. Legacy migration.
16. Additional jurisdictions/instrument families.
17. Security, accessibility, performance, DR, VAPT, and rollout hardening.

Do not build flashy national dashboard before authority, procedure, measurement, evidence, certificate, and audit foundations work.

---

## 25. Definition of Done Per Task

Task is done only when:

- Requested bounded behavior works end to end.
- Acceptance criteria and explicit state transitions are met.
- Relevant unit/contract/integration/golden/e2e/security tests pass.
- Tenant, jurisdiction, role, and authority checks exist server-side.
- Exact legal/procedure versions and audit trail are preserved.
- Evidence/certificate immutability remains intact.
- Error, missing data, and uncertainty fail safely.
- Retry/idempotency and external-response-loss behavior are covered.
- Telemetry and operations path exist.
- Migration/backward compatibility is safe.
- Documentation updated.
- No secret/private evidence/unsafe bypass added.
- Validation results reported truthfully.

For legal/procedure/certificate changes, also require owner approval status, source/version, golden tests, impact report, and rollback plan.

---

## 26. Change Discipline

- Keep diff focused.
- Preserve user/unrelated changes.
- Fix root cause.
- Do not rename/reorganize unrelated code.
- Do not create branch/commit unless requested.
- Do not fabricate credentials, official sources, approvals, signatures, certificates, accuracy, performance, or compliance claims.
- Make one or two focused diagnostic fixes; do not delete meaningful logic to silence tools.
- If blocked, keep safe work and report exact blocker.
- Parallel agents need disjoint write scopes; one owner for shared contracts/migrations/procedure packs.

---

## 27. Required Handoff

Every implementation response states:

1. What changed.
2. Relevant project-relative files.
3. Validation commands and outcomes.
4. Legal/procedure/certificate/security/data impact.
5. Remaining limitation or next logical step.

Never hide failed validation or unapproved legal assumptions.

---

## 28. Immediate Pre-Code Gate

Before first implementation, obtain explicit user approval for initial ADR set from Section 22 of `implementation_plan_new.md`, especially:

- Standalone/shared platform boundary.
- Stack/repository shape.
- State/national tenancy.
- Authority and GATC scope.
- Procedure-pack representation.
- Exact measurement/unit rules.
- Evidence/certificate immutability.
- Digital signature/QR/public verification.
- Payment/reconciliation.
- Offline synchronization.
- Deployment/data residency/DR.

Then implement first thin vertical slice: authenticated stakeholder creates draft instrument/application with tenant-safe persistence and immutable audit—without pretending certificate workflow is complete.
