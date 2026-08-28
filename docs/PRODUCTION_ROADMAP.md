# Saraya Livestock Production Roadmap

This document is the delivery baseline for moving Saraya Livestock from a prototype to a customer production release. A phase is complete only when its acceptance gates pass in CI and in the staging environment.

## Release principles

- Production is closed by default: authentication, authorization, tenant scope and license policy are enforced by the API.
- Demo data and offline simulations never appear in a production build.
- Database changes are delivered through reviewed migrations.
- Inventory, health, breeding and accounting workflows are atomic and auditable.
- A release is not production-ready until backup restoration and rollback are tested.

## P0 — Security foundation

Status: implementation complete; operational secret rotation remains a deployment gate

- [x] Global JWT authentication guard with explicit public-route opt-out.
- [x] Server-side role guards on sensitive modules.
- [x] Remove client-side role switching and offline password bypass.
- [x] Send bearer tokens from the web client and validate restored sessions.
- [x] Remove fixed JWT/database fallbacks and unrestricted trial generation.
- [x] RSA-only license verification and read-only behavior for invalid licenses.
- [x] Rate limiting, Helmet headers, restricted CORS and production Swagger policy.
- [x] Strong DTO validation for login, registration, role changes and password reset.
- [x] One-time administrator provisioning command.
- [ ] Rotate the existing local JWT, encryption and RSA signing secrets.
- [x] Enforce organization/farm scope on current record lookups and mutations.
- [x] Add negative cross-farm and cross-organization service tests.
- [x] Add opaque refresh-token rotation, reuse detection and immediate server-side session revocation.
- [x] Make JWT signing and verification consume the active Vault secret dynamically, reject non-durable local rotation, and block unsafe encryption-key rotation.

Acceptance gate: anonymous API requests receive 401, unauthorized roles receive 403, expired licenses cannot write, and cross-farm access tests pass.

## P1 — Contracts and data integrity

- [x] Replace current interface-only and inline operational request types with validated DTO classes.
- [x] Generate the web API client from OpenAPI with deterministic artifacts, centralized auth/idempotency transport and CI drift/boundary gates.
- [x] Add named response DTOs for accounting, animals and barns, consume their generated web types and protect them with CI response-contract gates.
- [x] Add named response DTOs for health, breeding and milking and enforce the server-authoritative milk withdrawal decision in the web workflow.
- [x] Add named response DTOs for nutrition and reports, including polymorphic export rows and deterministic UTC dashboard boundaries.
- [x] Complete named response DTOs for authentication, users, audit, licensing, security and fattening; require typed responses for all 58 operations and remove the web compatibility overload.
- [x] Align milk, treatment, breeding and weight payloads used by the current web client.
- [x] Add positive-value, date, enum and identifier validation to current operational endpoints.
- [x] Add initial database uniqueness and direct farm ownership constraints.
- [x] Remove server and UI fallback business values from current operational screens and reports.
- [x] Add durable idempotency keys to operational write endpoints, including PostgreSQL concurrency and rollback verification.

Acceptance gate: invalid requests fail deterministically, the UI never reports success for a failed write, and no demo value can enter a production report.

## P2 — Atomic domain workflows

- [x] Transactional feed dispensing and inventory valuation.
- [x] Transactional treatment and withdrawal-lock updates.
- [x] Transactional calving, dam-state and newborn creation.
- [x] Transactional journal posting, period close and year rollover with serializable retry handling.
- [x] Year-scoped ledger aggregation, explicit closing entries and immutable posted-journal database guards.
- [x] Concurrency controls for stock, tag numbers and journal sequence numbers.
- [x] Append-only audit-event foundation for authenticated writes, tenant-scoped review and database-level mutation protection.
- [x] Link accounting, treatment, feed/inventory, user-identity, breeding, herd, milking and weight writes with audit insertion in the same transaction.

Acceptance gate: forced failure at every workflow step leaves the database consistent.

## P3 — Database lifecycle

- [x] Create a reviewed baseline Prisma migration.
- [x] Add database-enforced append-only audit-event migration.
- [x] Stop using `prisma db push` outside disposable development databases and CI.
- [x] Add guarded database classification, verified backup manifests, empty-target restore rehearsals, safe managed migration deployment, reconciliation, and rollback procedures.
- [x] Build and rehearse the transactional prototype-to-fresh-schema adoption tool against a restored staging copy, with strict preflight rejection and per-table SHA-256 reconciliation.
- Add retention, archival and customer export policies.

Acceptance gate: a blank database can be installed and an existing database can be upgraded and rolled back without data loss.

## P4 — Test and delivery system

- [x] PostgreSQL integration tests for migration integrity and concurrent idempotency behavior.
- [x] Strict production configuration validation and startup schema compatibility guard.
- [x] Separate liveness/readiness endpoints with database and migration readiness checks.
- [x] Containerized API/web/PostgreSQL topology with private backend network and Caddy online/offline TLS profiles.
- [x] Package the Cairo font locally and remove runtime Google Fonts requests.
- [x] Define the native Windows server/client installer architecture and protected filesystem/service model.
- [x] Produce and inspect an Electron/NSIS x64 client installer with immutable web assets (internal unsigned artifact).
- Role and tenant-isolation test matrix.
- End-to-end tests for herd, milk, treatment, breeding, feed and accounting.
- Implement the server Inno Setup installer; add product icon, sign both installers and test install/upgrade/uninstall on a clean supported Windows image.
- Restore drills and power/network interruption tests.
- CI quality gates for build, tests, audit and migrations.

Acceptance gate: all critical workflows pass automatically and a release artifact is reproducible from a tagged commit.

## P5 — Customer pilot and general availability

- Run one farm in shadow mode for at least 30 days.
- Reconcile operational and accounting records daily during the pilot.
- Train users and validate role assignments.
- Measure support incidents, data corrections and workflow completion times.
- Approve general availability only after veterinary and accounting sign-off.

## Current verification commands

```text
cd apps/api
npx prisma validate
npm run prisma:migrate:deploy
npx jest --runInBand
npm audit --omit=dev --audit-level=high

cd ../web
npm run typecheck

cd ../..
npm run contracts:check
npm run build:all
```

For a new customer database, configure the `INITIAL_*` environment variables and run `npm run provision:admin` once from `apps/api`. Remove the initial password from the environment immediately afterward.
