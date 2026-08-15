# Privacy Boundary

This document is normative for OMI Identity.

## Principle

OMI Identity authenticates people. It does **not** model scholarly workflow relationships.

A compromise of the central identity service must not reveal who reviewed which manuscript, which editor handled a submission, or how a review proceeded.

## Data the central service may store

- immutable global OMI user UUID;
- linked authentication identities (`provider`, `issuer`, `subject`);
- verified e-mail addresses;
- display name and optional portable profile fields;
- preferred interface language;
- authentication sessions and security/audit metadata;
- registered OIDC clients and exact redirect URIs;
- short-lived OAuth/OIDC protocol state.

## Data the central service must not store

- manuscript, submission, publication, issue, or galley identifiers;
- journal-specific or publisher-specific roles;
- reviewer assignment identifiers;
- assignment type (scientific review, language review, translation, editorial revision);
- whether a user is a reviewer, translator, language editor, author, or editor for a specific object;
- anonymity mode or double-blind relationships;
- review round, status, recommendation, text, comments, annotations, decisions, deadlines, or revision state;
- manuscript titles or abstracts when supplied merely to support login;
- OJS/OMP submission identifiers in OAuth `state`, `nonce`, `scope`, `login_hint`, or custom identity claims.

## Invitation rule

A Studio may redirect an invited person to OMI Identity, but the request must be generic. OMI Identity returns only identity. The local Studio binds that identity to its private pending invitation and assignment.

The opaque local invitation reference must stay local. Do not make it a central account attribute.

## Claims rule

OIDC claims are limited to identity/profile information. Current permitted custom claim:

- `orcid`

Standard profile/e-mail claims are permitted when the corresponding scopes are granted. Editorial claims are prohibited even if a client requests them.

## E-mail rule

Matching e-mail addresses do not prove account identity and must not automatically merge accounts. Account linking requires authentication of the existing account and the new provider, or a separately specified recovery procedure.

## Logging rule

HTTP access logs and security audit events must be reviewed to ensure that clients cannot smuggle editorial identifiers into centrally retained query parameters or metadata. Unknown/custom scopes must be rejected.
