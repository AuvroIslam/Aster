/** Health and configuration endpoints. */
import { Router } from 'express';
import { config, validateConfig } from '../config.js';
import { asyncRoute } from '../errors.js';
import { cacheStats } from '../lib/cache.js';
import { probeBinaries } from '../lib/binaries.js';
import { cookiePoolStatus } from '../lib/cookiePool.js';
import { currentResolution, listModels, resolveModel } from '../services/gemma.js';

export const metaRouter = Router();

metaRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString() });
});

metaRouter.get(
  '/api/config',
  asyncRoute(async (req, res) => {
    // Featherless pins its model from configuration, so there is nothing to
    // resolve and no model list to fetch.
    const featherless = config.gemmaProvider === 'featherless';
    let resolution = featherless ? null : currentResolution();
    let modelError = null;
    if (!featherless && !resolution) {
      try {
        resolution = await resolveModel();
      } catch (err) {
        modelError = err.message;
      }
    }

    res.json({
      app: 'VisionBridge',
      tagline: 'Making visual content accessible through intelligent audio descriptions.',
      ai: {
        provider: featherless ? 'Featherless.ai' : 'Google AI Studio',
        family: 'Gemma',
        model: featherless ? config.featherless.model : (resolution?.model ?? null),
        requestedModel: featherless ? config.featherless.model : (resolution?.requested ?? config.gemma.model),
        selection: featherless ? 'pinned' : (resolution?.source ?? null),
        availableModels: featherless ? [] : (resolution?.candidates ?? []),
        error: featherless ? null : modelError,
      },
      pipeline: config.pipeline,
      confidence: config.confidence,
      frames: config.frames,
      configurationProblems: validateConfig(),
    });
  }),
);

/** Diagnostics for the doctor script and the settings screen. */
metaRouter.get(
  '/api/config/diagnostics',
  asyncRoute(async (req, res) => {
    const [binaries, cache] = await Promise.all([probeBinaries(), cacheStats()]);
    let models = [];
    let error = null;
    try {
      models = (await listModels()).map((m) => m.id);
    } catch (err) {
      error = err.message;
    }
    res.json({
      binaries,
      cache: { dir: config.cacheDir, ...cache },
      ytdlpCookiePool: cookiePoolStatus(),
      visibleModels: models,
      gemmaModels: models.filter((id) => /^gemma/i.test(id)),
      error,
      node: process.version,
      platform: process.platform,
    });
  }),
);
