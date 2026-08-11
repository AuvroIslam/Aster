/** Rotation over a pool of yt-dlp cookies.txt files. */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { cachePath } from './cache.js';
import { logger } from '../logger.js';

// How long a bot-checked file is skipped before being tried again.
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const stateFile = () => path.join(cachePath('data'), 'cookie-pool.json');

/** All configured cookie files, in a stable order. Re-read every call so a
 * file dropped into the pool directory is picked up without a restart. */
function listCookieFiles() {
  const dir = config.bin.ytdlpCookiesDir;
  if (dir) {
    try {
      return fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.txt'))
        .sort()
        .map((name) => path.join(dir, name));
    } catch (err) {
      logger.warn(`Could not read YTDLP_COOKIES_DIR (${dir}): ${err.message}`);
      return [];
    }
  }
  return config.bin.ytdlpCookies ? [config.bin.ytdlpCookies] : [];
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2));
  } catch (err) {
    logger.warn(`Could not persist cookie pool state: ${err.message}`);
  }
}

/** Files genuinely out of cooldown right now — no fallback. */
function notInCooldown(files) {
  const state = loadState();
  const now = Date.now();
  return files.filter((file) => !(state[file]?.deadUntil > now));
}

/** Cookie files worth trying right now, in rotation order. */
export function aliveCookieFiles() {
  const files = listCookieFiles();
  if (!files.length) return [];
  const alive = notInCooldown(files);
  return alive.length ? alive : files;
}

/** Marks a cookie file as bot-checked; it is skipped until the cooldown passes. */
export function markCookieFileDead(file) {
  const state = loadState();
  state[file] = { deadUntil: Date.now() + COOLDOWN_MS, markedAt: new Date().toISOString() };
  saveState(state);
  logger.warn(`Cookie file bot-checked, skipping for ${Math.round(COOLDOWN_MS / 3_600_000)}h: ${path.basename(file)}`);
}

/** Pool size and how many files are genuinely out of cooldown, for diagnostics. */
export function cookiePoolStatus() {
  const files = listCookieFiles();
  return { total: files.length, alive: notInCooldown(files).length };
}
