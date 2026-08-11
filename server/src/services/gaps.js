/** Speech-timestamp and gap detection. */
import { config } from '../config.js';

/** Merges cues into continuous speech intervals. */
export function speechIntervals(cues, mergeThreshold = 0.35) {
  const sorted = [...cues]
    .filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.end > cue.start)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const cue of sorted) {
    const last = merged[merged.length - 1];
    if (last && cue.start - last.end <= mergeThreshold) {
      last.end = Math.max(last.end, cue.end);
    } else {
      merged.push({ start: cue.start, end: cue.end });
    }
  }
  return merged;
}

/** The complement of `intervals` — the silences. */
export function findGaps(intervals, minGap = config.pipeline.minGapSeconds) {
  const gaps = [];
  for (let i = 0; i < intervals.length - 1; i += 1) {
    const start = intervals[i].end;
    const end = intervals[i + 1].start;
    const duration = end - start;
    if (duration >= minGap) gaps.push({ start, end, duration });
  }
  return gaps;
}

/** How many words fit in a gap at normal speech-synthesis speed. */
export function wordBudget(gapDuration, wordsPerSecond = 2.8) {
  return Math.max(0, Math.floor(gapDuration * wordsPerSecond));
}

/** Builds the candidate timestamps that Gemma will be asked about. */
export function buildCandidates({ cues, duration, options = {} }) {
  const settings = {
    minGapSeconds: config.pipeline.minGapSeconds,
    minSpacingSeconds: config.pipeline.minSpacingSeconds,
    forcedCandidateInterval: config.pipeline.forcedCandidateInterval,
    maxCandidates: config.pipeline.maxCandidates,
    ...options,
  };

  const intervals = speechIntervals(cues);
  if (!intervals.length) return [];

  const videoEnd = Number.isFinite(duration) ? duration : intervals[intervals.length - 1].end;
  const gaps = findGaps(intervals, settings.minGapSeconds);

  /** @type {Array} */
  const candidates = [];

  for (const gap of gaps) {
    // Speak just after narration stops; look at the frame just *before* it
    // stopped, because that is the visual the instructor was talking over.
    const time = round(gap.start + 0.15);
    candidates.push({
      time,
      frameTime: round(Math.max(0, gap.start - 0.4)),
      gapStart: round(gap.start),
      gapEnd: round(gap.end),
      gapDuration: round(gap.duration),
      requiresPause: false,
      wordBudget: Math.min(14, wordBudget(gap.duration)),
      kind: 'pause',
    });
  }

  // Extended AD: long unbroken narration still needs coverage.
  for (const interval of intervals) {
    const length = interval.end - interval.start;
    if (length < settings.forcedCandidateInterval) continue;
    const steps = Math.floor(length / settings.forcedCandidateInterval);
    for (let step = 1; step <= steps; step += 1) {
      const time = round(interval.start + step * settings.forcedCandidateInterval);
      if (time >= videoEnd - 1) continue;
      candidates.push({
        time,
        frameTime: time,
        gapStart: time,
        gapEnd: time,
        gapDuration: 0,
        requiresPause: true,
        wordBudget: 12,
        kind: 'forced',
      });
    }
  }

  return limitCandidates(candidates, settings);
}

/** Enforces minimum spacing and the hard ceiling on Gemma calls. */
export function limitCandidates(candidates, settings) {
  const ordered = [...candidates].sort((a, b) => a.time - b.time);

  const spaced = [];
  for (const candidate of ordered) {
    const previous = spaced[spaced.length - 1];
    if (!previous || candidate.time - previous.time >= settings.minSpacingSeconds) {
      spaced.push(candidate);
      continue;
    }
    // Too close to the one we already kept — keep whichever is the better
    // speaking opportunity rather than blindly taking the earlier one.
    const better =
      (candidate.kind === 'pause' && previous.kind === 'forced') ||
      (candidate.kind === previous.kind && candidate.gapDuration > previous.gapDuration);
    if (better) spaced[spaced.length - 1] = candidate;
  }

  if (spaced.length <= settings.maxCandidates) return spaced;

  // Over budget: keep the best opportunities, then restore time order.
  const ranked = [...spaced].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'pause' ? -1 : 1;
    return b.gapDuration - a.gapDuration;
  });
  return ranked.slice(0, settings.maxCandidates).sort((a, b) => a.time - b.time);
}

const round = (value) => Math.round(value * 100) / 100;
