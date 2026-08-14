/** Central configuration for Aster. */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..');

loadEnv({ path: path.join(REPO_ROOT, '.env') });
loadEnv({ path: path.join(REPO_ROOT, 'server', '.env') });

const num = (value, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const list = (value, fallback) =>
  (value ? value.split(',') : fallback).map((s) => s.trim()).filter(Boolean);

/** Only an explicit, affirmative value turns a flag on. */
const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const env = process.env;

export const config = {
  port: int(env.PORT, 5174),
  logLevel: env.LOG_LEVEL || 'info',
  corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
  cacheDir: path.isAbsolute(env.CACHE_DIR || '')
    ? env.CACHE_DIR
    : path.join(REPO_ROOT, env.CACHE_DIR || '.cache'),

  // Registers DELETE /api/video/cache, which erases every artefact for a video.
  enableCacheAdmin: bool(env.ENABLE_CACHE_ADMIN, false),

  // Which host serves Gemma. Same weights either way — only the wire format
  // and the model id differ, so the rest of the pipeline is unaffected.
  gemmaProvider: (env.GEMMA_PROVIDER || 'google').trim().toLowerCase(),

  // Featherless.ai — an OpenAI-compatible host for the official Gemma weights.
  // Read only when GEMMA_PROVIDER=featherless.
  featherless: {
    apiKey: env.FEATHERLESS_API_KEY || '',
    baseUrl: (env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1').replace(/\/$/, ''),
    // Featherless ids are case-sensitive and do not match AI Studio's casing (`google/gemma-4-31B-it`,.
    model: env.FEATHERLESS_MODEL || '',
    modelFallback: env.FEATHERLESS_MODEL_FALLBACK || '',
  },

  gemma: {
    apiKey: env.GEMMA_API_KEY || '',
    // Optional fallback: a second Google AI Studio key (e.g. a different Google account).
    apiKeyFallback: env.GEMMA_API_KEY_FALLBACK || '',
    /** The generative model. */
    model: env.GEMMA_MODEL || 'gemma-4-31b-it',
    // Gemma 4 ids served by the Gemini API, best first. The fallback is the
    // faster MoE Gemma 4 variant — no Gemma 3 in the competition build.
    preferences: list(env.GEMMA_MODEL_PREFERENCES, ['gemma-4-31b-it', 'gemma-4-26b-a4b-it']),
    baseUrl: (env.GEMMA_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(
      /\/$/,
      '',
    ),
    timeoutMs: int(env.GEMMA_TIMEOUT_MS, 90_000),
    maxRetries: int(env.GEMMA_MAX_RETRIES, 2),
    concurrency: int(env.GEMMA_CONCURRENCY, 3),
  },

  bin: {
    ytdlp: env.YTDLP_PATH || '',
    ffmpeg: env.FFMPEG_PATH || '',
    ffprobe: env.FFPROBE_PATH || '',
    // Netscape-format cookies.txt for yt-dlp.
    ytdlpCookies: env.YTDLP_COOKIES_PATH || '',
    // A directory of cookies.txt files (one per throwaway account), tried in rotation.
    ytdlpCookiesDir: env.YTDLP_COOKIES_DIR || '',
    // Egress proxy for every yt-dlp request (`http://`, `https://` or `socks5://`).
    ytdlpProxy: env.YTDLP_PROXY || '',
  },

  pipeline: {
    minGapSeconds: num(env.MIN_GAP_SECONDS, 1.2),
    minSpacingSeconds: num(env.MIN_SPACING_SECONDS, 8),
    forcedCandidateInterval: num(env.FORCED_CANDIDATE_INTERVAL, 45),
    maxCandidates: int(env.MAX_CANDIDATES, 60),
  },

  confidence: {
    high: num(env.CONFIDENCE_HIGH, 0.85),
    critical: num(env.CONFIDENCE_CRITICAL, 0.6),
  },

  frames: {
    width: int(env.FRAME_WIDTH, 640),
    quality: int(env.FRAME_QUALITY, 5),
    maxVideoHeight: int(env.MAX_VIDEO_HEIGHT, 480),
  },

  // YouTube search — powered by yt-dlp's built-in search (no extra API key).
  search: {
    maxResults: int(env.SEARCH_MAX_RESULTS, 6),
  },

  language: {
    /** Caption languages to fetch. */
    captionLangs: list(env.CAPTION_LANGS, ['auto']),
    /** The language descriptions and answers are written and spoken in. */
    output: (env.OUTPUT_LANG || 'auto').trim(),
  },
};

/**
 * Normalises a model id to its bare form (`models/gemma-3-4b-it` -> `gemma-3-4b-it`).
 */
export function bareModelId(model) {
  return String(model || '').replace(/^models\//, '');
}

/** Validates configuration at startup. */
export function validateConfig(cfg = config) {
  const problems = [];
  if (cfg.gemmaProvider === 'featherless') {
    if (!cfg.featherless.apiKey) {
      problems.push(
        'FEATHERLESS_API_KEY is not set. Get a key at https://featherless.ai/account/api-keys',
      );
    }
    if (!cfg.featherless.model) {
      problems.push(
        'FEATHERLESS_MODEL is not set. Ids are case-sensitive — confirm one against ' +
          'GET /v1/models rather than copying from documentation.',
      );
    }
  } else if (!cfg.gemma.apiKey) {
    problems.push('GEMMA_API_KEY is not set. Get a key at https://aistudio.google.com/apikey');
  }
  if (cfg.confidence.critical > cfg.confidence.high) {
    problems.push('CONFIDENCE_CRITICAL must be <= CONFIDENCE_HIGH');
  }
  if (cfg.pipeline.minGapSeconds <= 0) {
    problems.push('MIN_GAP_SECONDS must be greater than 0');
  }
  return problems;
}

export default config;
