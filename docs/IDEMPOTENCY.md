# Operational idempotency

Saraya Livestock protects operational writes from duplicate execution after a timeout, network interruption, power loss or user retry. The idempotency record and the business effect commit in the same PostgreSQL transaction.

## API contract

- Every protected write requires an `Idempotency-Key` header containing a lowercase-compatible UUID v4. Missing or invalid keys return `400` before the service runs.
- A key is scoped to the organization and bound to the authenticated user, farm, HTTP method, path and canonical SHA-256 request-body hash.
- Repeating the same request returns the stored successful JSON response without executing the workflow again.
- Reusing a key for a different request, user or farm returns `409`.
- Concurrent duplicates are serialized by PostgreSQL with `INSERT ... ON CONFLICT DO NOTHING` and a row lock. Exactly one caller owns the execution.
- The idempotency reservation, domain writes, stock or ledger changes, audit event and cached response share one transaction. Any failure rolls them all back.
- Cached responses are limited to 256 KiB. Operational endpoints must return compact resource or confirmation payloads.

Protected modules are herd mutations, breeding, milk logging, treatment, weight logging, feed ingredients/formulas/dispensing and accounting mutations. Authentication, license activation and the read-only least-cost calculation are deliberately outside this contract.

## Web and desktop behavior

The shared client automatically creates and sends the key. Until a definitive HTTP response arrives, it durably stores only the SHA-256 request fingerprint, UUID key and creation time. It never stores the request body or authentication token in this cache. An identical retry after an application or power interruption therefore reuses the same key.

The cache is namespaced by the authenticated organization and user. It is cleared for that request after any definitive HTTP response; network failures leave it available for retry. Default dates use `YYYY-MM-DD` so an otherwise identical retry remains stable across application restarts.

## Retention and operations

`IDEMPOTENCY_RETENTION_DAYS` controls both the server retention contract and client retry window. The accepted range is 1–30 days and the default is 7. Clients must not expect replay after that window and must never intentionally reuse UUID keys.

Run the bounded cleanup command daily from one maintenance job:

```text
cd apps/api
npm run cleanup:idempotency
```

The command deletes expired records in batches of 1,000 and does not touch audit or business data. Monitor failures and table growth. Run it only after migration `0005_operational_idempotency` is applied.

## Verification gates

- Unit tests verify canonical hashing, invalid keys, replay, conflict and rollback behavior.
- PostgreSQL integration tests launch two concurrent requests with one key and assert one committed audit effect.
- A blank temporary database must apply migrations `0001` through `0005` before the integration suite runs.
- The existing prototype database must first be restored into staging and reconciled; do not mark migration history as applied blindly.
