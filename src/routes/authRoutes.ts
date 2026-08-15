import { Router } from 'express';

import { orcidConfigured } from '../config/env.js';
import { consumeOrcidCallback, orcidAuthorizeUrl } from '../providers/orcid.js';
import { createIdentitySession } from '../security/session.js';

export const authRouter = Router();

authRouter.get('/auth/orcid/start', async (request, response, next) => {
  try {
    if (!orcidConfigured()) {
      response.status(503).json({ error: { code: 'ORCID_NOT_CONFIGURED', message: 'ORCID authentication is not configured.' } });
      return;
    }
    const returnTo = typeof request.query.return_to === 'string' ? request.query.return_to : '';
    if (!returnTo.startsWith('/oauth/authorize?')) {
      response.status(400).json({ error: { code: 'INVALID_RETURN_URL', message: 'The OIDC authorization context is invalid.' } });
      return;
    }
    const { save, url } = orcidAuthorizeUrl(returnTo);
    await save;
    response.redirect(302, url.toString());
  } catch (error) {
    next(error);
  }
});

authRouter.get('/auth/orcid/callback', async (request, response, next) => {
  try {
    const code = typeof request.query.code === 'string' ? request.query.code.trim() : '';
    const state = typeof request.query.state === 'string' ? request.query.state.trim() : '';
    if (!code || !state) {
      response.status(400).json({ error: { code: 'INVALID_ORCID_CALLBACK', message: 'ORCID callback parameters are missing.' } });
      return;
    }
    const result = await consumeOrcidCallback(code, state);
    await createIdentitySession(result.userId, response);
    response.redirect(302, result.returnUrl);
  } catch (error) {
    next(error);
  }
});
