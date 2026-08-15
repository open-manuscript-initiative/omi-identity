import { createPrivateKey, createPublicKey } from 'node:crypto';

import {
  SignJWT,
  calculateJwkThumbprint,
  exportJWK,
  importPKCS8,
  importSPKI,
  type JWK,
} from 'jose';

import { env, issuer } from '../config/env.js';

const algorithm = 'RS256';

let cached: Promise<{
  privateKey: CryptoKey;
  publicJwk: JWK & { kid: string; use: 'sig'; alg: 'RS256' };
}> | undefined;

async function keys() {
  cached ??= loadKeys();
  return cached;
}

async function loadKeys() {
  const privatePem = Buffer.from(env.OIDC_SIGNING_PRIVATE_KEY_B64, 'base64').toString('utf8');
  const privateObject = createPrivateKey(privatePem);
  const publicPem = createPublicKey(privateObject).export({ type: 'spki', format: 'pem' }).toString();
  const privateKey = await importPKCS8(privatePem, algorithm);
  const publicKey = await importSPKI(publicPem, algorithm);
  const bareJwk = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(bareJwk);
  return {
    privateKey,
    publicJwk: { ...bareJwk, kid, use: 'sig' as const, alg: algorithm as 'RS256' },
  };
}

export async function jwks() {
  const { publicJwk } = await keys();
  return { keys: [publicJwk] };
}

export async function signIdToken(input: {
  subject: string;
  audience: string;
  nonce?: string;
  claims: Record<string, unknown>;
  ttlSeconds: number;
}) {
  const { privateKey, publicJwk } = await keys();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...input.claims,
    ...(input.nonce ? { nonce: input.nonce } : {}),
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm, typ: 'JWT', kid: publicJwk.kid })
    .setIssuer(issuer)
    .setSubject(input.subject)
    .setAudience(input.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + input.ttlSeconds)
    .sign(privateKey);
}
