# Contributing

Contributions to OMI Identity are welcome. Because this repository implements authentication infrastructure, changes should be small, reviewable, and explicit about security and privacy consequences.

## Development

```bash
cp .env.example .env
npm install
npm run key:generate
npm run prisma:migrate:dev
npm run dev
```

Before opening a pull request:

```bash
npm run typecheck
npm run build
```

## Pull requests

Describe:

- the behavior being changed;
- schema/migration impact;
- OIDC/OAuth interoperability impact;
- security impact;
- privacy-boundary impact;
- migration/backward-compatibility considerations.

Never weaken exact redirect-URI checks, PKCE requirements, token hashing, or the central/local privacy boundary merely for convenience.

## Database changes

Every production schema change must include a Prisma schema update and a migration. Avoid destructive migrations unless a separate migration plan exists.

## Identity linking

E-mail equality alone is never sufficient to merge or link accounts. New account-linking behavior requires explicit threat-model review.

## Editorial data

Do not add manuscript, submission, journal-role, reviewer-assignment, annotation, decision, or review-state fields to this service. Those belong in local Studio/OJS/OMP systems.

## Style

- TypeScript strict mode is required.
- Prefer provider-neutral abstractions over ORCID-specific assumptions in the durable account model.
- Keep secrets and raw bearer credentials out of logs.
- Add documentation for externally observable protocol changes.
