# OMI Identity

Central federated identity and authentication service for the **Open Manuscript Initiative (OMI)** ecosystem.

OMI Identity gives a person one portable OMI account across independent Open Manuscript Studio installations while keeping manuscripts, editorial roles, peer-review assignments, annotations, decisions, and journal permissions local to each installation.

## Design principle

**Central identity, local authorization.**

The service stores only the minimum information needed to authenticate a person and project a portable scholarly profile. A Studio installation remains the authority for every manuscript-level permission and workflow relationship.

```text
ORCID / institutional OIDC / SAML
               |
               v
        OMI Identity Service
        global OMI user UUID
        linked identities
        verified e-mail(s)
        portable profile
               |
              OIDC
       +-------+-------+
       |               |
   Studio A         Studio B
   local roles      local roles
   manuscripts      manuscripts
   reviews          reviews
```

The immutable OMI UUID is the account identifier. ORCID is a linked, authenticated scholarly identity, not the database primary key.

## Current implementation

The initial service implements the first production-oriented foundation:

- PostgreSQL + Prisma global account store;
- upstream ORCID OAuth authentication (`/authenticate`);
- OpenID Connect Authorization Code flow;
- mandatory PKCE `S256` for authorization requests;
- signed RS256 ID tokens;
- OIDC discovery and JWKS endpoints;
- opaque access tokens and `/userinfo`;
- exact redirect-URI validation;
- confidential and public OIDC clients;
- hashed authorization codes, sessions, OAuth state, access tokens, and client secrets;
- privacy-safe claims: `sub`, `name`, `locale`, `email`, `email_verified`, and `orcid` only;
- administrative CLI for registering Studio clients.

Institutional OIDC/SAML upstream providers, consent/account management UI, e-mail verification, recovery, account linking UI, and signing-key rotation are planned follow-up work.

## Privacy boundary

OMI Identity **must never receive or store** manuscript IDs, submission IDs, journal roles, assignment types, reviewer relationships, review states, review text, annotations, recommendations, editorial decisions, or double-blind identity mappings.

See [docs/privacy-boundary.md](docs/privacy-boundary.md) for the normative boundary.

## Requirements

- Node.js 22+
- PostgreSQL
- an RSA signing key
- ORCID OAuth client credentials when ORCID login is enabled

## Development setup

```bash
cp .env.example .env
npm install
npm run key:generate
```

Place the generated value in `OIDC_SIGNING_PRIVATE_KEY_B64`, configure `DATABASE_URL`, then run:

```bash
npm run prisma:migrate:dev
npm run dev
```

The development service defaults to `http://localhost:3010`.

## OIDC endpoints

```text
GET  /.well-known/openid-configuration
GET  /.well-known/jwks.json
GET  /oauth/authorize
POST /oauth/token
GET  /userinfo
```

The first upstream authentication provider exposes:

```text
GET /auth/orcid/start
GET /auth/orcid/callback
```

## Registering a Studio client

After the database has been migrated:

```bash
npm run client:add -- \
  omi-studio-production \
  "Open Manuscript Studio" \
  https://studio.openmanuscript.org/api/auth/omi/callback \
  confidential
```

For a confidential client, the secret is displayed **once**. Store it in the Studio server configuration and do not commit it.

A Studio installation should then use:

```env
OMI_IDENTITY_ISSUER=https://identity.openmanuscript.org
OMI_IDENTITY_CLIENT_ID=omi-studio-production
OMI_IDENTITY_CLIENT_SECRET=...
OMI_IDENTITY_REDIRECT_URI=https://studio.openmanuscript.org/api/auth/omi/callback
```

## ORCID configuration

ORCID credentials belong here centrally, not on each Studio installation:

```env
ORCID_CLIENT_ID=APP-...
ORCID_CLIENT_SECRET=...
ORCID_BASE_URL=https://orcid.org
ORCID_REDIRECT_URI=https://identity.openmanuscript.org/auth/orcid/callback
```

For development, the ORCID sandbox can be used by changing `ORCID_BASE_URL` and registering the matching callback URL.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).

Private signing keys, OAuth client secrets, database credentials, and environment files must never be committed.

## Documentation

- [Architecture](docs/architecture.md)
- [Privacy boundary](docs/privacy-boundary.md)
- [Deployment](docs/deployment.md)
- [Contributing](CONTRIBUTING.md)

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).
