/** YouTube access: id parsing, metadata, video download, subtitle download. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { badRequest, AppError } from '../errors.js';
import { logger } from '../logger.js';
import { cachePath, ensureCacheDirs, exists, readJson, writeJson } from '../lib/cache.js';
import { run, ytdlpPath } from '../lib/binaries.js';
import { sleep } from '../lib/pool.js';
import { baseLang } from '../lib/lang.js';
import { aliveCookieFiles, markCookieFileDead } from '../lib/cookiePool.js';

/** Video ids are exactly 11 URL-safe characters. */
const VIDEO_ID = /^[\w-]{11}$/;

/** Extracts a YouTube video id from a URL or a bare id. */
export function parseVideoId(input) {
  const raw = String(input || '').trim();
  if (!raw) throw badRequest('Please provide a YouTube URL.');
  if (VIDEO_ID.test(raw)) return raw;

  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    throw badRequest('That does not look like a YouTube URL.');
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be' && VIDEO_ID.test(segments[0] || '')) return segments[0];

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const v = url.searchParams.get('v');
    if (v && VIDEO_ID.test(v)) return v;
    // /embed/ID, /shorts/ID, /live/ID, /v/ID
    if (['embed', 'shorts', 'live', 'v'].includes(segments[0]) && VIDEO_ID.test(segments[1] || '')) {
      return segments[1];
    }
  }

  throw badRequest('Only standard YouTube video links are supported.');
}

export const watchUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

/** `--remote-components ejs:github` lets yt-dlp fetch its JS challenge-solver script (cached after. */
const BASE_YTDLP_ARGS = ['--remote-components', 'ejs:github'];

/**
 * Base arguments plus the egress proxy, when one is configured.
 *
 * `session` asks the proxy for a different exit IP. Residential providers key
 * sticky sessions off a suffix on the username — Proxyma uses `_s_<name>` —
 * and without varying it every retry can leave through the same address. That
 * matters because YouTube's refusals are per-IP: retrying a blocked exit fails
 * identically however many times you try, which is what made three attempts
 * look as hopeless as one.
 *
 * Left alone for proxies that carry no credentials, since there is no username
 * to attach a session to.
 */
const baseArgs = (session) => {
  const proxy = config.bin.ytdlpProxy;
  if (!proxy) return BASE_YTDLP_ARGS;
  return [...BASE_YTDLP_ARGS, '--proxy', session ? withProxySession(proxy, session) : proxy];
};

/** Adds a sticky-session tag to a `scheme://user:pass@host:port` proxy URL. */
export function withProxySession(proxyUrl, session) {
  const match = String(proxyUrl).match(/^(\w+:\/\/)([^:@/]+)(:[^@]*@.+)$/);
  if (!match) return proxyUrl;
  const [, scheme, user, rest] = match;
  // Replace an existing tag rather than stacking them up.
  const base = user.replace(/_s_[A-Za-z0-9]+/g, '');
  return `${scheme}${base}_s_${session}${rest}`;
};

/** YouTube's bot-check message, matched to trigger cookie rotation. */
const BOT_CHECK = /sign in to confirm you.{0,5}re not a bot/i;

/**
 * Turns yt-dlp's stderr into something a learner can act on.
 *
 * These failures are almost always about YouTube's relationship with this
 * machine — a session it distrusts, an IP it rate-limits — and not about
 * anything the learner did. Left raw they surface as "yt-dlp.exe exited with
 * code 1", which explains nothing and suggests no way forward. Each case below
 * names the cause and the one thing that actually fixes it.
 */
