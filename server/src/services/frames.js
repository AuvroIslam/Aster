/** Frame extraction with ffmpeg. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';
import { cachePath, ensureCacheDirs, exists } from '../lib/cache.js';
import { ffmpegPath, run } from '../lib/binaries.js';
import { mapWithConcurrency } from '../lib/pool.js';
import { downloadVideo } from './youtube.js';

function requireFfmpeg() {
  const bin = ffmpegPath();
  if (!bin) {
    throw new AppError(
      'ffmpeg is not installed or not on PATH. Install it (winget install Gyan.FFmpeg, ' +
        'brew install ffmpeg, apt install ffmpeg) or set FFMPEG_PATH in .env.',
      503,
      'ffmpeg_missing',
    );
  }
  return bin;
}

/** Frames are cached per video and timestamp, at centisecond resolution. */
export function frameFileName(time) {
  return `t${Math.round(Number(time) * 100)}.jpg`;
}

/** Extracts a single JPEG frame, or returns the cached one. */
export async function extractFrame(videoId, time, options = {}) {
  await ensureCacheDirs();
  const dir = cachePath('frames', videoId);
  await fs.mkdir(dir, { recursive: true });

  const target = path.join(dir, frameFileName(time));
  if (await exists(target)) return target;

  const bin = requireFfmpeg();
  const videoPath = options.videoPath || (await downloadVideo(videoId));
  const width = options.width || config.frames.width;
  const quality = options.quality ?? config.frames.quality;

  // `-ss` before `-i` seeks by keyframe, which is fast and accurate enough for
  // description purposes; `-frames:v 1` grabs exactly one picture.
  await run(
    bin,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(Math.max(0, time)),
      '-i',
      videoPath,
      '-frames:v',
      '1',
      '-vf',
      `scale=${width}:-2:flags=bicubic`,
      '-q:v',
      String(quality),
      target,
    ],
    { timeoutMs: 60_000 },
  );

  if (!(await exists(target))) {
    throw new AppError(`Could not extract a frame at ${time}s.`, 502, 'frame_extraction_failed');
  }
  return target;
}

/** Extracts many frames, reusing one download and bounded concurrency. */
export async function extractFrames(videoId, times, { concurrency = 4 } = {}) {
  const videoPath = await downloadVideo(videoId);
  return mapWithConcurrency(times, concurrency, async (time) => {
    try {
      return { time, path: await extractFrame(videoId, time, { videoPath }) };
    } catch (err) {
      logger.warn(`Frame extraction failed at ${time}s: ${err.message}`);
      return { time, path: null, error: err.message };
    }
  });
}

/** Reads a frame as base64, ready for Gemma's `inline_data` part. */
export async function frameToBase64(framePath) {
  const buffer = await fs.readFile(framePath);
  return buffer.toString('base64');
}

/** Convenience: extract and encode in one step. */
export async function frameAsImage(videoId, time, options) {
  const framePath = await extractFrame(videoId, time, options);
  return { data: await frameToBase64(framePath), mimeType: 'image/jpeg', path: framePath };
}
