# Session security operating model

Saraya issues a short-lived JWT access token bound to a server-side `user_sessions` row through its `sid` claim. Every authenticated API request verifies that the session still exists, has not been revoked, has not expired, and belongs to an active user. Logout, password reset, role changes and account deactivation therefore invalidate access immediately rather than waiting for JWT expiry.

Refresh tokens are 256-bit opaque random values. PostgreSQL stores only their SHA-256 hashes. Each successful refresh creates a new session row and revokes the predecessor. Reuse of a rotated predecessor is treated as token theft and revokes the complete token family before returning 401.

Browser clients receive the refresh token only as an HTTP-only, SameSite=Strict cookie and keep the access token in memory. The Electron client receives the refresh token through its explicitly identified desktop channel and stores it with Electron `safeStorage`; renderer `sessionStorage` and `localStorage` are not used for authentication secrets.

## Operational requirements

- Serve browser deployments over HTTPS and keep `NODE_ENV=production` so the refresh cookie is marked Secure.
- Set `JWT_EXPIRATION` to a short interval (15 minutes is the current baseline).
- Set `REFRESH_TOKEN_TTL_DAYS` between 1 and 90 days; the default is 30.
- Follow `docs/SECRET_ROTATION.md` for durable Vault rotation or environment-based maintenance rotation; changing `JWT_SECRET` intentionally invalidates all access JWTs.
- Alert on `identity.session.reuse-detected` audit events and investigate the affected account and endpoint devices.
- Periodically delete expired/revoked session rows according to the approved retention policy; audit evidence remains append-only.