export function explainYtdlpFailure(raw, { videoId } = {}) {
  const text = String(raw || '');

  // The session failures. All three mean the same thing to whoever is looking
  // at the screen — YouTube will not release new video to this server right
  // now — so all three end with the same way forward.
  const SESSION_REMEDY =
    'Either run Aster on your own computer, where YouTube trusts the connection, or wait for the ' +
    'author to refresh the session. In the meantime every lesson below under “Ready to play” is ' +
    'already described and plays instantly, and the Notes and PDFs surface is unaffected.';

  if (BOT_CHECK.test(text)) {
    return new AppError(
      'YouTube asked this server to prove it is not a bot, which means its yt-dlp session has ' +
        `expired. Nothing is wrong with the video or with what you did. ${SESSION_REMEDY}`,
      503,
      'youtube_bot_check',
    );
  }

  if (/HTTP Error 429|Too Many Requests/i.test(text)) {
    return new AppError(
      'YouTube is rate-limiting this server after too many requests in a short time. ' +
        `${SESSION_REMEDY}`,
      503,
      'youtube_rate_limited',
    );
  }

  if (/HTTP Error 403|Forbidden/i.test(text)) {
    return new AppError(
      'YouTube refused to hand over this video’s media, which usually means the server’s yt-dlp ' +
        `session has expired. Aster already retried automatically. ${SESSION_REMEDY}`,
      503,
      'youtube_forbidden',
    );
  }

  if (/Private video|members-only|Join this channel/i.test(text)) {
    return new AppError(
      'That video is private or members-only, so its audio and frames cannot be read. Try a ' +
        'publicly available lesson.',
      422,
      'video_private',
    );
  }

  if (/Video unavailable|has been removed|no longer available/i.test(text)) {
    return new AppError(
      'That video is unavailable — it may have been removed, or blocked in this country.',
      422,
      'video_unavailable',
    );
  }

  if (/age.?restricted|confirm your age/i.test(text)) {
    return new AppError(
      'That video is age-restricted, so YouTube will not release it without a signed-in session. ' +
        'A cookies file (YTDLP_COOKIES_PATH) would allow it.',
      422,
      'video_age_restricted',
    );
  }

  if (/is a live|live event will begin|premieres in/i.test(text)) {
    return new AppError(
      'That is a live stream or an upcoming premiere. Aster reads a whole lesson before it speaks, ' +
        'so it needs a finished video.',
      422,
      'video_is_live',
    );
  }

  return null;
}

/** Runs yt-dlp with automatic cookie rotation. */
async function runYtdlp(bin, buildArgs, options) {
  const files = aliveCookieFiles();
  const attempts = files.length ? files : [null];
  let lastErr;
  for (const cookieFile of attempts) {
    const cookieArgs = cookieFile ? ['--cookies', cookieFile] : [];
    try {
      return await run(bin, buildArgs(cookieArgs), options);
    } catch (err) {
      lastErr = err;
      if (cookieFile && BOT_CHECK.test(err.message)) {
        markCookieFileDead(cookieFile);
        continue;
      }
      // Every yt-dlp caller goes through here, so this is the one place that
      // has to translate a raw exit code into something worth reading.
      throw explainYtdlpFailure(err.message) ?? err;
    }
  }
  throw explainYtdlpFailure(lastErr?.message) ?? lastErr;
}

function requireYtDlp() {
  const bin = ytdlpPath();
  if (!bin) {
    throw new AppError(
      'yt-dlp is not installed or not on PATH. Install it with `pip install yt-dlp`, ' +
        'or set YTDLP_PATH in .env.',
      503,
      'ytdlp_missing',
    );
  }
  return bin;
}

/** Fields we keep from yt-dlp's (very large) metadata dump. */
function trimInfo(info) {
  return {
    videoId: info.id,
    title: info.title,
    description: (info.description || '').slice(0, 2000),
    channel: info.channel || info.uploader || null,
    duration: info.duration ?? null,
    thumbnail: info.thumbnail || null,
    uploadDate: info.upload_date || null,
    viewCount: info.view_count ?? null,
    isLive: Boolean(info.is_live),
    // The video's primary spoken language, when yt-dlp reports it.
    language: info.language || null,
    availableSubtitles: Object.keys(info.subtitles || {}),
    availableAutoCaptions: Object.keys(info.automatic_captions || {}).slice(0, 20),
    webpageUrl: info.webpage_url || watchUrl(info.id),
  };
}

/** Metadata for a video. */
export async function getVideoInfo(videoId) {
  await ensureCacheDirs();
  const cached = await readJson('data', `${videoId}.info.json`);
  if (cached) return cached;

  const bin = requireYtDlp();
  const { stdout } = await logger.time('yt-dlp metadata', () =>
    runYtdlp(
      bin,
      (cookieArgs) => [
        '--dump-single-json',
        '--skip-download',
        '--no-warnings',
        ...baseArgs(),
        ...cookieArgs,
        watchUrl(videoId),
      ],
      { timeoutMs: 120_000 },
    ),
  );

  let info;
  try {
    info = JSON.parse(stdout);
  } catch {
    throw new AppError('yt-dlp returned metadata that could not be parsed.', 502, 'ytdlp_parse');
  }

  if (info.is_live) {
    throw badRequest('Live streams are not supported. Please use a regular video.');
  }

  const trimmed = trimInfo(info);
  await writeJson('data', `${videoId}.info.json`, trimmed);
  return trimmed;
}

