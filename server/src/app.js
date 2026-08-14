/** Express application wiring. Kept separate from `index.js` so tests can import it. */
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config, REPO_ROOT } from './config.js';
import { errorHandler, notFound } from './errors.js';
import { logger } from './logger.js';
import { metaRouter } from './routes/meta.js';
import { videoRouter } from './routes/video.js';
import { describeRouter } from './routes/describe.js';
import { searchRouter } from './routes/search.js';
import { docRouter } from './routes/doc.js';
import { practiceRouter } from './routes/practice.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
    });
    next();
  });

  app.use(metaRouter);
  app.use(videoRouter);
  app.use(describeRouter);
  app.use(searchRouter);
  app.use(docRouter);
  app.use(practiceRouter);

  // Serve the built client when it exists, so `npm start` runs the whole app.
  const clientDist = path.join(REPO_ROOT, 'client', 'dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((req, res, next) => next(notFound(`No route for ${req.method} ${req.originalUrl}`)));
  app.use(errorHandler);

  return app;
}

export default createApp;
