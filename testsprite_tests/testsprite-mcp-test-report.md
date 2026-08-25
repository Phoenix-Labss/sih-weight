# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata

| Field | Value |
|---|---|
| **Project Name** | sih weight good backend — Legal Metrology Instrument Verification Platform |
| **Date** | 2026-08-25 |
| **Prepared by** | TestSprite MCP + opencode agent |
| **Backend under test** | Fastify v5 + TypeScript + Prisma/SQLite, production build (`node dist/index.js`) @ http://127.0.0.1:8000 |
| **Frontend under test** | React 18 + Vite 6 portal, production preview @ http://127.0.0.1:5173 (API proxied same-origin) |
| **Execution mode** | TestSprite cloud runners via local tunnel (`tun.testsprite.com`) |
| **Test plans** | Backend: 24 progressive-pipeline cases · Frontend: 15 curated UI cases |
| **FINAL RESULT** | ✅ Backend pipeline **24/24 PASSED** (across retry rounds) · Frontend **15/15 PASSED** · Project's own Vitest suite **354/354 PASSED** after fix |

---

## 2️⃣ Requirement Validation Summary

### A. Progressive Pipeline Suite — TC001–TC024: ALL PASSED

Each test is self-contained and rebuilds its prerequisite chain up to the step it verifies (TestSprite executes tests in parallel). Final status per test:

| # | Pipeline Step Verified | Status |
|---|---|---|
| TC001 | Health endpoints without auth (`/health`, `/api/v1/health`) | ✅ Passed |
| TC002 | Approved model catalog (`model_id`, MOD-NAWI-03 present) | ✅ Passed |
| TC003 | Instrument registration → `instrument_id`, UNVERIFIED, public token | ✅ Passed |
| TC004 | Draft application filing → `application_id`, DRAFT | ✅ Passed |
| TC005 | Submission DRAFT → SUBMITTED | ✅ Passed |
| TC006 | LMO scrutiny ACCEPT + OWNER-role RBAC rejection (403) | ✅ Passed |
| TC007 | Fee assessment → FEE_PENDING + nested `fee_assessment` amounts | ✅ Passed |
| TC008 | Payment reconciliation → PAYMENT_RECONCILED | ✅ Passed |
| TC009 | Slot scheduling → SCHEDULED + normalized slot timestamps | ✅ Passed |
| TC010 | Session creation from scheduled app + OWNER RBAC rejection (403) | ✅ Passed |
| TC011 | Identity confirmation | ✅ Passed |
| TC012 | Start testing | ✅ Passed |
| TC013 | Observations with calibrated reference standard (errors = 0 vs MPE) | ✅ Passed |
| TC014 | Statutory disposition VERIFICATION_PASSED_PENDING_AUTHORIZATION + session finalized | ✅ Passed |
| TC015 | Physical stamp/lead-wire seal record + ledger retrieval | ✅ Passed |
| TC016 | Certificate issuance → CERT number, signature ref, SHA-256 hash, opaque QR token | ✅ Passed |
| TC017 | Certificate detail retrieval + OWNER list membership | ✅ Passed *(after bug fix — see §4)* |
| TC018 | Public QR verification without auth (zero-PII projection) + unknown-token 404 | ✅ Passed |
| TC019 | Authenticated certificate PDF (%PDF bytes, attachment disposition) | ✅ Passed |
| TC020 | Public PDF by QR token + invalid-token 404 | ✅ Passed |
| TC021 | Negative: duplicate submit rejected by state machine (400 InvalidStateTransitionError) | ✅ Passed |
| TC022 | Negative: certificate issuance blocked for unfinished session | ✅ Passed |
| TC023 | Negative: cross-tenant application access denied | ✅ Passed |
| TC024 | Negative: unknown QR reference yields structured `{detail}` 404 on both aliases | ✅ Passed |

*Note:* intermediate rounds showed failures exclusively caused by an unstable network path to TestSprite's tunnel (read timeouts through `proxy.tun.testsprite.com`) and by AI-generated scripts assuming wrong field names; both were resolved via targeted retries with pinned contract facts in the plan descriptions.

