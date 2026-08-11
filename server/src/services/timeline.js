/** Description timeline generation — Phase 3 of the spec. */
import { config } from '../config.js';
import { logger } from '../logger.js';
import { clamp01 } from '../lib/json.js';
import { resolveOutputLanguage } from '../lib/lang.js';
import { hashKey, readJson, writeJson } from '../lib/cache.js';
import { activeModel, generateJson } from './gemma.js';
import { buildDecisionPrompt } from '../prompts/describe.js';
import { contextAround, getTranscript } from './transcript.js';
import { buildCandidates } from './gaps.js';
import { extractFrame, frameToBase64 } from './frames.js';
import { downloadVideo, getVideoInfo } from './youtube.js';
import { comprehensionContextBlock, getComprehension } from './comprehension.js';

/** Bump when the prompt or decision schema changes so old timelines are not reused. */
export const PROMPT_VERSION = 4;

/** Signals that a description carries information a learner cannot do without. */
const CRITICAL_PATTERN =
  /\b(code|function|class|variable|loop|import|error|exception|traceback|terminal|console|output|command|prints?|returns?|clicks?|clicked|selects?|button|menu|tab|graph|chart|axis|diagram|flowchart|equation|formula|value|result|highlight\w*)\b/i;

export const isCriticalDescription = (text) => CRITICAL_PATTERN.test(String(text || ''));

/** Words carrying no distinguishing content, ignored when comparing descriptions. */
const STOP_WORDS = new Set(
  'a an the is are of to and with in on at it its this that these those has have shows show showing display displays below above left right top bottom side'.split(
    ' ',
  ),
);

const tokenSet = (text) =>
  new Set(
    String(text || '')
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((word) => !STOP_WORDS.has(word)) || [],
  );

/** Overlap coefficient between two descriptions: |A∩B| / min(|A|,|B|). */
export function descriptionSimilarity(a, b) {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const word of small) if (large.has(word)) shared += 1;
  return shared / small.size;
}

/** Finds an already-accepted description that `text` essentially repeats. */
export function findNearDuplicate(text, accepted, threshold = 0.72) {
  if (tokenSet(text).size < 10) return null;
  for (const prior of accepted) {
    if (tokenSet(prior.description).size < 10) continue;
    if (descriptionSimilarity(text, prior.description) >= threshold) return prior;
  }
  return null;
}

