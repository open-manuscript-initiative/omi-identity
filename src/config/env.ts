import 'dotenv/config';

import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3010),
  DATABASE_URL: z.string().min(1),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:3010'),
  OIDC_SIGNING_PRIVATE_KEY_B64: z.string().trim().min(1),
  OIDC_ID_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
  OIDC_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  OIDC_AUTHORIZATION_CODE_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(300),
  IDENTITY_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(2160).default(720),
  ORCID_CLIENT_ID: z.string().trim().optional(),
  ORCID_CLIENT_SECRET: z.string().trim().optional(),
  ORCID_BASE_URL: z.string().url().default('https://orcid.org'),
  ORCID_REDIRECT_URI: z.string().url().optional(),
  ADMIN_BOOTSTRAP_TOKEN: z.string().trim().optional(),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid OMI Identity configuration:', result.error.flatten().fieldErrors);
  throw new Error('OMI Identity environment configuration is invalid.');
}

export const env = result.data;

export const issuer = env.PUBLIC_ORIGIN.replace(/\/$/, '');

export function orcidConfigured(): boolean {
  return Boolean(env.ORCID_CLIENT_ID && env.ORCID_CLIENT_SECRET);
}

export function orcidRedirectUri(): string {
  return env.ORCID_REDIRECT_URI || `${issuer}/auth/orcid/callback`;
}
