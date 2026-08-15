import { randomToken, sha256 } from '../security/crypto.js';
import { env, issuer, orcidConfigured, orcidRedirectUri } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

const ORCID_ISSUER = new URL(env.ORCID_BASE_URL).origin;

export function orcidAuthorizeUrl(returnUrl: string) {
  if (!orcidConfigured()) throw new Error('ORCID is not configured.');
  const state = randomToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const save = prisma.providerOAuthState.create({
    data: {
      stateHash: sha256(state),
      provider: 'ORCID',
      returnUrl,
      expiresAt,
    },
  });
  const url = new URL('/oauth/authorize', env.ORCID_BASE_URL);
  url.searchParams.set('client_id', env.ORCID_CLIENT_ID!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', '/authenticate');
  url.searchParams.set('redirect_uri', orcidRedirectUri());
  url.searchParams.set('state', state);
  return { save, url };
}

export async function consumeOrcidCallback(code: string, state: string) {
  const record = await prisma.providerOAuthState.findUnique({ where: { stateHash: sha256(state) } });
  if (!record || record.provider !== 'ORCID' || record.expiresAt <= new Date()) {
    throw new Error('ORCID OAuth state is invalid or expired.');
  }
  await prisma.providerOAuthState.delete({ where: { id: record.id } });

  const body = new URLSearchParams({
    client_id: env.ORCID_CLIENT_ID!,
    client_secret: env.ORCID_CLIENT_SECRET!,
    grant_type: 'authorization_code',
    code,
    redirect_uri: orcidRedirectUri(),
  });
  const response = await fetch(new URL('/oauth/token', env.ORCID_BASE_URL), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`ORCID token exchange failed with HTTP ${response.status}.`);

  const orcid = normalizeOrcid(typeof payload.orcid === 'string' ? payload.orcid : undefined);
  if (!orcid) throw new Error('ORCID did not return an authenticated iD.');
  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : null;

  let identity = await prisma.globalIdentity.findUnique({
    where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
    include: { user: true },
  });

  if (!identity) {
    const user = await prisma.globalUser.create({
      data: {
        displayName: name,
        identities: {
          create: {
            provider: 'ORCID',
            issuer: ORCID_ISSUER,
            subject: orcid,
            displayName: name,
            profile: { authenticatedBy: 'orcid', source: issuer },
            lastUsedAt: new Date(),
          },
        },
      },
    });
    identity = await prisma.globalIdentity.findUniqueOrThrow({
      where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
      include: { user: true },
    });
    await prisma.auditEvent.create({ data: { userId: user.id, kind: 'account.created.orcid' } });
  } else {
    await prisma.$transaction([
      prisma.globalIdentity.update({ where: { id: identity.id }, data: { lastUsedAt: new Date(), displayName: name } }),
      prisma.globalUser.update({ where: { id: identity.userId }, data: { lastLoginAt: new Date(), ...(name && !identity.user.displayName ? { displayName: name } : {}) } }),
    ]);
  }

  return { userId: identity.userId, returnUrl: record.returnUrl };
}

function normalizeOrcid(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^https?:\/\/(?:www\.)?orcid\.org\//i, '').toUpperCase();
  return normalized && /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(normalized) ? normalized : undefined;
}
