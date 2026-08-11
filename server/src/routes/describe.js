/** Description endpoints. */
import { Router } from 'express';
import { config } from '../config.js';
import { asyncRoute, badRequest, notFound } from '../errors.js';
import { clamp01 } from '../lib/json.js';
import { resolveOutputLanguage } from '../lib/lang.js';
import { logger } from '../logger.js';
import { parseVideoId, getVideoInfo } from '../services/youtube.js';
import { contextAround, getTranscript } from '../services/transcript.js';
import { frameAsImage } from '../services/frames.js';
import { generateJson } from '../services/gemma.js';
import { generateTimeline } from '../services/timeline.js';
import { comprehensionContextBlock, getComprehension } from '../services/comprehension.js';
import { getJob, getJobForVideo, serialiseJob, startJob } from '../services/jobs.js';
import { buildQuestionPrompt, QUESTION_PRESETS } from '../prompts/describe.js';

export const describeRouter = Router();

/** Pipeline overrides a client is allowed to send. */
function pickOptions(body = {}) {
  const options = {};
  const allowed = [
    'minGapSeconds',
    'minSpacingSeconds',
    'forcedCandidateInterval',
    'maxCandidates',
    'confidenceHigh',
    'confidenceCritical',
  ];
  for (const key of allowed) {
    const value = Number.parseFloat(body[key]);
    if (Number.isFinite(value)) options[key] = value;
  }
  return options;
}

/** Phase 3 endpoint. */
describeRouter.post(
  '/api/describe/batch',
  asyncRoute(async (req, res) => {
    const videoId = parseVideoId(req.body?.url || req.body?.videoId);
    const timeline = await generateTimeline({
      videoId,
      options: pickOptions(req.body),
      refresh: Boolean(req.body?.refresh),
    });
    res.json(timeline);
  }),
);

/** Starts (or joins) background processing for a video. */
describeRouter.post(
  '/api/process',
  asyncRoute(async (req, res) => {
    const videoId = parseVideoId(req.body?.url || req.body?.videoId);
    const options = pickOptions(req.body);
    const refresh = Boolean(req.body?.refresh);

    const job = startJob({
      videoId,
      refresh,
      run: (report) => generateTimeline({ videoId, options, refresh, onProgress: report }),
    });

    res.status(202).json(serialiseJob(job));
  }),
);

describeRouter.get(
  '/api/process/:jobId',
  asyncRoute(async (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) throw notFound('That processing job is no longer available.');
    res.json(serialiseJob(job));
  }),
);

/** Convenience for reconnecting clients: latest job for a video. */
describeRouter.get(
  '/api/process',
  asyncRoute(async (req, res) => {
    const videoId = parseVideoId(req.query.url || req.query.videoId);
    const job = getJobForVideo(videoId);
    if (!job) throw notFound('No processing job exists for that video yet.');
    res.json(serialiseJob(job));
  }),
);

/**
 * Phase 5 endpoint — interactive Q&A grounded in the frame on screen.
 */
describeRouter.post(
  '/api/describe/frame',
  asyncRoute(async (req, res) => {
    const videoId = parseVideoId(req.body?.url || req.body?.videoId);

    const time = Number.parseFloat(req.body?.time);
    if (!Number.isFinite(time) || time < 0) {
      throw badRequest('Provide the current playback `time` in seconds.');
    }

    const preset = QUESTION_PRESETS.find((p) => p.id === req.body?.presetId);
    const question = String(req.body?.question || preset?.question || '').trim();
    if (!question) throw badRequest('Provide a `question` or a known `presetId`.');
    if (question.length > 300) throw badRequest('That question is too long.');

    const [info, transcript, image] = await Promise.all([
      getVideoInfo(videoId).catch(() => ({ title: '' })),
      getTranscript(videoId).catch(() => ({ cues: [] })),
      frameAsImage(videoId, time),
    ]);

    // Reuse the whole-video understanding the descriptions were built on.
    const understanding = await getComprehension({ videoId, info, transcript }).catch(() => null);

    // Answer in the same language the video is captioned in (or the configured
    // override), so a blind learner hears their own language.
    const language = resolveOutputLanguage(config.language.output, transcript.language || 'en');

    const context = contextAround(transcript.cues || [], time);
    const prompt = buildQuestionPrompt({
      question,
      time,
      context,
      videoTitle: info.title,
      understanding,
      comprehensionBlock: comprehensionContextBlock(understanding),
      language,
    });

    const { json, text, model } = await generateJson({
      prompt,
      images: [{ data: image.data, mimeType: image.mimeType }],
      temperature: 0.1,
      // Turn Gemma's reasoning off for live Q&A: it drops the answer from ~80s to ~10s with no quality loss.
      thinkingLevel: 'minimal',
      // Enough for a long answer — "read the code" can transcribe a whole screen.
      maxOutputTokens: 2000,
      // Interactive: fail fast instead of stacking retries × timeout. The
      // secondary key still covers a real key failure.
      maxRetries: 0,
      timeoutMs: 30_000,
    });

    // Grounding rule: if Gemma could not answer from the frame, say exactly
    // that rather than passing along a guess.
    const confidence = clamp01(json?.confidence);
    const visible = json?.visible !== false;
    let answer = String(json?.answer || '').trim();

    if (!json && text) {
      // Model ignored the JSON contract but still answered — usable, but we
      // cannot trust a confidence we never received.
      logger.warn(`Q&A response was not JSON at ${time}s`);
      answer = text.replace(/```[\s\S]*?```/g, '').trim();
    }

    const usable = answer && visible && confidence >= config.confidence.critical;

    res.json({
      videoId,
      time,
      question,
      answer: usable
        ? answer
        : answer ||
          'I cannot see that in the current frame. Try moving the video forward a little and asking again.',
      grounded: Boolean(usable),
      confidence,
      visible,
      language,
      model,
    });
  }),
);

/** The question presets the accessible UI offers. */
describeRouter.get('/api/describe/presets', (req, res) => {
  res.json({ presets: QUESTION_PRESETS });
});
