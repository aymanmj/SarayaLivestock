# Prototype-to-production database adoption

This runbook moves an unmanaged Saraya prototype into a separate, empty database created exclusively by the reviewed Prisma migrations. It never marks the baseline as applied over existing tables and never updates the prototype source.

## Safety model

- `DATABASE_URL` identifies the unmanaged, read-only source copy.
- `ADOPTION_DATABASE_URL` or `ADOPTION_DATABASE_NAME` identifies a different, migration-managed target.
- The source must contain exactly the 21 reviewed prototype tables and no Prisma migration history.
- The target must contain exactly the release schema, all expected migrations, and zero rows in every application table.
- The dry run uses repeatable-read, read-only transactions on both databases.
- Execution uses a repeatable-read, read-only source snapshot and one serializable target transaction protected by an advisory lock.
- Any preflight issue, insert error, count difference, or SHA-256 table-digest difference rolls back the complete target transaction.
- Reports contain database identifiers, counts, issue codes, entity IDs, and digests but no passwords or business field values.

There is intentionally no distributed transaction. Production execution therefore requires all API and desktop writes to be stopped before the final backup and kept stopped through cutover. The immutable restored copy is the preferred import source.

## Reviewed transformations

The adopter preserves IDs, timestamps, password hashes, monetary values, and relationships. It performs only these declared transformations:

1. Backfill `feed_formulas.farmId` from the farms of linked ingredients and distribution barns. Conflicting evidence rejects the entire adoption. With no evidence, a formula can inherit ownership only when the source contains exactly one farm.
2. Backfill a missing journal period only when exactly one period covers the journal date.
3. Insert animal-mother and account-parent links after their complete entity sets exist.
4. Temporarily import fiscal years and periods as open so database journal-integrity triggers can validate every historical entry, then restore their source status and close timestamp.
5. Rebuild one `journal_sequences` row per farm/fiscal year from the greatest valid `JV-<year>-<number>` suffix.
6. Optionally clamp a fiscal-period boundary to its fiscal year only when the drift is at most one day and the change excludes no linked journal. This requires the explicit `SARAYA_ADOPTION_NORMALIZE_PERIOD_BOUNDARIES=true` flag and accounting approval.

Partial imports and skipped rows are forbidden. Formula ambiguity, cross-tenant relationships, invalid password hashes, hierarchy cycles, invalid fiscal dates, unbalanced journals, or line/header accounting differences reject the operation.

## Staging dry run

First restore the verified prototype backup into a new empty staging database and apply migrations `0001` through `0005` to another empty target. Then configure the restored database as `DATABASE_URL` and run:

```text
set SARAYA_DB_ENV=staging
set ADOPTION_DATABASE_NAME=saraya_adoption_rehearsal
set SARAYA_DB_CONFIRM=saraya_adoption_rehearsal
set SARAYA_ADOPTION_NORMALIZE_PERIOD_BOUNDARIES=true
npm run db:adopt:dry-run
```

For a target on another server, use `ADOPTION_DATABASE_URL`. A successful report has `status: READY`, no issues, the complete source row counts, the planned transformation counts, and an expected SHA-256 digest for each historical table. The dry run does not require or imply a stopped-write assertion and never inserts rows.

## Transactional execution

Keep writes stopped, confirm the exact target again, and add the execution authorization:

```text
set SARAYA_DB_WRITES_STOPPED=true
set SARAYA_ADOPTION_EXECUTE=true
npm run db:adopt:execute
```

Production additionally requires `SARAYA_DB_ALLOW_PRODUCTION=true` and a non-empty `SARAYA_DB_CHANGE_TICKET`. Never leave execution or production flags in a persistent service environment.

A successful report has `status: COMPLETED`, zero issues, matching source/target digest entries for all 21 historical tables, and the expected counts for the four new operational tables. `audit_events`, `user_sessions`, and `idempotency_records` start empty; `journal_sequences` contains the derived rows.

## Cutover and rollback gate

Before switching customer traffic:

1. Run `db:inspect` against the adopted target and require no pending, unknown, or failed migration and zero data issues.
2. Run the complete API suite with `RUN_DB_INTEGRATION_TESTS=true` against the adopted target.
3. Run application smoke and end-to-end workflows using staging credentials.
4. Retain the backup manifest, archive hash, restore snapshot, dry-run report, completed report, test evidence, operator, and change ticket.
5. Switch the deployment connection only after veterinary/accounting sign-off on declared transformations.

Before customer writes resume, rollback means switching back to the frozen source or restoring its verified archive into another empty database. Never restore over the adopted database. After new customer writes exist, use an approved forward fix unless incident management explicitly accepts the recovery-point loss.
