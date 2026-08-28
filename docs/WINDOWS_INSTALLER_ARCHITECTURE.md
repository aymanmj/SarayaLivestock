# Windows installer architecture

## Decision

Saraya Livestock uses two independently versioned Windows artifacts:

1. **Server Setup — Inno Setup:** installs the API, PostgreSQL, Caddy, WinSW services, protected configuration, backup tooling and the LAN firewall rules on the nominated farm server.
2. **Client Setup — electron-builder/NSIS:** installs the signed Electron station application. The station contains immutable web assets and connects to the server through HTTPS.

Docker Compose remains a supported deployment option for Linux servers, staging and repeatable disaster-recovery rehearsals. It is not a workstation prerequisite and no customer farm needs Docker Desktop.

This hybrid is intentional. Inno Setup is strong at machine-wide Windows provisioning and services. electron-builder owns Electron's application layout, ASAR packaging and signing/update metadata, which avoids rebuilding those concerns in a second installer language.

## Review of the Saraya Manager reference installers

The `E:\SarayaManager\installer-build` implementation is a useful architectural reference: it separates server and client media, carries portable Node.js/PostgreSQL/Caddy, and registers long-running components through WinSW. Saraya Livestock should retain those ideas, subject to these production controls:

- Never grant `Modify` to `Authenticated Users` on application binaries, service wrappers or server configuration.
- Install immutable binaries under `%ProgramFiles%\Saraya Livestock`; store changing data under `%ProgramData%\SarayaLivestock`.
- Restrict secret configuration and PostgreSQL data to Administrators and the dedicated service identities.
- Generate independent, cryptographically random database, JWT and encryption secrets. Never write them to the installer log.
- Use Prisma's reviewed migration history and the guarded `db:migrate:safe` operation. Do not replace it with a parallel raw-schema installer script.
- Create a verified backup before every upgrade and stop writes before a schema-changing operation.
- Restrict inbound firewall rules to the Private profile and `LocalSubnet`; PostgreSQL and the API must not be exposed directly.
- Expose only Caddy on TCP 443 (and TCP 80 only where public ACME redirects/challenges require it).
- Pin and hash-verify every bundled third-party binary during release assembly.
- Fail installation when prerequisites or service health checks fail; do not report a partial install as successful.
- Sign the installer, application executable and service binaries with the organization code-signing certificate.

## Target filesystem and service model

```text
%ProgramFiles%\Saraya Livestock\
  server\                 immutable API runtime
  caddy\                  pinned Caddy executable
  postgresql\             pinned PostgreSQL executable distribution
  services\               pinned WinSW wrappers and XML definitions
  tools\                  signed administration commands

%ProgramData%\SarayaLivestock\
  config\server.env       protected server configuration and secrets
  config\client.json      default station endpoint template (not secret)
  data\postgresql\        database cluster
  data\caddy\             Caddy state and offline CA private material
  backups\                encrypted/controlled backup sets and manifests
  logs\                    operational logs with retention
```

Recommended service identities:

- `SarayaPostgreSQL`: dedicated least-privilege virtual/local service identity; owns only the database data/log locations.
- `SarayaAPI`: dedicated least-privilege identity; reads protected server configuration and writes only its assigned data/log paths.
- `SarayaCaddy`: dedicated least-privilege identity; reads web assets and writes only Caddy data/config/log paths.

The services start in dependency order: PostgreSQL, API, then Caddy. WinSW recovery policy uses delayed bounded restarts and records failures in the Windows Event Log. An installer success gate calls the API readiness endpoint through Caddy.

## TLS and offline LAN operation

Default farm installations use `https://saraya.local` and Caddy's internal CA. Runtime Internet access is not required. The server installer preserves the Caddy data directory because it contains the farm CA. The client enrollment procedure installs only the CA root certificate into the Local Machine Trusted Root store, maps `saraya.local` to the fixed server address through managed DNS (preferred) or the hosts file, then verifies the HTTPS readiness endpoint.

Public-domain installations use Caddy automatic HTTPS. Initial issuance and renewal require working public DNS, Internet access and reachable challenge ports. This is an alternative deployment profile, not a hidden dependency of offline farms.

The current release is **server-offline capable**: all stations continue working over the farm LAN when the Internet is unavailable. It is not yet a disconnected-write synchronization engine; a station cannot create durable transactions while the farm server itself is unreachable.

## Upgrade transaction

The server upgrade must run as an explicit maintenance transaction:

1. Verify publisher signature, artifact hashes, supported Windows version and available disk space.
2. Put the system in maintenance mode and stop business writes.
3. Create a PostgreSQL backup plus manifest and verify the backup is readable.
4. Stop Caddy and the API, leaving PostgreSQL available for the migration operation.
5. Stage new immutable binaries beside the current version; do not overwrite the last known-good copy.
6. Run the guarded database inspection and `db:migrate:safe` with an operator change-ticket value.
7. Start API and Caddy, then require liveness, readiness, authentication and one read-only smoke test to pass.
8. Mark the new version active. On a pre-commit failure, restore binaries and configuration. On an incompatible schema failure, follow the documented database restore procedure rather than attempting an ad-hoc down migration.

Uninstall removes services and immutable binaries only after confirmation. Customer data, backups, license identity and Caddy CA are retained by default and require a separate explicit data-removal action.

## Client release controls

- The Electron bundle is ASAR-packaged and contains the locally built web UI, including the Cairo font.
- Production disables developer tools and rejects non-HTTPS API endpoints.
- The refresh token stays in Electron `safeStorage`; it is not stored by the renderer.
- Default endpoint: `https://saraya.local/api/v1`.
- Per-station configuration may be supplied at `%ProgramData%\SarayaLivestock\client.json`:

```json
{
  "apiBaseUrl": "https://saraya.local/api/v1",
  "stationId": "MILK-RECEPTION-01",
  "farmBranch": "المزرعة الرئيسية"
}
```

- Release builds must be code-signed. Unsigned output is suitable for internal packaging tests only and must be blocked from the customer release channel.

## Release artifact set

```text
SarayaLivestock-Server-<version>-x64-Setup.exe
SarayaLivestock-Client-<version>-x64-Setup.exe
SHA256SUMS.txt
release-manifest.json
offline-ca-enrollment/README.txt
```

The release manifest records source revision, dependency lock hashes, Node/PostgreSQL/Caddy/WinSW versions, build timestamp, supported upgrade range and database migration level. CI creates the artifacts; a clean Windows VM installs, upgrades, uninstalls and executes the smoke suite before publication.
