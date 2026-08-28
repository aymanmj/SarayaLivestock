# OpenAPI contract and generated web client

The API source code is the single source of truth for HTTP paths, parameters and request bodies. Nest's Swagger compiler plugin derives schemas from DTO classes and `class-validator` metadata during the API build.

## Generated artifacts

- `openapi/saraya.openapi.json` is the reviewed server contract.
- `apps/web/src/api/generated/schema.ts` is generated and must never be edited manually.
- `apps/web/src/api/client.ts` owns authentication refresh, durable idempotency keys, error normalization and the configured API origin.
- Feature code calls `generatedApiClient`; direct `fetch` and `apiFetch` calls outside the transport are rejected by the CI boundary check.

Run both generators after any controller, DTO, route, parameter or response-contract change:

```text
npm run contracts:generate
```

Verify that committed artifacts are current and contract invariants still hold:

```text
npm run contracts:check
```

The check builds the API with the Swagger compiler plugin, compares the server document byte-for-byte, verifies unique operation IDs, verifies all 19 idempotency headers, requires named success response DTOs for all 58 operations, rejects empty component schemas, protects decimal serialization, compares the generated TypeScript file and scans the web application for transport bypasses. Contract generation runs in Nest metadata preview mode and therefore does not require PostgreSQL, Vault, or license storage to be reachable.

## Idempotency ownership

`Idempotency-Key` remains required in the public server contract. The web-specific generator removes that parameter only from feature-facing TypeScript because the transport creates and persists the key centrally. This prevents screens from generating short-lived keys that would fail after a power or network interruption.

## Deployment configuration

`VITE_API_BASE_URL` must contain the full versioned base URL, for example `https://saraya-api.example.com/api/v1`. HTTPS is mandatory for customer browser deployments. The default `http://localhost:4000/api/v1` is for local web and Electron development only.

## Response schemas

Request contracts are generated and enforced. Every successful API operation now exposes a named response DTO, including authentication, administration, audit, licensing, security, fattening, nested records and polymorphic report exports. PostgreSQL decimal values are intentionally documented as JSON strings wherever Prisma emits that representation at the HTTP boundary.

The web client consumes the generated response types directly and no longer contains the legacy response compatibility overload. The milking UI also treats the server response as authoritative for withdrawal-lock decisions, so stale browser state cannot add quarantined milk to the usable tank balance.
