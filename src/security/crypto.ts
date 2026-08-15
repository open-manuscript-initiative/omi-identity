import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function pkceS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function hashClientSecret(secret: string): string {
  const salt = randomBytes(16).toString('base64url');
  const digest = scryptSync(secret, salt, 32).toString('base64url');
  return `scrypt$${salt}$${digest}`;
}

export function verifyClientSecret(secret: string, encoded: string): boolean {
  const [scheme, salt, expected] = encoded.split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = scryptSync(secret, salt, 32);
  const expectedBytes = Buffer.from(expected, 'base64url');
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes);
}
