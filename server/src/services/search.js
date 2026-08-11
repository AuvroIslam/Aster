/** YouTube search — a permitted "Search system" supporting technology. */
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';
import { run, ytdlpPath } from '../lib/binaries.js';

/** Video ids are exactly 11 URL-safe characters. */
const VIDEO_ID = /^[\w-]{11}$/;

/** Searches YouTube for `query` and returns lightweight result metadata. */
export async function searchYouTube(query, limit) {
  const q = String(query || '').trim();
  if (!q) return [];

  const bin = ytdlpPath();
  if (!bin) {
    throw new AppError(
      'yt-dlp is not installed or not on PATH. Install it with `pip install yt-dlp`, or set YTDLP_PATH in .env.',
      503,
      'ytdlp_missing',
    );
  }

  const count = Math.min(Math.max(Number(limit) || config.search.maxResults, 1), 15);

  const { stdout } = await logger.time('yt-dlp search', () =>
    run(
      bin,
      [
        `ytsearch${count}:${q}`,
        '--flat-playlist',
        '--dump-json',
        '--no-warnings',
        '--skip-download',
        // Search is bot-checked the same way playback metadata is, so it goes
        // out through the same egress proxy when one is configured.
        ...(config.bin.ytdlpProxy ? ['--proxy', config.bin.ytdlpProxy] : []),
      ],
      { timeoutMs: 60_000 },
    ),
  );

  const results = [];
  for (const line of stdout.split('\n')) {
    const text = line.trim();
    if (!text) continue;
    let entry;
    try {
      entry = JSON.parse(text);
    } catch {
      continue;
    }
    const id = entry.id;
    if (!id || !VIDEO_ID.test(id)) continue;
    results.push({
      videoId: id,
      title: entry.title || 'Untitled video',
      channel: entry.channel || entry.uploader || '',
      duration: Number.isFinite(entry.duration) ? entry.duration : null,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }
  return results;
}
