import type { Request, Response } from 'express';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { randomToken, sha256 } from './crypto.js';

const COOKIE_NAME = 'omi_identity_session';

export async function createIdentitySession(userId: string, response: Response) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + env.IDENTITY_SESSION_TTL_HOURS * 60 * 60 * 1000);
  await prisma.identitySession.create({
    data: { userId, tokenHash: sha256(token), expiresAt },
  });
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

export async function authenticatedUser(request: Request) {
  const token = cookie(request.headers.cookie, COOKIE_NAME);
  if (!token) return null;
  const session = await prisma.identitySession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return null;
  await prisma.identitySession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => undefined);
  return session.user;
}

function cookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
