# Database lifecycle rehearsal — 2026-08-28

This evidence records a local, isolated rehearsal. It is not approval for customer cutover and contains no database credentials or business rows.

## Source classification

- PostgreSQL server: 17.
- Database state: `PROTOTYPE_UNMANAGED`.
- Public business tables: 21.
- Prisma migration history table: absent.
- Expected release migrations: `0001` through `0005`.
- Duplicate barn names, animal tags, feed ingredients, milk shifts, and daily weights: zero.
- Unbalanced journal headers, orphan journal lines, and journal line/header mismatches: zero.
- `feed_formulas.farmId` is absent in the prototype; formula ownership checks correctly report an unresolved schema prerequisite.

The guarded migration command was exercised against this state and rejected `prisma migrate deploy` before mutation.

## Backup evidence

- Format: PostgreSQL custom archive.
- PostgreSQL client: compatible major version 17; the incompatible version 15 found earlier on `PATH` was rejected.
- Archive size: 59,681 bytes.
- SHA-256: `179a8aae13ed970a25e6bd65ed40865979925c319a2209b708145d2807bad4ee`.
- Archive listing verification: passed with `pg_restore --list`.
- Manifest recorded `writesStopped=false`; this safety backup therefore cannot be supplied to `db:migrate:safe` as cutover evidence.

## Restore evidence

- Target: a newly created empty database named `saraya_restore_drill_20260828_a7c9`.
- Restore guard verified that the target name was staging-like, different from the source, explicitly confirmed, and contained no public tables.
- Restore used `--exit-on-error`, `--no-owner`, and `--no-privileges`.
- Post-restore classification remained `PROTOTYPE_UNMANAGED`, as expected.
- Source and restored row counts, milk yield, feed stock, and journal header/line totals reconciled exactly.
- The temporary target was checked for active connections and deleted after verification. It remains recoverable from the verified archive.

## Empty-schema migration drill

- Target: a newly created empty database named `saraya_staging_migration_drill_20260828_b3e1`.
- The guarded deploy verified the exact target name, staging environment, stopped-write assertion, and empty state.
- Migrations `0001_baseline` through `0005_operational_idempotency` applied successfully from zero.
- Pre/post migration snapshots reconciled; the newly created schema contained no unexpected business rows.
- The complete Jest suite ran with database integration enabled: 20 suites and 86 tests passed, with zero skipped tests.
- PostgreSQL trigger integrity and concurrent idempotency/rollback integration tests passed.
- The temporary target was checked for active connections and deleted. Pre/post snapshots remain under the ignored `backups/` evidence directory.

## Prototype adoption drill

- Immutable source: the verified custom archive was restored into the isolated `saraya_adoption_restore_20260828_d5e3` database and reconciled exactly before adoption.
- Fresh target: `saraya_adoption_rehearsal_20260828_e6f4`; migrations `0001` through `0005` were applied from zero.
- The first dry run rejected one historical fiscal period beginning one day before its fiscal year. No rows were written.
- Review proved that clamping the boundary by one day excluded no linked journal. The explicit bounded-normalization option was added, unit tested, and recorded as a declared accounting transformation.
- The reviewed dry run then reported `READY` with no issues.
- Transactional execution imported 100 historical rows and created one journal-sequence row.
- One feed-formula owner, one missing journal period, one journal sequence, and one one-day period boundary were backfilled. No animal-mother or account-parent deferrals were needed by this dataset.
- SHA-256 digests matched for all 21 historical tables after applying the declared transformations; mismatch count was zero.
- The resulting database was `MIGRATION_MANAGED`, with all five migrations applied, none pending/unknown/failed, and all ten lifecycle data-issue checks equal to zero.
- The complete test suite ran against the adopted database with PostgreSQL integration enabled: 21 suites and 94 tests passed, with zero skipped tests.

The completed adoption report is `backups/adoption-saraya_adoption_rehearsal_20260828_e6f4-2026-08-28T12-18-16-978Z.json`. The report contains no credentials or business field values.

## Remaining production gate

This evidence is a staging rehearsal, not customer cutover approval. The original safety archive recorded `writesStopped=false`. Production must repeat backup, restore, dry run, adoption, integration tests, and smoke tests during an approved maintenance window from a manifest that records `writesStopped=true`, followed by accounting and veterinary sign-off.
