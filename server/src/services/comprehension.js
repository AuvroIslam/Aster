/** Video comprehension pass — the "understand the whole thing first" stage. */
import { logger } from '../logger.js';
import { readJson, writeJson } from '../lib/cache.js';
import { clamp01 } from '../lib/json.js';
import { languageName } from '../lib/lang.js';
import { generateJson } from './gemma.js';

/** Bump when the prompt changes so stale understandings are not reused. */
export const COMPREHENSION_VERSION = 2;

/** The domains we tune description behaviour for. */
export const DOMAINS = ['coding', 'math', 'data', 'ui', 'science', 'general'];

/** Flatten a transcript to plain narration text, lightly capped for the prompt. */
function transcriptText(cues, maxChars = 16000) {
  const full = cues.map((cue) => cue.text).join(' ');
  if (full.length <= maxChars) return full;
  // Keep the beginning and end — intros state the topic, conclusions recap it.
  const head = full.slice(0, Math.floor(maxChars * 0.7));
  const tail = full.slice(-Math.floor(maxChars * 0.3));
  return `${head}\n[…middle of transcript omitted for length…]\n${tail}`;
}

function buildPrompt({ title, channel, durationMinutes, transcript, narrationLanguage }) {
  const languageNote =
    narrationLanguage && narrationLanguage.toLowerCase() !== 'english'
      ? `\nThe transcript is in ${narrationLanguage}. Understand it in ${narrationLanguage}, but write the JSON field values in English — they are internal planning notes, not shown to the learner.\n`
      : '';
  return `You are the planning stage of VisionBridge, an audio-description assistant for blind and low-vision learners. You are reading an educational video's title and full transcript BEFORE any frames are looked at, to build a compact understanding that will guide the rest of the system.

You cannot see the video yet. Reason only from the words below.
${languageNote}
TITLE: ${title || '(unknown)'}
${channel ? `CHANNEL: ${channel}\n` : ''}LENGTH: about ${durationMinutes} minutes

FULL TRANSCRIPT:
"""
${transcript}
"""

Produce a compact plan as JSON. Be concrete and specific to THIS video — not generic.

- domain: the single best fit from ["coding","math","data","ui","science","general"].
    coding = writing/reading source code, terminals, IDEs.
    math = equations, proofs, mathematical notation, graphs of functions.
    data = charts, plots, dashboards, data analysis.
    ui = navigating software, clicking buttons, menus, settings.
    science = diagrams, processes, labelled figures, experiments.
    general = none of the above dominates.
- summary: one or two sentences on what the learner is meant to understand by the end.
- keyConcepts: 3 to 8 short concept names this video builds on or introduces.
- expectedVisuals: the on-screen things most likely to carry information the narration will NOT fully put into words (e.g. "a plotted sigmoid curve", "a neural-network diagram", "code defining a function", "a terminal showing output"). 3 to 7 items.
- glossary: up to 8 terms whose spoken form is not obvious, each as {"term","say"} where "say" is how to pronounce or phrase it aloud for the ear (e.g. {"term":"σ(x)","say":"sigma of x"}, {"term":"numpy","say":"num-pie"}). Omit if none.
- guidance: one sentence of advice to the describer about what matters most visually in THIS video and what to leave to the narration.

Reply with JSON only, no prose, no markdown fence:
{"domain":"","summary":"","keyConcepts":[],"expectedVisuals":[],"glossary":[{"term":"","say":""}],"guidance":""}`;
}

/** Coerce whatever Gemma returned into a safe, well-typed understanding. */
export function normaliseComprehension(json, fallback = {}) {
  const domain = DOMAINS.includes(json?.domain) ? json.domain : 'general';
  const arr = (value, cap) =>
    Array.isArray(value)
      ? value
          .filter((v) => typeof v === 'string')
          .map((v) => v.trim())
          .filter(Boolean)
          .slice(0, cap)
      : [];
  const glossary = Array.isArray(json?.glossary)
    ? json.glossary
        .map((g) => ({ term: String(g?.term || '').trim(), say: String(g?.say || '').trim() }))
        .filter((g) => g.term && g.say)
        .slice(0, 8)
    : [];

  return {
    domain,
    summary: String(json?.summary || fallback.summary || '').trim(),
    keyConcepts: arr(json?.keyConcepts, 8),
    expectedVisuals: arr(json?.expectedVisuals, 7),
    glossary,
    guidance: String(json?.guidance || '').trim(),
    confidence: clamp01(json?.confidence ?? 1),
  };
}

/** Builds (or returns the cached) understanding for a video. */
export async function getComprehension({ videoId, info, transcript, refresh = false }) {
  const cacheName = `${videoId}.comprehension.json`;
  if (!refresh) {
    const cached = await readJson('data', cacheName);
    if (cached && cached.version === COMPREHENSION_VERSION) return cached.understanding;
  }

  const prompt = buildPrompt({
    title: info?.title,
    channel: info?.channel,
    durationMinutes: Math.max(1, Math.round((info?.duration || transcript.duration || 0) / 60)),
    transcript: transcriptText(transcript.cues || []),
    narrationLanguage: languageName(transcript.language || 'en'),
  });

  let understanding;
  try {
    // Text-only: no image. Reasoning here is worth a generous ceiling since it
    // reads the whole transcript, but there is exactly one call per video.
    const { json } = await generateJson({ prompt, temperature: 0.2, maxOutputTokens: 2500 });
    understanding = normaliseComprehension(json, { summary: info?.title });
  } catch (err) {
    // Never block the pipeline on the planning stage — fall back to a neutral
    // understanding and let per-frame grounding do the work.
    logger.warn(`Comprehension pass failed for ${videoId}: ${err.message}`);
    understanding = normaliseComprehension(null, { summary: info?.title });
  }

  logger.info(
    `Comprehension for ${videoId}: domain=${understanding.domain}, ` +
      `${understanding.keyConcepts.length} concepts, ${understanding.expectedVisuals.length} expected visuals`,
  );
  await writeJson('data', cacheName, { version: COMPREHENSION_VERSION, understanding });
  return understanding;
}

/** Renders the understanding into a compact context block for a per-frame prompt. */
export function comprehensionContextBlock(understanding) {
  if (!understanding) return '';
  const lines = [`This video's topic: ${understanding.summary || '(unknown)'}`];
  if (understanding.keyConcepts.length) {
    lines.push(`Key concepts: ${understanding.keyConcepts.join(', ')}.`);
  }
  if (understanding.expectedVisuals.length) {
    lines.push(`Visuals likely to carry unspoken information: ${understanding.expectedVisuals.join('; ')}.`);
  }
  if (understanding.glossary.length) {
    lines.push(
      `Say these terms aloud like this: ${understanding.glossary
        .map((g) => `${g.term} → "${g.say}"`)
        .join('; ')}.`,
    );
  }
  if (understanding.guidance) lines.push(`Focus: ${understanding.guidance}`);
  return lines.join('\n');
}
