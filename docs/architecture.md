# Architecture

## Purpose

OMI Identity is the global authentication layer for the Open Manuscript Initiative. It issues a stable OMI UUID to relying-party applications while deliberately remaining outside manuscript and editorial workflow state.

## Trust model

External providers authenticate a person to OMI Identity. OMI Identity then acts as an OpenID Connect Provider for Studio installations.

```text
ORCID / institutional IdP
          |
          v
    OMI Identity
          |
      OIDC + PKCE
          |
          v
    Studio installation
```

A Studio installation trusts the OMI issuer, verifies signed ID tokens against the published JWKS, validates audience/nonce/state, and maps `sub` to its local user projection.

## Global account

`GlobalUser.id` is an immutable UUID and is the OIDC `sub`. It does not encode provider, institution, journal, role, or workflow information.

A user may have multiple `GlobalIdentity` rows. Provider tuples are unique by `(provider, issuer, subject)`. E-mail equality is not an account-linking rule.

## OIDC provider

The first release provides Authorization Code flow with mandatory PKCE S256. Authorization codes are random opaque values stored only as SHA-256 hashes and are single-use. Access tokens are also opaque and stored as hashes.

ID tokens are signed with RS256. The public key is exposed through JWKS. The private key is supplied at runtime and must not be committed.

Supported scopes are deliberately narrow:

- `openid`
- `profile`
- `email`
- `orcid`

No editorial scope exists.

## Upstream providers

ORCID is the first upstream provider and uses `/authenticate`. ORCID is not the OMI primary key. Future institutional OIDC and SAML providers should map into the same `GlobalIdentity` abstraction.

## Local Studio projection

Studio keeps its own local user and authorization records. A future local user projection should hold an `omiUserId` plus cached display/profile information. Local roles and assignments continue to reference local IDs.

This allows an existing authenticated Studio session to continue during a temporary central identity outage, while new sign-ins remain unavailable until OMI Identity recovers.

## Client registry

Studio installations are provisioned as `OidcClient` records. Redirect URI matching is exact. Confidential clients store only a scrypt hash of their client secret. Public clients still require PKCE.

Dynamic client registration is intentionally out of scope for the first release.

## Key rotation

The initial implementation loads one RSA private key and publishes one JWKS key. Production key rotation is a required follow-up: new keys must overlap old public keys for at least the maximum lifetime of already-issued ID tokens.

## Audit policy

Audit events may describe identity-security actions such as account creation, login, provider linking, or administrative client changes. Audit payloads must obey the privacy boundary and must never contain manuscript/workflow identifiers.
