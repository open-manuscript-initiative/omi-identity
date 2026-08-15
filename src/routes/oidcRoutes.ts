import { Router, type Request, type Response } from 'express';

import { env, issuer, orcidConfigured } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { claimsForUser } from '../oidc/claims.js';
import { jwks, signIdToken } from '../oidc/signing.js';
import { authenticatedUser } from '../security/session.js';
import { pkceS256, randomToken, sha256, verifyClientSecret } from '../security/crypto.js';

export const oidcRouter = Router();

const supportedScopes = new Set(['openid', 'profile', 'email', 'orcid']);

oidcRouter.get('/.well-known/openid-configuration', (_request, response) => {
  response.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: [...supportedScopes],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    claims_supported: ['sub', 'name', 'locale', 'email', 'email_verified', 'orcid'],
  });
});

oidcRouter.get('/.well-known/jwks.json', async (_request, response, next) => {
  try {
    response.json(await jwks());
  } catch (error) {
    next(error);
  }
});

oidcRouter.get('/oauth/authorize', async (request, response, next) => {
  try {
    const input = authorizationRequest(request);
    const client = await activeClient(input.clientId);
    if (!client || !redirectAllowed(client.redirectUris, input.redirectUri)) {
      response.status(400).json({ error: 'invalid_request', error_description: 'Unknown client or redirect URI.' });
      return;
    }
    const user = await authenticatedUser(request);
    if (!user) {
      if (!orcidConfigured()) {
        response.status(503).json({ error: 'login_required', error_description: 'No upstream identity provider is configured.' });
        return;
      }
      const returnTo = request.originalUrl;
      response.redirect(302, `/auth/orcid/start?return_to=${encodeURIComponent(returnTo)}`);
      return;
    }

    const code = randomToken();
    await prisma.authorizationCode.create({
      data: {
        codeHash: sha256(code),
        userId: user.id,
        clientId: client.clientId,
        redirectUri: input.redirectUri,
        scope: input.scope,
        nonce: input.nonce,
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: 'S256',
        expiresAt: new Date(Date.now() + env.OIDC_AUTHORIZATION_CODE_TTL_SECONDS * 1000),
      },
    });

    const redirect = new URL(input.redirectUri);
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', input.state);
    response.redirect(302, redirect.toString());
  } catch (error) {
    next(error);
  }
});

oidcRouter.post('/oauth/token', async (request, response, next) => {
  try {
    if (request.body?.grant_type !== 'authorization_code') {
      tokenError(response, 'unsupported_grant_type');
      return;
    }
    const code = stringBody(request, 'code');
    const redirectUri = stringBody(request, 'redirect_uri');
    const verifier = stringBody(request, 'code_verifier');
    const credentials = clientCredentials(request);
    if (!code || !redirectUri || !verifier || !credentials.clientId) {
      tokenError(response, 'invalid_request');
      return;
    }

    const client = await activeClient(credentials.clientId);
    if (!client || !clientAuthenticated(client, credentials.clientSecret)) {
      tokenError(response, 'invalid_client', 401);
      return;
    }

    const authorization = await prisma.authorizationCode.findUnique({
      where: { codeHash: sha256(code) },
    });
    if (
      !authorization ||
      authorization.clientId !== client.clientId ||
      authorization.redirectUri !== redirectUri ||
      authorization.expiresAt <= new Date() ||
      authorization.usedAt
    ) {
      tokenError(response, 'invalid_grant');
      return;
    }
    if (pkceS256(verifier) !== authorization.codeChallenge) {
      tokenError(response, 'invalid_grant');
      return;
    }

    const consumed = await prisma.authorizationCode.updateMany({
      where: { id: authorization.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      tokenError(response, 'invalid_grant');
      return;
    }

    const scopeSet = new Set(authorization.scope.split(/\s+/).filter(Boolean));
    const profileClaims = await claimsForUser(authorization.userId, scopeSet);
    const idToken = await signIdToken({
      subject: authorization.userId,
      audience: client.clientId,
      ...(authorization.nonce ? { nonce: authorization.nonce } : {}),
      claims: profileClaims,
      ttlSeconds: env.OIDC_ID_TOKEN_TTL_SECONDS,
    });
    const accessToken = randomToken();
    await prisma.accessToken.create({
      data: {
        tokenHash: sha256(accessToken),
        userId: authorization.userId,
        clientId: client.clientId,
        scope: authorization.scope,
        expiresAt: new Date(Date.now() + env.OIDC_ACCESS_TOKEN_TTL_SECONDS * 1000),
      },
    });

    response.setHeader('Cache-Control', 'no-store');
    response.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: env.OIDC_ACCESS_TOKEN_TTL_SECONDS,
      id_token: idToken,
      scope: authorization.scope,
    });
  } catch (error) {
    next(error);
  }
});

oidcRouter.get('/userinfo', async (request, response) => {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    response.status(401).json({ error: 'invalid_token' });
    return;
  }
  const access = await prisma.accessToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!access || access.expiresAt <= new Date()) {
    response.status(401).json({ error: 'invalid_token' });
    return;
  }
  const scopes = new Set(access.scope.split(/\s+/).filter(Boolean));
  response.json({ sub: access.userId, ...(await claimsForUser(access.userId, scopes)) });
});

function authorizationRequest(request: Request) {
  const responseType = query(request, 'response_type');
  const clientId = query(request, 'client_id');
  const redirectUri = query(request, 'redirect_uri');
  const scope = query(request, 'scope');
  const state = query(request, 'state');
  const nonce = query(request, 'nonce');
  const codeChallenge = query(request, 'code_challenge');
  const method = query(request, 'code_challenge_method');
  const scopeSet = new Set(scope.split(/\s+/).filter(Boolean));
  if (
    responseType !== 'code' || !clientId || !redirectUri || !state || !nonce || !codeChallenge || method !== 'S256' ||
    !scopeSet.has('openid') || [...scopeSet].some((item) => !supportedScopes.has(item))
  ) throw new Error('Invalid OIDC authorization request.');
  return { clientId, redirectUri, scope: [...scopeSet].join(' '), state, nonce, codeChallenge };
}

async function activeClient(clientId: string) {
  return prisma.oidcClient.findFirst({ where: { clientId, status: 'ACTIVE' } });
}

function redirectAllowed(value: unknown, redirectUri: string): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') && value.includes(redirectUri);
}

function clientCredentials(request: Request): { clientId?: string; clientSecret?: string } {
  const header = request.headers.authorization;
  if (header?.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator >= 0) {
      return {
        clientId: decodeURIComponent(decoded.slice(0, separator)),
        clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
      };
    }
  }
  const clientId = stringBody(request, 'client_id');
  const clientSecret = stringBody(request, 'client_secret');
  return {
    ...(clientId ? { clientId } : {}),
    ...(clientSecret ? { clientSecret } : {}),
  };
}

function clientAuthenticated(client: { clientType: string; clientSecretHash: string | null }, secret: string | undefined) {
  if (client.clientType === 'PUBLIC') return true;
  return Boolean(secret && client.clientSecretHash && verifyClientSecret(secret, client.clientSecretHash));
}

function query(request: Request, name: string): string {
  const value = request.query[name];
  return typeof value === 'string' ? value.trim() : '';
}

function stringBody(request: Request, name: string): string {
  const value = request.body?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

function tokenError(response: Response, error: string, status = 400) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(status).json({ error });
}
