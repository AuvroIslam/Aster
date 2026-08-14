/**
 * Seeds the runtime cache from the copy baked into the image.
 *
 * A container filesystem is thrown away on every restart, so the cache lives on
 * a persistent mount (`CACHE_DIR`, e.g. App Service's `/home`). That mount
 * starts empty, which would leave the first visitor waiting three minutes for a
 * lesson the image already had. So on boot, if the persistent cache has no
 * timelines yet, the seed is copied across.
 *
 * Copying only when empty is what makes this safe to run every start: lessons a
 * learner processes later are never overwritten by the shipped set.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../logger.js';

const SEED_DIR = process.env.SEED_CACHE_DIR || '/app/seed-cache';

async function isDirectory(target) {
  const stat = await fs.stat(target).catch(() => null);
  return Boolean(stat?.isDirectory());
}

/** True when the live cache already holds at least one described lesson. */
async function alreadySeeded() {
  const entries = await fs.readdir(path.join(config.cacheDir, 'data')).catch(() => []);
  return entries.some((name) => name.includes('.timeline.'));
}

export async function seedCacheIfEmpty() {
  if (!(await isDirectory(SEED_DIR))) return;

  if (await alreadySeeded()) {
    logger.info('Cache already populated — leaving it alone.');
    return;
  }

  try {
    await fs.mkdir(config.cacheDir, { recursive: true });
    await fs.cp(SEED_DIR, config.cacheDir, { recursive: true, force: false });

    const data = await fs.readdir(path.join(config.cacheDir, 'data')).catch(() => []);
    const lessons = data.filter((n) => n.includes('.timeline.')).length;
    logger.info(`Seeded the cache from the image: ${lessons} lesson(s) ready to play.`);
  } catch (err) {
    // A demo without the seed is worse, but a server that will not boot is
    // worse still — the lessons can always be processed on demand.
    logger.warn(`Could not seed the cache: ${err.message}`);
  }
}

export default seedCacheIfEmpty;
