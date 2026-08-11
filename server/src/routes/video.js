/** Video metadata, captions, frames, and cache eviction. */
import { Router } from 'express';
import fs from 'node:fs/promises';
import { asyncRoute, badRequest, notFound } from '../errors.js';
import { config } from '../config.js';
import { evictVideo } from '../lib/cache.js';
import { listReadyVideos } from '../services/library.js';
import { getVideoInfo, parseVideoId } from '../services/youtube.js';
import { getTranscript } from '../services/transcript.js';
import { buildCandidates, findGaps, speechIntervals } from '../services/gaps.js';
import { extractFrame } from '../services/frames.js';

export const videoRouter = Router();

/** Accepts `url` or `videoId` from query or body. */
function resolveId(req) {
  const source = req.query.url || req.query.videoId || req.body?.url || req.body?.videoId;
  if (!source) throw badRequest('Provide a YouTube url or videoId.');
  return parseVideoId(source);
}

/** Videos already processed on this server. */
videoRouter.get(
  '/api/videos/ready',
  asyncRoute(async (req, res) => {
    const videos = await listReadyVideos();
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ videos, count: videos.length });
  }),
);

videoRouter.get(
  '/api/video/info',
  asyncRoute(async (req, res) => {
    const videoId = resolveId(req);
    const info = await getVideoInfo(videoId);
    res.json({ ...info, embedUrl: `https://www.youtube.com/embed/${videoId}` });
  }),
);

videoRouter.get(
  '/api/captions',
  asyncRoute(async (req, res) => {
    const videoId = resolveId(req);
    const transcript = await getTranscript(videoId);
    const intervals = speechIntervals(transcript.cues);
    const gaps = findGaps(intervals);

    res.json({
      videoId,
      source: transcript.source,
      automatic: transcript.automatic,
      language: transcript.language || 'en',
      wordCount: transcript.wordCount,
      duration: transcript.duration,
      cues: transcript.cues,
      speechIntervals: intervals,
      gaps,
    });
  }),
);

/** The candidate timestamps, without calling Gemma — useful for tuning. */
videoRouter.get(
  '/api/video/candidates',
  asyncRoute(async (req, res) => {
    const videoId = resolveId(req);
    const [info, transcript] = await Promise.all([getVideoInfo(videoId), getTranscript(videoId)]);
    const candidates = buildCandidates({
      cues: transcript.cues,
      duration: info.duration || transcript.duration,
    });
    res.json({ videoId, count: candidates.length, candidates });
  }),
);

/** Serves one extracted frame as JPEG. Sighted-helper/debugging aid. */
videoRouter.get(
  '/api/video/frame',
  asyncRoute(async (req, res) => {
    const videoId = resolveId(req);
    const time = Number.parseFloat(req.query.time);
    if (!Number.isFinite(time) || time < 0) throw badRequest('Provide a numeric `time` in seconds.');

    const framePath = await extractFrame(videoId, time);
    const buffer = await fs.readFile(framePath).catch(() => null);
    if (!buffer) throw notFound('Frame could not be read.');

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  }),
);

// Development only. The API has no auth, so when disabled the route must not
// exist at all rather than reject inside the handler.
if (config.enableCacheAdmin) {
  videoRouter.delete(
    '/api/video/cache',
    asyncRoute(async (req, res) => {
      const videoId = resolveId(req);
      const removed = await evictVideo(videoId);
      res.json({ videoId, removed: removed.length });
    }),
  );
}
