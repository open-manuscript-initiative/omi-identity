import { prisma } from '../lib/prisma.js';

export async function claimsForUser(userId: string, scopes: Set<string>) {
  const user = await prisma.globalUser.findUnique({
    where: { id: userId },
    include: {
      emails: { orderBy: [{ isPrimary: 'desc' }, { verifiedAt: 'asc' }] },
      identities: true,
    },
  });
  if (!user) throw new Error('Global user does not exist.');

  const claims: Record<string, unknown> = {};
  if (scopes.has('profile')) {
    if (user.displayName) claims.name = user.displayName;
    claims.locale = user.preferredLanguage;
  }
  if (scopes.has('email')) {
    const email = user.emails[0];
    if (email) {
      claims.email = email.email;
      claims.email_verified = true;
    }
  }
  if (scopes.has('orcid')) {
    const orcid = user.identities.find((identity) => identity.provider === 'ORCID');
    if (orcid) claims.orcid = orcid.subject;
  }
  return claims;
}