/** Finds a cached video file for `videoId`, whatever container it landed in. */
async function findCachedVideo(videoId) {
  const dir = cachePath('videos');
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }
  const match = entries.find((name) => name.startsWith(`${videoId}.`) && !name.endsWith('.part'));
  if (!match) return null;
  const full = path.join(dir, match);
  return (await exists(full)) ? full : null;
}

/** Downloads the video (video track only — we need pixels, not audio) at a modest resolution, and. */
export async function downloadVideo(videoId, onProgress) {
  await ensureCacheDirs();
  const cached = await findCachedVideo(videoId);
  if (cached) {
    logger.debug(`video cache hit ${videoId}`);
    return cached;
  }

  const bin = requireYtDlp();
  const height = config.frames.maxVideoHeight;
  const output = path.join(cachePath('videos'), `${videoId}.%(ext)s`);

  // Prefer a video-only mp4 stream: it is the smallest download that still
  // gives ffmpeg the frames we need, and it never requires muxing.
  const adaptive = [
    `bv*[height<=${height}][ext=mp4]`,
    `bv*[height<=${height}]`,
    `b[height<=${height}]`,
    'bv*',
    'b',
  ].join('/');

  // A muxed stream carries audio we have no use for, but YouTube serves it
  // over a steadier path. Bigger download, and worth it as a last resort:
  // the alternative is no lesson at all.
  const muxed = [`b[height<=${height}]`, 'b'].join('/');

  /**
   * YouTube intermittently answers 403 for an adaptive format URL that worked
   * moments earlier. `--retries` below cannot recover from it — that governs
   * fragment retries within one run, whereas a rejected format URL has to be
   * re-signed, and only a fresh yt-dlp invocation does that. So retry the
   * process itself, dropping to the muxed stream on the final attempt.
   */
  /*
   * Six rungs, because the measured success rate through a residential proxy
   * is about 75% per attempt — YouTube refuses roughly one exit IP in four,
   * seemingly at random. Each attempt leaves through a different IP, so the
   * odds compound: six independent tries put total failure near 1 in 5,000,
   * where three would leave it at 1 in 60.
   *
   * A failed attempt costs about six seconds, so even the worst case stays
   * inside the minute. Waiting is cheap; telling a learner the video cannot be
   * loaded when a retry would have worked is not.
   */
  const attempts = [adaptive, adaptive, adaptive, adaptive, adaptive, muxed];

  onProgress?.({ percent: 0, message: 'Downloading video' });

  let lastError = null;
  for (const [attempt, format] of attempts.entries()) {
    try {
      await logger.time('yt-dlp download', () =>
        runYtdlp(
          bin,
          (cookieArgs) => [
            '-f',
            format,
            '--no-playlist',
            '--no-warnings',
            '--no-part',
            '--retries',
            '3',
            // A different exit IP each time round, so a refusal aimed at one
            // address does not simply repeat.
            ...baseArgs(`a${attempt}${Date.now().toString(36).slice(-4)}`),
            ...cookieArgs,
            '-o',
            output,
            watchUrl(videoId),
          ],
          { timeoutMs: 600_000 },
        ),
      );
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      const reason = String(err.message || '').split('\n').find((l) => /ERROR|Error/.test(l)) ?? err.message;
      logger.warn(
        `Video download attempt ${attempt + 1}/${attempts.length} for ${videoId} failed: ${reason.trim()}`,
      );
      if (attempt < attempts.length - 1) {
        onProgress?.({ percent: 0, message: 'Retrying the video download' });
        await sleep(2000 * (attempt + 1));
      }
    }
  }
  if (lastError) throw explainYtdlpFailure(lastError.message, { videoId }) ?? lastError;

  const file = await findCachedVideo(videoId);
  if (!file) throw new AppError('Video download finished but no file was produced.', 502, 'download_failed');
  onProgress?.({ percent: 100, message: 'Video downloaded' });
  return file;
}

