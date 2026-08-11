/** Filesystem cache. */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../logger.js';

const AREAS = ['videos', 'frames', 'data', 'tmp'];

/** Creates the cache tree if it does not exist. Safe to call repeatedly. */
export async function ensureCacheDirs(root = config.cacheDir) {
  await fs.mkdir(root, { recursive: true });
  await Promise.all(AREAS.map((area) => fs.mkdir(path.join(root, area), { recursive: true })));
  return root;
}

/** Absolute path inside a cache area. Rejects segments that escape the area. */
export function cachePath(area, ...segments) {
  if (!AREAS.includes(area)) throw new Error(`Unknown cache area: ${area}`);
  const safe = segments.map((segment) =>
    String(segment)
      // Separators and anything exotic become underscores...
      .replace(/[^\w.@-]+/g, '_')
      // ...and a run of dots can never form a parent-directory reference.
      .replace(/\.{2,}/g, '.'),
  );
  return path.join(config.cacheDir, area, ...safe);
}

export async function exists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.size > 0;
  } catch {
    return false;
  }
}

/** Short stable hash, used to key derived artefacts by their inputs. */
export function hashKey(value) {
  return createHash('sha1')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex')
    .slice(0, 16);
}

export async function readJson(area, name) {
  try {
    return JSON.parse(await fs.readFile(cachePath(area, name), 'utf8'));
  } catch {
    return null;
  }
}

export async function writeJson(area, name, value) {
  const file = cachePath(area, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  // Write-then-rename so a crash never leaves a half-written cache entry that
  // a later run would happily parse.
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, file);
  return file;
}

/** Read-through cache for JSON values. */
export async function withJsonCache(area, name, produce) {
  const hit = await readJson(area, name);
  if (hit !== null) {
    logger.debug(`cache hit ${area}/${name}`);
    return hit;
  }
  const value = await produce();
  await writeJson(area, name, value);
  return value;
}

/** Deletes every cached artefact for one video id. Returns files removed. */
export async function evictVideo(videoId) {
  const removed = [];
  const targets = [
    cachePath('videos', videoId),
    cachePath('frames', videoId),
    cachePath('data', `${videoId}.info.json`),
    cachePath('data', `${videoId}.transcript.json`),
    cachePath('data', `${videoId}.comprehension.json`),
  ];
  for (const target of targets) {
    try {
      // Deliberately not `force: true` — that suppresses ENOENT, so every
      // target would be counted as removed even when nothing was there.
      await fs.rm(target, { recursive: true });
      removed.push(target);
    } catch {
      /* nothing cached under that name */
    }
  }
  // Timelines are keyed videoId.timeline.<hash>.json
  try {
    const entries = await fs.readdir(cachePath('data'));
    for (const entry of entries) {
      if (entry.startsWith(`${videoId}.timeline.`)) {
        await fs.rm(path.join(cachePath('data'), entry), { force: true });
        removed.push(entry);
      }
    }
  } catch {
    /* data dir may not exist yet */
  }
  return removed;
}

/** Rough on-disk usage per area, for /api/config diagnostics. */
export async function cacheStats() {
  const stats = {};
  for (const area of AREAS) {
    let bytes = 0;
    let files = 0;
    const walk = async (dir) => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else {
          try {
            bytes += (await fs.stat(full)).size;
            files += 1;
          } catch {
            /* raced with eviction */
          }
        }
      }
    };
    await walk(path.join(config.cacheDir, area));
    stats[area] = { files, bytes };
  }
  return stats;
}
