/** Spoken retrieval practice: grading and hints. */
import { Router } from 'express';
import { config } from '../config.js';
import { asyncRoute, badRequest } from '../errors.js';
import { resolveOutputLanguage } from '../lib/lang.js';
import { logger } from '../logger.js';
import { generate, generateJson } from '../services/gemma.js';
import { getVideoInfo, parseVideoId } from '../services/youtube.js';
import { getTranscript } from '../services/transcript.js';
import { getComprehension } from '../services/comprehension.js';
import { buildGradePrompt, buildQuestionsPrompt, buildTimeoutPrompt } from '../prompts/practice.js';

export const practiceRouter = Router();

const VERDICTS = ['correct', 'partial', 'missed'];

/** Generated question sets, keyed by video. Regenerating costs a model call. */
const questionCache = new Map();

/**
 * Tutor questions about the lesson's subject matter.
 *
 * Built from the transcript and the whole-video understanding, not from what
 * Aster happened to describe — so they examine the topic rather than the
 * commentary. `focus` steers which concepts get asked about first.
 */
practiceRouter.post(
  '/api/practice/questions',
  asyncRoute(async (req, res) => {
    const videoId = parseVideoId(req.body?.videoId || req.body?.url);
    const count = Math.min(Math.max(Number.parseInt(req.body?.count, 10) || 5, 3), 8);
    const focus = Array.isArray(req.body?.focus)
      ? req.body.focus.filter((f) => typeof f === 'string').slice(0, 8)
      : [];

    const cacheKey = `${videoId}:${count}:${focus.join('|')}`;
    const cached = questionCache.get(cacheKey);
    if (cached) {
      res.json({ videoId, questions: cached, cached: true });
      return;
    }

    const [info, transcript] = await Promise.all([
      getVideoInfo(videoId).catch(() => ({ title: '' })),
      getTranscript(videoId),
    ]);
    const understanding = await getComprehension({ videoId, info, transcript }).catch(() => null);

    // The transcript is the lesson; cap it so one call cannot blow the context.
    const words = (transcript.cues ?? []).map((cue) => cue.text).join(' ');
    const body = words.length > 16_000 ? `${words.slice(0, 16_000)}\n[…lesson continues]` : words;

    const language = resolveOutputLanguage(config.language.output, transcript.language || 'en');

    const { json } = await generateJson({
      prompt: buildQuestionsPrompt({
        title: info.title || 'this lesson',
        summary: understanding?.summary,
        keyConcepts: understanding?.keyConcepts,
        transcript: body,
        focus,
        count,
        language: language.name,
      }),
      temperature: 0.4,
      maxOutputTokens: 2000,
      thinkingLevel: 'minimal',
    });

    const questions = (json?.questions ?? [])
      .filter((q) => q?.question && q?.answer)
      .slice(0, count)
      .map((q, i) => ({
        id: `q${i + 1}`,
        question: String(q.question).trim(),
        concept: String(q.concept || '').trim() || `idea ${i + 1}`,
        // Named `reference` to match what the grader expects.
        reference: String(q.answer).trim(),
      }));

    if (!questions.length) {
      logger.warn(`Question generation returned nothing usable for ${videoId}`);
      res.json({ videoId, questions: [], degraded: true });
      return;
    }

    questionCache.set(cacheKey, questions);
    res.json({ videoId, questions, cached: false, language: language.code });
  })
);

/**
 * Judges a spoken answer against what Aster originally said.
 *
 * The old client-side judge matched keywords against a fixture rubric, so on a
 * real lesson — where no rubric exists — every answer scored as missed. This
 * asks the model instead, against the description the learner actually heard.
 */
practiceRouter.post(
  '/api/practice/grade',
  asyncRoute(async (req, res) => {
    const concept = String(req.body?.concept || '').trim();
    const question = String(req.body?.question || '').trim();
    const reference = String(req.body?.reference || '').trim();
    const answer = String(req.body?.answer || '').trim();

    if (!concept || !reference) throw badRequest('Provide the `concept` and its `reference` text.');
    if (!answer) throw badRequest('Provide the learner’s `answer`.');
    if (answer.length > 2000) throw badRequest('That answer is too long.');

    const language = resolveOutputLanguage(config.language.output, req.body?.language || 'en');

    const { json, text } = await generateJson({
      prompt: buildGradePrompt({ concept, question, reference, answer, language: language.name }),
      temperature: 0.2,
      maxOutputTokens: 700,
      thinkingLevel: 'minimal',
      maxRetries: 0,
      timeoutMs: 30_000,
    });

    const verdict = VERDICTS.includes(json?.verdict) ? json.verdict : null;
    const feedback = String(json?.feedback || '').trim();

    if (!verdict || !feedback) {
      // The contract slipped but there may still be usable prose. Never leave
      // the learner with silence after they have spoken an answer.
      logger.warn('Practice grading did not return the expected JSON.');
      const fallback = (feedback || text || '').replace(/```[\s\S]*?```/g, '').trim();
      res.json({
        verdict: verdict ?? 'partial',
        feedback: fallback || 'I could not judge that one. Let us keep going.',
        degraded: true,
      });
      return;
    }

    res.json({ verdict, feedback, language: language.code });
  })
);

/** A nudge for a learner who has gone quiet, rather than the answer. */
practiceRouter.post(
  '/api/practice/hint',
  asyncRoute(async (req, res) => {
    const concept = String(req.body?.concept || '').trim();
    const reference = String(req.body?.reference || '').trim();
    if (!concept || !reference) throw badRequest('Provide the `concept` and its `reference` text.');

    const language = resolveOutputLanguage(config.language.output, req.body?.language || 'en');
    const { text } = await generate({
      prompt: buildTimeoutPrompt({ concept, reference, language: language.name }),
      temperature: 0.3,
      maxOutputTokens: 400,
      thinkingLevel: 'minimal',
      maxRetries: 0,
      timeoutMs: 25_000,
    });

    res.json({ hint: text.trim() });
  })
);

export default practiceRouter;