/** Coerces whatever Gemma returned into the timeline contract. */
export function normaliseDecision(json) {
  const empty = { needed: false, mode: 'brief', visualType: 'other', description: '', confidence: 0 };
  if (!json || typeof json !== 'object') return empty;

  const needed =
    json.needed === true ||
    json.needed === 'true' ||
    json.needed === 1 ||
    json.needed === 'yes';

  const description = String(json.description ?? json.text ?? '')
    .replace(/^\s*(the\s+)?(image|frame|screen|video)\s+(shows|displays)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const confidence = clamp01(json.confidence ?? json.score);
  const mode = json.mode === 'explain' ? 'explain' : 'brief';
  const visualType = String(json.visualType || 'other')
    .toLowerCase()
    .replace(/[^a-z]/g, '') || 'other';

  // A "needed" verdict with nothing to say is not a description.
  if (!needed || !description) return { ...empty, confidence };
  return { needed: true, mode, visualType, description, confidence };
}

/** Applies the confidence rules from spec §11. */
export function applyConfidenceRules(decision, candidate = {}, thresholds = config.confidence) {
  if (!decision.needed) {
    return { accepted: false, tier: 'not_needed', reason: 'Gemma decided no description was needed' };
  }
  if (decision.confidence >= thresholds.high) {
    return { accepted: true, tier: 'high', reason: 'High confidence' };
  }
  if (decision.confidence >= thresholds.critical) {
    // Middle band (spec §11): speak only when the content is genuinely critical.
    const visualType = decision.visualType || 'other';
    const critical = isCriticalDescription(decision.description) || visualType !== 'other';
    if (!critical) {
      return { accepted: false, tier: 'conditional', reason: 'Medium confidence and not critical' };
    }
    if (decision.mode === 'explain') {
      return { accepted: true, tier: 'conditional', reason: 'Critical visual worth a full explanation' };
    }
    if (!candidate.requiresPause) {
      return { accepted: true, tier: 'conditional', reason: 'Critical visual information' };
    }
    return {
      accepted: false,
      tier: 'conditional',
      reason: 'Medium-confidence brief pointer, not worth pausing the video',
    };
  }
  return { accepted: false, tier: 'low', reason: 'Confidence below threshold — staying silent' };
}

/** Cache key covering every input that can change the result. */
function timelineKey(videoId, settings, model, outputLang) {
  const signature = hashKey({
    model,
    promptVersion: PROMPT_VERSION,
    outputLang,
    minGapSeconds: settings.minGapSeconds,
    minSpacingSeconds: settings.minSpacingSeconds,
    forcedCandidateInterval: settings.forcedCandidateInterval,
    maxCandidates: settings.maxCandidates,
    high: settings.confidenceHigh,
    critical: settings.confidenceCritical,
  });
  return `${videoId}.timeline.${signature}.json`;
}

/** Builds (or returns the cached) description timeline for a video. */
export async function generateTimeline({ videoId, options = {}, refresh = false, onProgress }) {
  const settings = {
    minGapSeconds: config.pipeline.minGapSeconds,
    minSpacingSeconds: config.pipeline.minSpacingSeconds,
    forcedCandidateInterval: config.pipeline.forcedCandidateInterval,
    maxCandidates: config.pipeline.maxCandidates,
    confidenceHigh: config.confidence.high,
    confidenceCritical: config.confidence.critical,
    ...options,
  };

  const report = (stage, percent, message) => {
    logger.debug(`[${videoId}] ${stage} ${percent}% ${message}`);
    onProgress?.({ stage, percent: Math.round(percent), message });
  };

  const model = await activeModel();

  report('metadata', 4, 'Reading video details');
  const info = await getVideoInfo(videoId);

  report('transcript', 12, 'Extracting the transcript');
  const transcript = await getTranscript(videoId);

  // Output language keys the timeline cache, so resolve it before the cache check.
  const language = resolveOutputLanguage(config.language.output, transcript.language);
  const cacheName = timelineKey(videoId, settings, model, language.code);

  if (!refresh) {
    const cached = await readJson('data', cacheName);
    if (cached) {
      report('cached', 100, 'Using the cached description timeline');
      return { ...cached, cached: true };
    }
  }

  // Understand the whole video first (title + full transcript), so every
  // per-frame decision is conditioned on the lesson as a whole.
  report('comprehension', 16, 'Reading the whole video to understand the lesson');
  const understanding = await getComprehension({ videoId, info, transcript, refresh });
  const comprehensionBlock = comprehensionContextBlock(understanding);

  report('gaps', 22, 'Finding natural pauses in the narration');
  const candidates = buildCandidates({
    cues: transcript.cues,
    duration: info.duration || transcript.duration,
    options: settings,
  });

  if (!candidates.length) {
    const empty = emptyTimeline({ videoId, info, transcript, model, settings, understanding, language });
    await writeJson('data', cacheName, empty);
    report('done', 100, 'No description points were needed');
    return empty;
  }

  report('download', 26, 'Downloading the video for frame extraction');
  await downloadVideo(videoId);

  report('describe', 30, `Asking Gemma about ${candidates.length} moments`);

  const thresholds = { high: settings.confidenceHigh, critical: settings.confidenceCritical };
  const accepted = [];
  const rejected = [];
  let completed = 0;

  // Time-ordered in small concurrent chunks, so duplicate suppression sees earlier results.
  const chunkSize = Math.max(1, config.gemma.concurrency);
  for (let start = 0; start < candidates.length; start += chunkSize) {
    const chunk = candidates.slice(start, start + chunkSize);
    const spokenSoFar = accepted.map((item) => item.description);

    const results = await Promise.all(
      chunk.map((candidate) =>
        describeCandidate({
          videoId,
          candidate,
          transcript,
          videoTitle: info.title,
          alreadyDescribed: spokenSoFar,
          understanding,
          comprehensionBlock,
          language,
        }),
      ),
    );

    for (const result of results) {
      completed += 1;
      const verdict = applyConfidenceRules(result.decision, result.candidate, thresholds);
      // A full explanation always pauses the video (Extended AD): it is longer
      // than any natural gap, and the whole point is to deliver it completely.
      const requiresPause = result.candidate.requiresPause || result.decision.mode === 'explain';
      const entry = {
        time: result.candidate.time,
        description: result.decision.description,
        mode: result.decision.mode,
        visualType: result.decision.visualType,
        confidence: Number(result.decision.confidence.toFixed(2)),
        requiresPause,
        gapDuration: result.candidate.gapDuration,
        gapEnd: result.candidate.gapEnd,
        tier: verdict.tier,
      };
      if (!verdict.accepted) {
        rejected.push({ ...entry, reason: verdict.reason, error: result.error });
        continue;
      }
      // Catch a description that repeats a persistent visual already covered earlier (the same graph or.
      const duplicate = findNearDuplicate(entry.description, accepted);
      if (duplicate) {
        rejected.push({
          ...entry,
          tier: 'duplicate',
          reason: `Repeats the description already given at ${duplicate.time.toFixed(0)}s`,
        });
      } else {
        accepted.push(entry);
      }
    }

    report(
      'describe',
      30 + (completed / candidates.length) * 68,
      `Analysed ${completed} of ${candidates.length} moments — ${accepted.length} descriptions so far`,
    );
  }

  accepted.sort((a, b) => a.time - b.time);

  const timeline = {
    videoId,
    title: info.title,
    duration: info.duration || transcript.duration,
    model,
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    settings,
    // Language descriptions are written and spoken in — the client uses this to
    // pick a matching speech voice.
    language,
    understanding,
    descriptions: accepted,
    stats: {
      candidates: candidates.length,
      naturalPauseCandidates: candidates.filter((c) => !c.requiresPause).length,
      forcedCandidates: candidates.filter((c) => c.requiresPause).length,
      accepted: accepted.length,
      rejected: rejected.length,
      explanations: accepted.filter((d) => d.mode === 'explain').length,
      duplicatesSuppressed: rejected.filter((d) => d.tier === 'duplicate').length,
      byTier: countBy(accepted, 'tier'),
      rejectedByTier: countBy(rejected, 'tier'),
      transcriptCues: transcript.cues.length,
      automaticCaptions: transcript.automatic,
      domain: understanding.domain,
    },
    cached: false,
  };

  await writeJson('data', cacheName, timeline);
  logger.info(
    `Timeline for ${videoId}: ${accepted.length} descriptions from ${candidates.length} candidates`,
  );
  report('done', 100, `Ready — ${accepted.length} descriptions prepared`);
  return timeline;
}

/** One candidate: frame -> Gemma -> normalised decision. */
async function describeCandidate({
  videoId,
  candidate,
  transcript,
  videoTitle,
  alreadyDescribed,
  understanding,
  comprehensionBlock,
  language,
}) {
  try {
    const framePath = await extractFrame(videoId, candidate.frameTime);
    const data = await frameToBase64(framePath);
    const context = contextAround(transcript.cues, candidate.time);

    const prompt = buildDecisionPrompt({
      time: candidate.time,
      context,
      wordBudget: candidate.wordBudget,
      alreadyDescribed,
      videoTitle,
      understanding,
      comprehensionBlock,
      pauseAvailable: !candidate.requiresPause,
      language,
    });

    const image = [{ data, mimeType: 'image/jpeg' }];

    // Gemma 4 always reasons first, and that reasoning is billed against maxOutputTokens, so the answer.
    const budgets = [3000, 6000];
    let json = null;
    let text = '';
    for (let attempt = 0; attempt < budgets.length; attempt += 1) {
      const result = await generateJson({
        prompt,
        images: image,
        temperature: 0.1,
        maxOutputTokens: budgets[attempt],
      });
      json = result.json;
      text = result.text;
      if (json || result.finishReason !== 'MAX_TOKENS') break;
      if (attempt + 1 < budgets.length) {
        logger.warn(
          `Decision at ${candidate.time}s truncated at ${budgets[attempt]} tokens — ` +
            `retrying with ${budgets[attempt + 1]}`,
        );
      }
    }

    if (!json) {
      logger.warn(`Unparseable decision at ${candidate.time}s: ${text.slice(0, 120)}`);
    }
    return { candidate, decision: normaliseDecision(json) };
  } catch (err) {
    // A failure must never become a guess: fall through as "no description".
    logger.warn(`Description failed at ${candidate.time}s: ${err.message}`);
    return {
      candidate,
      decision: normaliseDecision(null),
      error: err.message,
    };
  }
}

function emptyTimeline({ videoId, info, transcript, model, settings, understanding, language }) {
  return {
    videoId,
    title: info.title,
    duration: info.duration || transcript.duration,
    model,
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    settings,
    language: language || null,
    understanding: understanding || null,
    descriptions: [],
    stats: {
      candidates: 0,
      naturalPauseCandidates: 0,
      forcedCandidates: 0,
      accepted: 0,
      rejected: 0,
      explanations: 0,
      byTier: {},
      rejectedByTier: {},
      transcriptCues: transcript.cues.length,
      automaticCaptions: transcript.automatic,
      domain: understanding?.domain || 'general',
    },
    cached: false,
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}
