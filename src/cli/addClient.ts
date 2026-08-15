import { randomToken, hashClientSecret } from '../security/crypto.js';
import { prisma } from '../lib/prisma.js';

const [clientId, displayName, redirectUri, typeArg = 'confidential'] = process.argv.slice(2);

if (!clientId || !displayName || !redirectUri) {
  console.error('Usage: npm run client:add -- <client-id> <display-name> <redirect-uri> [confidential|public]');
  process.exit(1);
}

const clientType = typeArg.toLowerCase() === 'public' ? 'PUBLIC' : 'CONFIDENTIAL';
const secret = clientType === 'CONFIDENTIAL' ? randomToken(36) : undefined;

const client = await prisma.oidcClient.create({
  data: {
    clientId,
    displayName,
    clientType,
    clientSecretHash: secret ? hashClientSecret(secret) : null,
    redirectUris: [redirectUri],
  },
});

console.log(`Created OIDC client ${client.clientId} (${client.clientType}).`);
if (secret) {
  console.log('Client secret (shown once):');
  console.log(secret);
}

await prisma.$disconnect();