### B. Frontend E2E (curated 15-case plan) — 15/15 PASSED

Covered: SPA shell render, instrument registration form flow, application creation/submission, officer workspace deep-link (`#officer`), supervisor dashboard, GATC console, persona switcher (Trader ↔ LMO), EN/HI language toggle, Mock/Live API indicator, instruments list, public verification for a valid token (`#/verify/TOKEN_VALID_2026`), invalid-token error state, `#public` deep link, migration console presence, footer render. The portal intentionally has no login page (header-based demo auth); plans were curated to match real navigation.

### C. Project's own regression suite

`cd backend && npm test` → **15 files / 354 tests passed** (includes unit metrology, tier-1 feature ×100, tier-2 boundary, tier-3 pairwise, tier-4 multi-actor scenarios, security & adversarial suites), run *after* the bug fix below.

---

## 3️⃣ Coverage & Matching Metrics

| Dimension | Result |
|---|---|
| Statutory pipeline steps exercised end-to-end | 18/18 verified through TestSprite cloud + locally |
| Backend API surface | 6 route modules / 33 endpoints; all major groups covered |
| State machines | DRAFT→SUBMITTED→ACCEPTED→FEE_PENDING→PAYMENT_RECONCILED→SCHEDULED→session lifecycle→ISSUED all asserted |
| RBAC | OWNER blocked from scrutiny (403) and session creation (403) — verified in-cloud |
| Multi-tenancy | Cross-tenant denial case passed |
| Fail-closed behavior | Double-submit rejection, ineligible-session issuance block, structured 404s — passed |
| Zero-PII public projection | Verified: masked serial, no owner/personal identifiers, cryptographic validity flag |
| Frontend views | All 7 tabs/views + i18n + API-mode toggle covered |
| Cloud pass rate (final rounds) | Backend 16/16 retried cases passed; frontend 15/15 |

---

## 4️⃣ Key Gaps / Risks

### 🐞 Real defect found and fixed during testing
**OWNER-scoped certificate lists were always empty.**
- *Symptom:* TC017 failed — issued certificate absent from the OWNER's list view.
- *Root cause:* creation resolves the owner hint through user→stakeholder mapping (`usr-trader-01` → stored `stk-trader-01`), but `certificate.service.listCertificates` filtered by the raw header id without that resolution, so the OWNER filter never matched.
- *Fix:* `backend/src/services/certificate.service.ts` — mirror `listInstruments`'s user→stakeholder resolution before filtering. Verified: OWNER total went 0 → 39; full Vitest suite still 354/354 green.

### Environment notes (external to the app)
1. Unstable network path to TestSprite tunnel infra caused transient read timeouts/DNS loss mid-runs; resolved by retrying when stable. If it recurs, re-run remaining IDs from a different network.
2. Parallel cloud runners against one SQLite file can collide on unique constraints; uuid-based serials mitigate. Production Postgres removes this class entirely.

### Product observations (non-blocking)
3. Header-based demo authentication (`X-Actor-Role`, default OWNER) is fine for demo but must be replaced by OIDC/JWT before production.
4. Inconsistent identifier naming (`model_id`/`instrument_id`/… but no plain `id`) repeatedly confused AI code generation — worth normalizing for integrators too.
5. `/pay` trusts client-supplied receipt references (no gateway callback verification) — acceptable demo shortcut, flagged for hardening.
6. Frontend `auto` API mode silently falls back to mock data; consider a visible banner so live demos aren't misleading.

### Files changed during testing
- `testsprite_tests/testsprite_backend_test_plan.json` — progressive 24-case pipeline plan (reusable)
- `testsprite_tests/testsprite_frontend_test_plan.json` — curated 15-case UI plan (reusable)
- `testsprite_tests/testsprite-mcp-test-report.md` — this report
- `apps/verification-web/vite.config.ts` — added `preview.proxy` for same-origin API access in browser tests
- `backend/src/services/certificate.service.ts` — **bug fix**: OWNER filter resolves user→stakeholder id (see §4)
