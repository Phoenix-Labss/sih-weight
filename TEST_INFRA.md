# E2E Test Infra: Legal Metrology Backend

## Test Philosophy
- **Opaque-Box & Requirement-Driven**: Derived strictly from `ORIGINAL_REQUEST.md`, `AGENTS.md`, and frontend API contracts. No dependency on internal backend implementation details.
- **Methodology**: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Scenarios.
- **Test Runner**: Vitest / Node.js native test runner against live Fastify HTTP server.
- **Pass/Fail Semantics**: Strict HTTP status code matching, response JSON schema validation, exact calculation trace verification, deterministic state transitions.

## Feature Inventory & Test Coverage Matrix
| # | Feature | Requirement Source | Tier 1 (Min 5) | Tier 2 (Min 5) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|---------|-------------------|:--------------:|:--------------:|:-----------------:|:-----------------:|
| 1 | Exact Decimal Arithmetic | AGENTS.md §3.4 | 5 | 5 | ✓ | ✓ |
| 2 | Statutory NAWI Stepped MPE | AGENTS.md §3.3 | 5 | 5 | ✓ | ✓ |
| 3 | NAWI Error Calculations | spec_miner_domain | 5 | 5 | ✓ | ✓ |
| 4 | Eccentricity & Repeatability | spec_miner_domain | 5 | 5 | ✓ | ✓ |
| 5 | Reference Standards Validator | AGENTS.md §3.5 | 5 | 5 | ✓ | ✓ |
| 6 | Statutory State Machines | AGENTS.md §9 | 5 | 5 | ✓ | ✓ |
| 7 | Authoritative Prisma Schema | explorer_security_infra | 5 | 5 | ✓ | ✓ |
| 8 | Multi-Tenant Database Seeding | spec_miner_frontend | 5 | 5 | ✓ | ✓ |
| 9 | Fastify Server Core & Security | spec_miner_frontend | 5 | 5 | ✓ | ✓ |
| 10 | Multi-Tenant RBAC/ABAC Auth | explorer_security_infra | 5 | 5 | ✓ | ✓ |
| 11 | Instrument & Model REST APIs | spec_miner_frontend | 5 | 5 | ✓ | ✓ |
| 12 | Application Lifecycle APIs | spec_miner_frontend | 5 | 5 | ✓ | ✓ |
| 13 | Verification Session APIs | spec_miner_frontend | 5 | 5 | ✓ | ✓ |
| 14 | Physical Stamp & Seal APIs | spec_miner_frontend | 5 | 5 | ✓ | ✓ |
| 15 | Certificate & Status APIs | spec_miner_frontend | 5 | 5 | ✓ | ✓ |
| 16 | Canonical JSON & SHA-256 | explorer_security_infra | 5 | 5 | ✓ | ✓ |
| 17 | Ed25519 & Simulated HSM DSC | explorer_security_infra | 5 | 5 | ✓ | ✓ |
| 18 | High-Entropy QR Verification | spec_miner_frontend | 5 | 5 | ✓ | ✓ |
| 19 | Binary PDF Certificate Rendering | spec_miner_frontend | 5 | 5 | ✓ | ✓ |
| 20 | Multi-Tenant Data Isolation | AGENTS.md §15 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Directory Layout**:
  - `backend/tests/unit/`: Domain engine, calculation formulas, stepped MPE, decimal arithmetic, RFC 8785 canonical JSON, Ed25519 crypto.
  - `backend/tests/e2e/tier1_feature/`: Isolated endpoint verification, CRUD, and happy paths.
  - `backend/tests/e2e/tier2_boundary/`: Extreme values, division-by-zero, negative tolerances, expired certificates, invalid headers.
  - `backend/tests/e2e/tier3_pairwise/`: Cross-feature interactions (e.g. Scrutiny query -> correction -> fee -> pay; Quarantined standard -> session failure).
  - `backend/tests/e2e/tier4_scenarios/`: Real-world end-to-end multi-actor workflows (Trader registration -> Application -> Officer verification -> Certificate issue -> Public QR scan).
  - `backend/tests/e2e/tier5_adversarial/`: Tamper injection, invalid signature replay, cross-tenant penetration, simulated clock skew.

## Pass/Fail Acceptance Criteria
- 100% of all test cases across Tiers 1-4 pass with zero failures.
- Zero floating-point drift in legal metrology calculations.
- Clean Forensic Auditor integrity attestation.
- Complete compatibility with `apps/verification-web`.
