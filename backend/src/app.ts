import express from 'express';
import { errorHandler } from './errors.js';
import { api } from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
