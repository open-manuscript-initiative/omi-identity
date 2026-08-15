# Deployment

## Recommended production topology

```text
Internet
  |
HTTPS reverse proxy (nginx/Plesk)
  |
127.0.0.1:3010 omi-identity Node service
  |
PostgreSQL
```

Use a dedicated host such as `identity.openmanuscript.org`. `PUBLIC_ORIGIN` must exactly match the external HTTPS issuer URL and must not include a trailing slash.

## Database

Create a dedicated PostgreSQL database and role. Configure `DATABASE_URL`, then apply migrations:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run build
```

Do not reuse the Studio database account.

## Signing key

Generate an RSA key locally on the server:

```bash
npm run key:generate
```

Store the emitted base64 value in the service environment as `OIDC_SIGNING_PRIVATE_KEY_B64`. Never put the private key in Git, deployment logs, screenshots, or client configuration.

The public key is derived automatically and exposed through JWKS.

## ORCID

Configure ORCID only on the central identity service:

```env
ORCID_CLIENT_ID=APP-...
ORCID_CLIENT_SECRET=...
ORCID_BASE_URL=https://orcid.org
ORCID_REDIRECT_URI=https://identity.openmanuscript.org/auth/orcid/callback
```

The callback URI registered at ORCID must exactly match `ORCID_REDIRECT_URI`.

## Studio client

After deployment, provision each Studio installation separately:

```bash
npm run client:add -- \
  <client-id> \
  "<display name>" \
  https://studio.example.org/api/auth/omi/callback \
  confidential
```

Record the generated secret once in that Studio server's environment. Do not store it centrally in plaintext after provisioning; OMI Identity keeps only a hash.

## Reverse proxy

Proxy all identity paths to the Node service and preserve the original host/protocol. Do not cache `/oauth/*`, `/auth/*`, or `/userinfo`. The discovery document and JWKS may be cached briefly, but key-rotation policy must be considered first.

Example nginx fragment:

```nginx
location / {
    proxy_pass http://127.0.0.1:3010;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## systemd

Run the service as an unprivileged dedicated system user. The working directory should be the deployed repository/build directory and the environment file should be readable only by that account and administrators.

Typical command:

```text
ExecStart=/usr/bin/node /path/to/omi-identity/dist/server.js
```

Use `Restart=on-failure` and a normal shutdown timeout.

## Health check

```text
GET /healthz
```

returns HTTP 200 while the process is running. A later hardening step should add a separate readiness check that verifies database access without leaking database details.

## Backups

Back up the PostgreSQL database and the active signing key securely. Loss of the signing key prevents continuity of token signing; exposure of the key requires immediate rotation.
