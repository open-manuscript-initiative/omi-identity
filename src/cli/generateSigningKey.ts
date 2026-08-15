import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicExponent: 0x10001,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

console.log('Set this value in OIDC_SIGNING_PRIVATE_KEY_B64:');
console.log(Buffer.from(privateKey, 'utf8').toString('base64'));
