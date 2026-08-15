import express from 'express';
import helmet from 'helmet';

import { authRouter } from './routes/authRoutes.js';
import { oidcRouter } from './routes/oidcRoutes.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(express.json({ limit: '32kb' }));

app.get('/healthz', (_request, response) => {
  response.status(200).json({ status: 'ok', service: 'omi-identity' });
});

app.use(authRouter);
app.use(oidcRouter);

app.use((request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${request.method} ${request.path}.` } });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error('[omi-identity]', error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Identity service request failed.' } });
});
