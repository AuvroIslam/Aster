/** Transcript extraction and normalisation. */
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';
import { readJson, writeJson } from '../lib/cache.js';
import { downloadSubtitles } from './youtube.js';

/** Collapses whitespace and drops the position/formatting noise in captions. */
function cleanText(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\s*(music|applause|laughter|silence)\s*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parses YouTube's json3 caption format. */
export function parseJson3(raw) {
  let payload;
  try {
    payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }

  const cues = [];
  for (const event of payload.events || []) {
    if (typeof event.tStartMs !== 'number') continue;
    const text = cleanText((event.segs || []).map((seg) => seg.utf8 || '').join(''));
    if (!text) continue;
    const start = event.tStartMs / 1000;
    const duration = (event.dDurationMs ?? 0) / 1000;
    cues.push({
      start,
      // Auto-captions occasionally omit a duration; estimate from word count
      // at a typical speaking rate rather than assuming zero-length speech.
      end: start + (duration > 0 ? duration : estimateDuration(text)),
      text,
    });
  }
  return dedupe(cues);
}

/** WebVTT timestamp `00:01:02.500` (or `01:02.500`) to seconds. */
export function parseVttTimestamp(stamp) {
  const match = String(stamp).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
  if (!match) return null;
  const [, hours, minutes, seconds, millis] = match;
  return (
    Number(hours || 0) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(millis.padEnd(3, '0')) / 1000
  );
}

/** Parses WebVTT. */
export function parseVtt(raw) {
  const cues = [];
  const blocks = String(raw).split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) continue;
    const [from, to] = lines[timingIndex].split('-->').map((part) => part.trim().split(' ')[0]);
    const start = parseVttTimestamp(from);
    const end = parseVttTimestamp(to);
    if (start == null || end == null) continue;
    const text = cleanText(lines.slice(timingIndex + 1).join(' '));
    if (!text) continue;
    cues.push({ start, end: Math.max(end, start + 0.2), text });
  }
  return dedupe(cues);
}

/** ~2.7 words per second is a typical instructional speaking rate. */
function estimateDuration(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(0.6, words / 2.7);
}

/** YouTube auto-captions repeat each line as it "rolls up". */
function dedupe(cues) {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  const out = [];
  for (const cue of sorted) {
    const previous = out[out.length - 1];
    if (!previous) {
      out.push({ ...cue });
      continue;
    }
    if (previous.text === cue.text && Math.abs(previous.start - cue.start) < 0.05) {
      previous.end = Math.max(previous.end, cue.end);
      continue;
    }

    // Roll-up captions restate the previous line with more words appended, so two neighbouring cues where.
    const overlapping = cue.start - previous.start < 1;
    if (overlapping && cue.text.startsWith(previous.text)) {
      previous.text = cue.text;
      previous.end = Math.max(previous.end, cue.end);
      continue;
    }
    if (overlapping && previous.text.endsWith(cue.text)) {
      previous.end = Math.max(previous.end, cue.end);
      continue;
    }
    out.push({ ...cue });
  }
  return out;
}

/** Full transcript for a video, cached as `data/<id>.transcript.json`. */
export async function getTranscript(videoId) {
  const cached = await readJson('data', `${videoId}.transcript.json`);
  if (cached) return cached;

  const subtitle = await downloadSubtitles(videoId, {
    preferredLangs: config.language.captionLangs,
  });
  if (!subtitle) {
    throw new AppError(
      'This video has no captions Aster can read, so it cannot tell when the ' +
        'instructor is speaking. Please try a video that has captions (subtitles).',
      422,
      'no_transcript',
    );
  }

  const raw = await fs.readFile(subtitle.file, 'utf8');
  const cues = subtitle.format === 'json3' ? parseJson3(raw) : parseVtt(raw);

  if (!cues.length) {
    throw new AppError('Captions were downloaded but contained no usable text.', 422, 'empty_transcript');
  }

  const transcript = {
    videoId,
    source: subtitle.format,
    automatic: subtitle.automatic,
    // The language the narration was actually captioned in — drives the output
    // language of every description and answer, and the browser speech voice.
    language: subtitle.lang || 'en',
    cues,
    wordCount: cues.reduce((sum, cue) => sum + cue.text.split(/\s+/).length, 0),
    duration: cues[cues.length - 1].end,
  };

  logger.info(
    `Transcript for ${videoId}: ${cues.length} cues, ${transcript.wordCount} words, language=${transcript.language}`,
  );
  await writeJson('data', `${videoId}.transcript.json`, transcript);
  return transcript;
}

/** Transcript context around a timestamp, as the prompt needs it (spec §10). */
export function contextAround(cues, time, window = 12) {
  const before = [];
  const at = [];
  const after = [];

  for (const cue of cues) {
    if (cue.end <= time && cue.end >= time - window) before.push(cue.text);
    else if (cue.start <= time && cue.end >= time) at.push(cue.text);
    else if (cue.start >= time && cue.start <= time + window) after.push(cue.text);
  }

  return {
    before: before.join(' ').trim(),
    current: at.join(' ').trim(),
    after: after.join(' ').trim(),
  };
}
