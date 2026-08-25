# Project: Legal Metrology Instrument Verification Backend (Node.js / TypeScript / Fastify / Prisma)

## Architecture Overview
A modular, high-integrity transactional backend control plane in Node.js (v24 LTS), Fastify, TypeScript, and Prisma ORM, completely replacing the legacy Python backend.
- **Runtime & Web Framework**: Node.js v24+, Fastify v5 with fast-json-stringify, @fastify/cors, @fastify/helmet, @fastify/rate-limit.
- **Database & Data Layer**: Prisma ORM with SQLite (dev/test) / PostgreSQL (production), 22 domain models, Decimal(18,6) for metrological observations, Decimal(12,2) for statutory fees.
- **Statutory Metrology Engine**: Exact rational/decimal arithmetic via `decimal.js` (28-digit precision, `ROUND_HALF_UP`), statutory NAWI Class I/II/III/IIII stepped MPE functions, turning point error ($P = I + 0.5e - \Delta L$), zero error ($E_0$), corrected error ($E_c$), eccentricity evaluation, repeatability spread, tare error, and fail-closed reference standards validation.
- **Cryptographic Certification & QR**: RFC 8785 JSON Canonicalization Scheme (JCS), SHA-256 cryptographic digest, Ed25519 digital signing, simulated HSM DSC provider with versioned key ring, 256-bit high-entropy opaque QR tokens (`cert_tok_<base64url>`), zero-PII public verification endpoint (`/public/certificates/verify/:qrReference` and `/verify/qr/:qrReference`).
- **Multi-Tenancy & RBAC/ABAC**: Request scoping via `X-Tenant-Id`, `X-Jurisdiction-Id`, `X-Actor-Id`, `X-Actor-Role` (with fallback to default development tenant `tenant-delhi-central` and role `OWNER`/`LMO`). Strict role matrix: `OWNER`, `APPLICANT`, `LMO`, `GATC_VERIFIER`, `SUPERVISOR`, `CONTROLLER`, `ADMIN`, `PUBLIC`.