/** Works out which caption languages to request and in what order to prefer them. */
async function resolveSubtitleLangs(videoId, preferredLangs) {
  const configured = (preferredLangs && preferredLangs.length ? preferredLangs : ['auto'])
    .map((value) => String(value).trim())
    .filter(Boolean);
  const auto = configured.length === 1 && configured[0].toLowerCase() === 'auto';

  const request = [];
  const seen = new Set();
  const add = (code) => {
    const value = String(code || '').trim();
    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      request.push(value);
    }
  };

  if (!auto) {
    configured.forEach(add);
  } else {
    // Derive the languages from the video itself. getVideoInfo is cached, so
    // this costs nothing beyond the metadata call the pipeline already makes.
    let info = null;
    try {
      info = await getVideoInfo(videoId);
    } catch {
      /* fall through to the English fallback below */
    }
    const primary = info?.language ? baseLang(info.language) : '';
    if (primary) {
      // The original language, both as the manual track and the `-orig` auto
      // track, then any same-language variants YouTube actually offers.
      add(`${primary}-orig`);
      add(primary);
      for (const lang of info?.availableSubtitles || []) if (baseLang(lang) === primary) add(lang);
      for (const lang of info?.availableAutoCaptions || []) if (baseLang(lang) === primary) add(lang);
    } else {
      // No declared language: take the original auto track whatever it is, so a
      // Bengali (or any) lesson is still captioned rather than rejected.
      for (const lang of info?.availableAutoCaptions || []) {
        if (/-orig$/i.test(lang)) {
          add(lang);
          add(baseLang(lang));
        }
      }
    }
  }

  // Requesting every machine-translated `en-XX` track is a fast route to HTTP
  // 429, so the fallback stays to genuine English tracks only.
  add('en-orig');
  add('en');
  add('en-US');
  add('en-GB');

  const priority = [];
  for (const lang of request) {
    const base = baseLang(lang);
    if (base && !priority.includes(base)) priority.push(base);
  }
  return { request: request.slice(0, 8), priority };
}

/** Downloads captions in the video's own language, manual preferred over automatic. */
export async function downloadSubtitles(videoId, { preferredLangs } = {}) {
  await ensureCacheDirs();
  const dir = cachePath('tmp', videoId);
  await fs.mkdir(dir, { recursive: true });

  const { request, priority } = await resolveSubtitleLangs(videoId, preferredLangs);

  const existing = await findSubtitleFile(dir, videoId, priority);
  if (existing) return existing;

  const bin = requireYtDlp();
  const output = path.join(dir, `${videoId}.%(ext)s`);
  const langs = request.join(',');

  // YouTube rate-limits caption requests; a short backoff clears it.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await logger.time('yt-dlp subtitles', () =>
        runYtdlp(
          bin,
          (cookieArgs) => [
            '--skip-download',
            '--write-subs',
            '--write-auto-subs',
            '--sub-langs',
            langs,
            '--sub-format',
            'json3/vtt',
            '--no-warnings',
            '--no-playlist',
            ...baseArgs(),
            ...cookieArgs,
            '-o',
            output,
            watchUrl(videoId),
          ],
          { timeoutMs: 180_000 },
        ),
      );
    } catch (err) {
      logger.warn(
        `Subtitle download attempt ${attempt + 1} for ${videoId} reported an error: ${err.message}`,
      );
    }

    const found = await findSubtitleFile(dir, videoId, priority);
    if (found) return found;

    if (attempt < 2) await sleep(2000 * 2 ** attempt);
  }

  return null;
}

/** The language subtag embedded in a subtitle filename ("<id>.bn-orig.json3" -> "bn-orig"). */
function subtitleLangOf(name, videoId) {
  const rest = name.startsWith(`${videoId}.`) ? name.slice(videoId.length + 1) : name;
  return rest.replace(/\.(json3|vtt|srv\d)$/i, '');
}

async function findSubtitleFile(dir, videoId, priority = []) {
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }
  const subtitles = entries.filter((n) => n.startsWith(videoId) && /\.(json3|vtt|srv\d)$/.test(n));
  if (!subtitles.length) return null;

  // Pick, in order: the highest-priority language (the video's own first), then manual over.
  const rank = (name) => {
    const langIndex = priority.indexOf(baseLang(subtitleLangOf(name, videoId)));
    const language = langIndex === -1 ? priority.length : langIndex;
    const auto = /orig|auto/i.test(name) ? 1 : 0;
    const format = name.endsWith('.json3') ? 0 : 1;
    return language * 4 + format * 2 + auto;
  };
  subtitles.sort((a, b) => rank(a) - rank(b));

  const chosen = subtitles[0];
  return {
    file: path.join(dir, chosen),
    format: chosen.endsWith('.json3') ? 'json3' : 'vtt',
    automatic: /orig|auto/i.test(chosen),
    lang: baseLang(subtitleLangOf(chosen, videoId)) || 'en',
  };
}
