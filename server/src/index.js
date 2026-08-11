/** VisionBridge server entry point. */
import { config, validateConfig } from './config.js';
import { logger } from './logger.js';
import { createApp } from './app.js';
import { ensureCacheDirs } from './lib/cache.js';
import { probeBinaries } from './lib/binaries.js';
import { resolveModel } from './services/gemma.js';

/** Refuses to start, without tearing the process down mid-flight: setting `exitCode` lets Node. */
function refuseToStart(reason) {
  logger.error(reason);
  logger.error('VisionBridge did not start. Run `npm run doctor` to diagnose.');
  process.exitCode = 1;
  return false;
}

async function main() {
  logger.info('Starting VisionBridge server');

  const problems = validateConfig();
  if (problems.length) {
    for (const problem of problems) logger.error(`Configuration problem: ${problem}`);
    return refuseToStart('Fix the configuration problems above (see .env.example).');
  }

  await ensureCacheDirs();
  logger.info(`Cache directory: ${config.cacheDir}`);

  const binaries = await probeBinaries();
  for (const [name, probe] of Object.entries(binaries)) {
    if (probe.available) logger.info(`${name}: ${probe.version}`);
    else logger.warn(`${name} is NOT available — video processing will fail. Run npm run doctor.`);
  }

  if (config.gemmaProvider === 'featherless') {
    // Featherless pins its model from configuration — there is nothing to
    // Featherless pins its model — nothing to resolve, and no Google key needed.
    logger.info(`Model: ${config.featherless.model} (featherless, pinned)`);
  } else {
    try {
      const { model, source, requested } = await resolveModel();
      logger.info(`Model: ${model} (requested "${requested}", ${source})`);
    } catch (err) {
      // Refusing to start is the correct behaviour: the alternative would be a
      // server that silently has no model.
      return refuseToStart(`Could not resolve a model: ${err.message}`);
    }
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`VisionBridge API listening on http://localhost:${config.port}`);
    logger.info(`Model proof: http://localhost:${config.port}/api/config`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  return true;
}

main().catch((err) => {
  logger.error('Fatal startup error:', err.stack || err.message);
  process.exitCode = 1;
});