## Code Layout
```
backend/
├── src/
│   ├── index.ts                      # Server entry point & graceful shutdown
│   ├── app.ts                        # Fastify application factory & plugin registration
│   ├── config/                       # Environment configuration & constants
│   ├── core/
│   │   ├── decimal.ts                # Decimal.js context & exact arithmetic helpers
│   │   ├── errors.ts                 # Domain and HTTP error classes with .detail format
│   │   ├── types.ts                  # Shared TypeScript types and enums
│   │   └── state-machines/           # State machine transition guards & lifecycle handlers
│   │       ├── application.machine.ts
│   │       ├── session.machine.ts
│   │       ├── certificate.machine.ts
│   │       ├── payment.machine.ts
│   │       └── standard.machine.ts
│   ├── metrology/                    # Statutory Legal Metrology Calculation Engine
│   │   ├── mpe.ts                    # Stepped MPE piecewise functions (Class I-IIII)
│   │   ├── nawi.evaluator.ts         # NAWI turning point, error, eccentricity, repeatability, tare
│   │   ├── standards.validator.ts    # Reference standards hierarchy and calibration validator
│   │   └── trace.generator.ts        # Canonical JSON calculation trace generator
│   ├── security/                     # Cryptography, DSC & Multi-Tenancy
│   │   ├── canonical-json.ts         # RFC 8785 JCS deterministic serialization
│   │   ├── crypto.ts                 # SHA-256 digest, Ed25519 key management & signing
│   │   ├── hsm-dsc.provider.ts       # Simulated HSM Digital Signature Certificate provider
│   │   ├── qr-token.ts               # High-entropy opaque QR token generator & resolver
│   │   ├── pdf-generator.ts          # Pure TypeScript binary PDF/A document renderer
│   │   └── middleware/
│   │       ├── auth.middleware.ts    # Header extraction (X-Actor-Id, X-Actor-Role, etc.)
│   │       ├── tenant.guard.ts       # Multi-tenant isolation guard
│   │       └── rbac.guard.ts         # Role & permission ABAC/RBAC guard
│   ├── routes/                       # REST API Route Plugins (mounted under /api/v1)
│   │   ├── instruments.routes.ts     # Instruments & Models endpoints
│   │   ├── applications.routes.ts    # Applications, Scrutiny, Correction, Fees, Payment, Scheduling
│   │   ├── sessions.routes.ts        # Verification Sessions, Identity, Start, Observations, Disposition
│   │   ├── stamps.routes.ts          # Physical Stamps & Seals endpoints
│   │   ├── certificates.routes.ts    # Certificates, Issue, Status Updates, PDF rendering
│   │   └── public.routes.ts          # Public QR Verification & Status projection
│   ├── services/                     # Business Logic Services
│   │   ├── instrument.service.ts
│   │   ├── application.service.ts
│   │   ├── session.service.ts
│   │   ├── stamp.service.ts
│   │   ├── certificate.service.ts
│   │   └── public-verify.service.ts
│   └── db/
│       ├── prisma.ts                 # Prisma client singleton instance
│       └── seed.ts                   # Demonstration fixtures matching apps/verification-web
├── prisma/
│   ├── schema.prisma                 # Authoritative 22-entity Prisma schema
│   └── migrations/                   # Database migrations / schema sync
├── tests/
│   ├── unit/                         # Unit calculation and precision tests
│   ├── e2e/                          # Tiers 1-4 feature, boundary, pairwise, scenario tests
│   ├── integration/                  # Fastify API integration tests
│   └── ...                           # Challenger probe tests (metrology & security)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|:------:|
| 1 | Exact Decimal Arithmetic | 28-digit precision arithmetic with `ROUND_HALF_UP` via `decimal.js`, zero binary float drift | M1 | AGENTS.md §3.4 | **DONE** |
| 2 | Statutory NAWI Stepped MPE | Piecewise MPE formulas for Class I, II, III, IIII (Initial & Periodic Re-Verification) | M1 | AGENTS.md §3.3 | **DONE** |
| 3 | NAWI Error Calculations | Turning point ($P$), zero error ($E_0$), observed error ($E$), corrected error ($E_c$) | M1 | spec_miner_domain | **DONE** |
| 4 | Eccentricity & Repeatability | 5-position eccentricity test, $\ge 3$ run repeatability spread ($\Delta P \le \text{MPE}$), tare net test | M1 | spec_miner_domain | **DONE** |
| 5 | Reference Standards Validator | Fail-closed validation for calibration expiry, quarantine, accuracy class ($E \to F \to M$), $U \le \frac{1}{3}\text{MPE}$ | M1 | AGENTS.md §3.5 | **DONE** |
| 6 | Statutory State Machines | Full lifecycle guards for Applications, Sessions, Certificates, Payments, Standards | M1 | AGENTS.md §9 | **DONE** |
| 7 | Authoritative Prisma Schema | 22 domain models with exact `Decimal(18,6)` and `Decimal(12,2)` precision types | M2 | explorer_security_infra | **DONE** |
| 8 | Multi-Tenant Database Seeding | Fixtures for Delhi Central (`tenant-delhi-central`, `jur-dl-01`), traders, LMOs, models, instruments, mock QR tokens | M2 | spec_miner_frontend | **DONE** |
| 9 | Fastify Server Core & Security | Fastify v5 setup with CORS, Helmet CSP/HSTS, rate limiting, and unified `.detail` error format | M3 | spec_miner_frontend | **DONE** |
| 10 | Multi-Tenant RBAC/ABAC Auth | Header parser (`X-Actor-Id`, `X-Actor-Role`, `X-Tenant-Id`, `X-Jurisdiction-Id`) with strict role enforcement | M3 | explorer_security_infra | **DONE** |
| 11 | Instrument & Model REST APIs | `GET/POST /tenants/:id/instruments`, `GET /tenants/:id/instruments/:id`, `GET /tenants/:id/instruments/models` | M4 | spec_miner_frontend | **DONE** |
| 12 | Application Lifecycle APIs | `GET/POST /tenants/:id/applications`, `/submit`, `/scrutiny`, `/correction`, `/fee`, `/pay`, `/schedule` | M4 | spec_miner_frontend | **DONE** |
| 13 | Verification Session APIs | `GET/POST /tenants/:id/sessions`, `/identity`, `/start`, `/observations`, `/disposition` | M4 | spec_miner_frontend | **DONE** |
| 14 | Physical Stamp & Seal APIs | `POST/GET /tenants/:id/sessions/:id/stamps` | M4 | spec_miner_frontend | **DONE** |
| 15 | Certificate & Status APIs | `GET/POST /tenants/:id/certificates`, `/issue`, `/status`, binary PDF download | M4 | spec_miner_frontend | **DONE** |
| 16 | RFC 8785 Canonical JSON & SHA-256 | Deterministic JCS key sorting and SHA-256 certificate payload digest generation | M5 | explorer_security_infra | **DONE** |
| 17 | Ed25519 & Simulated HSM DSC | Cryptographic certificate signing, key version rotation (`v1`, `v2`, `v3`), signature verification | M5 | explorer_security_infra | **DONE** |
| 18 | High-Entropy QR Verification | 256-bit opaque tokens, `/public/certificates/verify/:token`, `/verify/qr/:token`, PII redaction, serial masking | M5 | spec_miner_frontend | **DONE** |
| 19 | E2E Testing Suite (Tiers 1-4) | Comprehensive requirement-driven opaque-box test suite (Feature, Boundary, Combinatorial, Scenarios) | Final | Project Pattern | **DONE** |
| 20 | Tier 5 Adversarial Coverage Hardening | White-box adversarial testing, edge case stress test harness, zero-tamper verification | Final | Project Pattern | **DONE** |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|:------:|
| M1 | Metrology & Domain Engine | Decimal.js arithmetic, stepped MPE, error formulas, eccentricity, repeatability, reference standards, state machines | none | **DONE** |
| M2 | Prisma Data Layer & Seed Engine | 22-entity schema.prisma, SQLite/PostgreSQL client, demonstration seed fixtures matching frontend | none | **DONE** |
| M3 | Fastify Architecture & Security | Fastify app setup, CORS, Helmet, rate-limit, auth/tenant headers, RBAC/ABAC guards, error formatter | M1, M2 | **DONE** |
| M4 | Complete REST API Surface | All endpoints for Instruments, Applications, Sessions, Stamps, Certificates, Public QR | M1, M2, M3 | **DONE** |
| M5 | Cryptographic DSC & QR Engine | RFC 8785 JCS, SHA-256, Ed25519 HSM DSC signing, opaque QR tokens, public verify service, binary PDF rendering | M1, M2, M3, M4 | **DONE** |
| Final | 100% E2E Pass & Tier 5 Hardening | Pass 100% of E2E test suite (Tiers 1-4) and complete Tier 5 white-box adversarial hardening (354/354 tests pass) | M1-M5, TEST_READY | **DONE** |
