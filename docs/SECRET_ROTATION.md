# Secret rotation operating model

Saraya resolves the active `JWT_SECRET` through `VaultService` whenever it signs a new access token and through Passport's dynamic key provider whenever it verifies one. A successful runtime rotation therefore changes real signing and verification behavior; it is not an in-memory status-only operation.

## Durable Vault rotation

Runtime rotation is available only when `VAULT_ADDR` and `VAULT_TOKEN` connect successfully to a HashiCorp Vault KV-v2 engine. Saraya reads and writes these paths:

```text
secret/data/saraya-livestock/JWT_SECRET
secret/data/saraya-livestock/ENCRYPTION_KEY
```

The `POST /api/v1/security/rotate-secret` endpoint currently accepts only `JWT_SECRET`. It generates 256 random bits, writes the new value to Vault, checks the HTTP result, and activates the value in memory only after Vault confirms the durable write. A rejected or unreachable Vault leaves the current active secret unchanged.

JWT rotation invalidates existing access JWT signatures immediately. The server-side refresh sessions remain valid, so trusted clients can obtain an access token signed with the new key. Schedule rotation during a maintenance window and expect one transparent refresh cycle per connected client.

The current customer deployment baseline is one API process per installation. A future multi-replica deployment must add coordinated key-ring propagation (including `kid` and previous-key overlap) before enabling live rotation across replicas.

## Environment fallback

When Vault is unavailable, Saraya reads secrets from environment variables but disables the runtime rotation action. Operators must update `JWT_SECRET` in the deployment secret store and restart the API during a planned maintenance event. The UI reports this state explicitly and never claims that a transient local change was persisted.

## Encryption key

`ENCRYPTION_KEY` runtime rotation is intentionally blocked. Existing AES-256-GCM ciphertext does not yet carry a durable key version, so replacing the key could make older data unreadable. Rotation may be enabled only after versioned ciphertext, old-key retrieval, re-encryption tooling, backup, and rollback verification are implemented.

Never log or return a secret value. The security API exposes metadata only: key name, version, source, last-rotation time, and whether safe rotation is currently available.
