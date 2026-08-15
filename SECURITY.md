# Security Policy

OMI Identity is authentication infrastructure. Security reports must not be filed as public GitHub issues when they contain exploit details, credentials, personal information, or a reproducible vulnerability.

## Supported versions

The project is currently pre-1.0. Security fixes are applied to the current `main` branch and the latest published release when releases exist.

## Reporting

Use GitHub's private vulnerability reporting feature for this repository when available. If private reporting is unavailable, contact the Open Manuscript Initiative maintainers through a private organizational contact channel before disclosing technical details publicly.

Please include the affected commit/version, impact, reproduction steps, and any suggested mitigation.

## Secrets

Never commit or post:

- `OIDC_SIGNING_PRIVATE_KEY_B64`;
- ORCID/OIDC/SAML client secrets;
- PostgreSQL credentials;
- generated Studio client secrets;
- session/access/authorization tokens;
- production `.env` files.

If a secret is exposed, rotate/revoke it; deleting it from the latest Git revision is not sufficient.

## Privacy-sensitive reports

Do not include manuscript, submission, reviewer-assignment, or double-blind workflow data in identity-service security reports unless absolutely necessary to explain an exposure. Redact such information wherever possible.
