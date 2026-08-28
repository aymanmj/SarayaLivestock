# Production deployment runbook

This runbook describes the supported production topology and its mandatory safety gates. It is not a substitute for a customer-specific backup, network and recovery plan.

## Supported topology

```text
Electron stations / browser
          |
       HTTPS 443
          |
        Caddy
          |
   /api/* -> API:4000
          |
      PostgreSQL:5432
```

Only Caddy is reachable from the customer LAN. API and PostgreSQL remain private to the server. The primary on-premises Windows delivery is described in `WINDOWS_INSTALLER_ARCHITECTURE.md`; `compose.production.yml` supplies the equivalent containerized topology for Linux, staging and recovery rehearsals.

## Preflight gates

- Use a dedicated production host with a fixed LAN address, correct time synchronization and tested UPS shutdown behavior.
- Store the protected environment file outside source control. Generate different random values for `DB_PASSWORD`, `JWT_SECRET` and `ENCRYPTION_KEY`.
- Set `CORS_ORIGINS` to the exact HTTPS origin plus `null` for the packaged Electron renderer. Wildcards are rejected in production.
- Verify a restorable backup before installing or upgrading.
- Production databases must contain the reviewed Prisma migration history through `0005_operational_idempotency`. API startup intentionally refuses unmanaged prototype databases.
- Keep Swagger and demo seed disabled.
- Do not publish ports 4000 or 5432 on the host or perimeter firewall.
- The runtime image omits development/peer tooling and explicitly removes Prisma CLI after client generation. Prisma CLI exists only in the non-serving build/operations image; keep that image inaccessible to customer traffic and track its advisory status before every release.

## Prepare the container deployment

Copy `deploy/.env.production.example` to a protected `deploy/.env.production`, replace every placeholder and choose one TLS profile. Validate without starting anything:

```powershell
docker compose --env-file deploy/.env.production -f compose.production.yml config --quiet
```

Build on an Internet-connected release machine from an approved source revision, scan and export the images. An offline farm imports those prebuilt artifacts; it does not install dependencies or download images during deployment.

## Create or upgrade the database

Start PostgreSQL only:

```powershell
docker compose --env-file deploy/.env.production -f compose.production.yml up -d postgres
```

For a blank database, configure the maintenance confirmation variables in the protected environment file and run the guarded operation:

```powershell
docker compose --env-file deploy/.env.production -f compose.production.yml --profile operations run --rm db-ops npm run db:migrate:safe
```

For an upgrade, first stop writes and obtain a verified backup. Set `SARAYA_DB_WRITES_STOPPED=true`, `SARAYA_DB_ALLOW_PRODUCTION=true`, `SARAYA_DB_CONFIRM` to the exact database name, and a non-empty `SARAYA_DB_CHANGE_TICKET`. Run `db:inspect`, then `db:migrate:safe`. Return the maintenance switches to `false` immediately afterward.

Never point this procedure at the unmanaged prototype database. Restore a copy into staging and follow `PROTOTYPE_ADOPTION.md` to migrate the data into a fresh managed target.

## Start and verify the application

```powershell
docker compose --env-file deploy/.env.production -f compose.production.yml up -d
docker compose --env-file deploy/.env.production -f compose.production.yml ps
```

Required probes:

- `GET https://<host>/api/v1/system/health/live` returns HTTP 200 and `status: ok`.
- `GET https://<host>/api/v1/system/health/ready` returns HTTP 200, `status: ready`, database connectivity and required migration `0005_operational_idempotency`.
- An anonymous protected API call returns 401.
- A licensed test account can sign in and perform a read-only tenant-scoped query.

Do not use the liveness endpoint to route traffic. Readiness is the traffic gate because it verifies the database and schema.

## Offline TLS profile

Use these protected environment values:

```text
CADDYFILE=./deploy/caddy/Caddyfile.offline
SARAYA_OFFLINE_HOST=saraya.local
CORS_ORIGINS=https://saraya.local,null
```

After first startup, securely export the Caddy local root certificate from the `caddy_data` volume. Preserve the entire volume in the server recovery plan: its private CA key is sensitive, while loss of the CA state forces certificate re-enrollment on every station.

Install only the root certificate on each authorized client in the Local Machine Trusted Root Certification Authorities store. Configure the customer DNS so `saraya.local` resolves to the fixed server address. A hosts-file entry is acceptable for small isolated installations but is operationally harder to maintain. Verify certificate subject, issuer, validity and HTTPS readiness before installing the desktop application.

No external font, script, stylesheet or API is required by the web interface; the Cairo font is packaged locally. Internet loss does not interrupt operation while the server and LAN remain available.

## Public automatic HTTPS profile

Use:

```text
CADDYFILE=./deploy/caddy/Caddyfile.online
SARAYA_DOMAIN=saraya.example.com
ACME_EMAIL=ops@example.com
CORS_ORIGINS=https://saraya.example.com,null
```

Public DNS must resolve to the server, and the selected ACME challenge must remain reachable for issuance and renewal. Back up `caddy_data`; do not delete it during routine redeployment.

## Backups and recovery

- Schedule database backups to storage independent of the application disk.
- Encrypt off-host copies and test restoration on a clean staging host.
- Back up the protected configuration, license identity and Caddy state separately from PostgreSQL.
- Record recovery-time and recovery-point objectives per customer.
- Execute restore and power-interruption drills before the pilot and on a recurring schedule.

Application containers are replaceable. PostgreSQL data, backups, protected configuration, license identity and Caddy PKI are customer state and must never be removed by an ordinary update.

## Stop and maintenance

```powershell
docker compose --env-file deploy/.env.production -f compose.production.yml stop caddy api
```

Use `down` only when the operational effect is understood. Never add `--volumes` to routine stop, upgrade or rollback commands.

## Current boundary

This foundation is ready for staging installation and failure testing, not yet for general availability. Remaining release gates include clean-Windows installer automation, code signing, end-to-end domain workflows, CI artifact provenance, restore/power-loss drills and the supervised customer pilot in `PRODUCTION_ROADMAP.md`.

Current explicit release blockers:

- The Windows server Inno Setup artifact has not yet been implemented for Saraya Livestock.
- The client NSIS artifact is structurally verified but unsigned and still uses Electron's default icon.
- Prisma CLI's current stable toolchain contains a high-severity `deepmerge-ts` advisory. The CLI and affected packages are explicitly removed from the serving API runtime tree, but the isolated operations/build image must remain access-controlled and the advisory must be re-evaluated before release.
- Clean-VM install/upgrade/uninstall, code-signature and power-interruption tests are not yet automated.
