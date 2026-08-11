'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type WireDescription, type WireTimeline } from '@/lib/api';
import type { Description, Lesson, VisualKind } from '@/lib/types';

export type LessonPhase = 'idle' | 'loading' | 'processing' | 'ready' | 'error';

export interface LessonProgress {
  percent: number;
  step: string;
}

/** The server may not name a visual kind; infer one so the UI can pick an icon. */
function inferKind(description: WireDescription): VisualKind {
  const declared = description.kind?.toLowerCase();
  if (declared && ['code', 'terminal', 'diagram', 'graph', 'formula', 'slide'].includes(declared)) {
    return declared as VisualKind;
  }

  const text = description.text.toLowerCase();
  if (/\bterminal\b|\bconsole\b|\bcommand\b|\boutput\b/.test(text)) return 'terminal';
  if (/\bcode\b|\bfunction\b|\bvariable\b|\bsyntax\b/.test(text)) return 'code';
  if (/\bgraph\b|\bplot\b|\bchart\b|\baxis\b/.test(text)) return 'graph';
  if (/\bformula\b|\bequation\b/.test(text)) return 'formula';
  if (/\bslide\b|\btitle\b/.test(text)) return 'slide';
  return 'diagram';
}

/**
 * Concepts drive the practice set, so every description needs one. When the
 * model does not supply it, fall back to the opening clause of the description
 * — imperfect, but it keeps gap-driven practice working on real videos.
 */
function conceptFor(description: WireDescription): string {
  if (description.concept?.trim()) return description.concept.trim();
  const firstClause = description.text.split(/[,.;:]/)[0] ?? description.text;
  return firstClause.trim().slice(0, 60).toLowerCase();
}

function toDescription(wire: WireDescription, index: number): Description {
  return {
    id: wire.id ?? `d${index}-${Math.round(wire.time * 100)}`,
    time: wire.time,
    mode: wire.mode ?? 'brief',
    kind: inferKind(wire),
    text: wire.text,
    confidence: wire.confidence ?? 0.9,
    concept: conceptFor(wire),
  };
}

export function toLesson(timeline: WireTimeline, meta: {
  title: string;
  channel: string;
  duration: number;
}): Lesson {
  return {
    id: timeline.videoId,
    title: meta.title,
    channel: meta.channel,
    duration: meta.duration,
    language: timeline.language ?? 'auto',
    consideredMoments: timeline.consideredMoments ?? timeline.candidateCount ?? 0,
    descriptions: (timeline.descriptions ?? []).map(toDescription),
  };
}

/**
 * Loads a YouTube URL end to end: metadata, then the description timeline as a
 * background job with progress. Processing is front-loaded and cached server
 * side, so a second viewing of the same video returns almost immediately.
 */
export function useLesson() {
  const [phase, setPhase] = useState<LessonPhase>('idle');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [progress, setProgress] = useState<LessonProgress>({ percent: 0, step: '' });
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      stopPolling();
    },
    [stopPolling]
  );

  const load = useCallback(
    async (url: string) => {
      cancelledRef.current = false;
      stopPolling();
      setError(null);
      setLesson(null);
      setPhase('loading');
      setProgress({ percent: 0, step: 'Reading the video' });

      try {
        const info = await api.videoInfo(url);
        if (cancelledRef.current) return;

        setVideoId(info.id);
        setPhase('processing');
        setProgress({ percent: 5, step: 'Understanding the lesson' });

        const { jobId } = await api.startProcessing(url);
        if (cancelledRef.current) return;

        const poll = async () => {
          if (cancelledRef.current) return;

          try {
            const status = await api.jobStatus(jobId);

            if (status.state === 'error') {
              setError(status.error?.message ?? 'Processing failed.');
              setPhase('error');
              return;
            }

            setProgress({
              percent: Math.round((status.progress ?? 0) * 100) || 10,
              step: status.step ?? status.message ?? 'Describing what matters',
            });

            if (status.state === 'done' && status.result) {
              setLesson(
                toLesson(status.result, {
                  title: info.title,
                  channel: info.channel ?? info.uploader ?? '',
                  duration: info.duration,
                })
              );
              setPhase('ready');
              return;
            }

            pollRef.current = setTimeout(poll, 1500);
          } catch (err) {
            if (cancelledRef.current) return;
            setError(err instanceof ApiError ? err.message : 'Lost contact with the server.');
            setPhase('error');
          }
        };

        void poll();
      } catch (err) {
        if (cancelledRef.current) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not reach the Aster server. Is it running on port 5174?'
        );
        setPhase('error');
      }
    },
    [stopPolling]
  );

  const clear = useCallback(() => {
    cancelledRef.current = true;
    stopPolling();
    setPhase('idle');
    setLesson(null);
    setVideoId(null);
    setError(null);
  }, [stopPolling]);

  return { phase, lesson, videoId, progress, error, load, clear };
}
