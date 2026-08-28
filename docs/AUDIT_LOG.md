# Audit log operating model

Saraya records successful authenticated `POST`, `PUT`, `PATCH` and `DELETE` requests in `audit_events`. Events are scoped by organization and optional farm, contain the actor, route, status, timestamp and target identifier, and deliberately exclude request bodies and query strings so passwords and sensitive payloads are not copied into the log.

Only `SUPER_ADMIN` users can review their organization's events through `GET /api/v1/audit-events`. The endpoint uses bounded cursor pagination and supports farm, entity and date filters. No application endpoint can update or delete an event.

Migration `0002_audit_events_append_only` adds a PostgreSQL trigger that rejects every update or delete on the table, including accidental Prisma operations. Operational database roles should additionally receive only `SELECT` and `INSERT` privileges for this table.

## Current reliability boundary

Critical accounting, treatment, feed/inventory, user-identity, herd, breeding, milking and weight mutations append their domain audit event inside the same Prisma transaction as the business write. If the immutable audit event cannot be inserted, the complete transaction fails and the business change is rolled back. Their controllers are marked as domain-audited so the HTTP interceptor does not create a duplicate best-effort event.

Non-domain authenticated mutations, including license-file activation, still use the HTTP interceptor. It appends the event after the operation succeeds and before the response is returned; an audit-storage failure is logged and cannot roll back a write that has already completed outside PostgreSQL. External append-only export remains an asynchronous production control and must not weaken the database transaction boundary.

## Production controls still required

- Alert on every audit append failure and on unexpected gaps in event timestamps.
- Forward events to access-controlled, encrypted, append-only external storage.
- Define retention by customer contract and applicable law.
- Test privileged archival and legal-erasure procedures without weakening routine immutability.
- Synchronize server time and monitor clock drift.
