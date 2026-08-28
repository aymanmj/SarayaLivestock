# Database migration, backup, and restore runbook

Saraya Livestock uses reviewed Prisma migrations for staging and production. `prisma db push` is restricted to disposable development databases. The guarded lifecycle command classifies a target before any change as `EMPTY`, `PROTOTYPE_UNMANAGED`, or `MIGRATION_MANAGED`.

The command never prints database passwords, passes `PGPASSWORD` through the child-process environment, uses custom-format PostgreSQL archives, creates SHA-256 manifests, and refuses destructive restore targets.

## Tools and compatibility

Install PostgreSQL client tools matching the database server major version. `pg_dump` must be the same major version as the server or newer; the lifecycle command rejects an older binary. Configure `PG_DUMP_PATH` and `PG_RESTORE_PATH` when they are not available on `PATH`.

On Windows the command also checks the standard `C:\Program Files\PostgreSQL\<server-major>\bin` location after rejecting an incompatible tool found on `PATH`.

Run read-only classification first:

```text
cd apps/api
npm run db:inspect
```

The preflight reports pending, failed, and unknown migrations plus duplicate operational keys, cross-farm formula ingredients, orphan journal lines, and accounting total mismatches.

## Verified backup

For a migration backup, stop API and desktop writes first, then explicitly record that maintenance state:

```text
set SARAYA_DB_WRITES_STOPPED=true
cd apps/api
npm run db:backup
```

Linux shells use `export` instead of `set`. The command produces three files under `backups/`: a `.dump` archive, a business-data snapshot, and a `.manifest.json` containing the archive SHA-256. A backup is not considered migration-ready unless its manifest records that writes were stopped.

Verify an archive again at any time:

```text
npm run db:verify-backup -- E:\SarayaLivestock\backups\<backup>.manifest.json
```

## Restore rehearsal

Create a new, empty database whose name contains `staging`, `restore`, `rehearsal`, or `test`. Never reuse the source database. Configure the target separately and confirm its exact database name:

```text
set SARAYA_DB_ENV=staging
set RESTORE_DATABASE_URL=postgresql://operator:password@host:5432/saraya_restore?schema=public
set SARAYA_DB_CONFIRM=saraya_restore
npm run db:restore:staging -- E:\SarayaLivestock\backups\<backup>.manifest.json
```

When source and restore target use the same PostgreSQL server and credentials, set `RESTORE_DATABASE_NAME=saraya_restore` instead of placing a second URL in the environment.

Restore is rejected unless the target contains no public tables at all. After restore, the command creates a new snapshot and reports whether the database is managed or an unmanaged prototype.

## Empty installation or managed upgrade

The safe deploy wrapper is the only approved migration entry point for staging and production:

```text
set SARAYA_DB_ENV=staging
set SARAYA_DB_CONFIRM=saraya_staging
set SARAYA_DB_WRITES_STOPPED=true
set MIGRATION_DATABASE_NAME=saraya_staging
npm run db:migrate:safe -- E:\SarayaLivestock\backups\<backup>.manifest.json
```

`MIGRATION_DATABASE_NAME` safely reuses the source server credentials while selecting a different database. For a different server, configure `MIGRATION_DATABASE_URL` instead. Omit the manifest argument only when the selected target is empty.

An empty database does not require a manifest argument. A non-empty managed database requires a verified backup created within 24 hours for the same host, port, and database while writes were stopped. The wrapper also confirms that data has not changed since backup, runs `prisma migrate deploy`, and reconciles row counts, milk totals, feed stock, and journal totals afterward.

Production additionally requires:

```text
set SARAYA_DB_ALLOW_PRODUCTION=true
set SARAYA_DB_CHANGE_TICKET=CHG-0000
```

These variables are guardrails, not substitutes for approval and a maintenance window.

## Existing prototype database

The current baseline migration creates the complete schema. It must not be marked as applied blindly over a prototype database that already contains tables. `db:migrate:safe` blocks this state deliberately.

The approved adoption sequence is:

1. Stop writes and create a verified backup.
2. Restore that backup into an isolated staging database and retain it as the immutable source copy.
3. Resolve every preflight issue and document any rejected row.
4. Create a separate empty staging database and apply all migrations from zero.
5. Export validated business rows from the restored prototype and import them through a reviewed, transactional adoption tool into the fresh schema.
6. Reconcile row counts, milk and feed quantities, journal totals, organization/farm ownership, and journal sequences.
7. Run API integration and smoke tests against the adopted database.
8. Repeat the complete procedure from the original backup before approving production cutover.

The implemented commands, strict rejection rules, reviewed transformations, and cutover gates are documented in `docs/PROTOTYPE_ADOPTION.md`:

```text
npm run db:adopt:dry-run
npm run db:adopt:execute
```

No baseline resolve operation is authorized until a schema-by-schema equivalence report proves that the existing database is identical to the baseline.

## Rollback and forward-fix policy

Before customer traffic resumes, rollback means abandoning the upgraded database, restoring the verified pre-upgrade archive into a new empty database, validating it, and switching the deployment connection back during the maintenance window. Never restore over the failed database and never improvise a down migration.

After customer writes resume, prefer a reviewed forward-fix migration. Restoring an older backup would discard new records and requires explicit incident approval plus reconciliation of the recovery-point gap.

Record archive hash, source and target identifiers, start/end times, migration names, operator, change ticket, reconciliation results, RTO, and observed RPO in the release evidence.

Production startup must never run `migrate dev`, `db push`, or automatic migrations. The append-only audit and posted-journal triggers may be changed only by a separately reviewed maintenance migration.

The isolated lifecycle and adoption rehearsals and their remaining production limitation are recorded in `docs/DATABASE_REHEARSAL_2026-08-28.md`.
