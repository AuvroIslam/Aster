'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSpeech } from '@/components/learn/use-speech';

/**
 * How the document is being read aloud.
 *
 * `auto` walks the pages on its own; `follow` explains whatever page the
 * learner has scrolled to. They are mutually exclusive — two voices talking
 * over each other is the failure this whole product exists to avoid.
 */
export type ReadingMode = 'idle' | 'auto' | 'follow';

/**
 * What Aster is doing right now, so the reader can say so.
 *
 * Without this the surface looks broken during the seconds between scrolling
 * and the voice starting: the model takes a few seconds to answer, and silence
 * is indistinguishable from a bug.
 */
export type ReadingStatus =
  | { kind: 'idle' }
  | { kind: 'settling'; page: number }
  | { kind: 'thinking'; page: number }
  | { kind: 'speaking'; page: number };

/** How long the learner must rest on a page before Aster starts talking. */
const SETTLE_MS = 650;

export function useReading(docId: string | null, pages: number) {
  const [mode, setMode] = useState<ReadingMode>('idle');
  const [status, setStatus] = useState<ReadingStatus>({ kind: 'idle' });
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  /** Page number → explanation, as they arrive. */
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const { speak, cancel, supported } = useSpeech();

  const modeRef = useRef<ReadingMode>('idle');
  modeRef.current = mode;
  const abortRef = useRef<AbortController | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The page follow mode is currently working on, so it does not repeat it. */
  const followingRef = useRef<number | null>(null);
  /** Explanations already fetched, readable synchronously inside the walk. */
  const cacheRef = useRef<Record<number, string>>({});

  const clearSettle = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  };

  const stop = useCallback(() => {
    modeRef.current = 'idle';
    setMode('idle');
    clearSettle();
    followingRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    cancel();
    setStatus({ kind: 'idle' });
  }, [cancel]);

  useEffect(
    () => () => {
      clearSettle();
      abortRef.current?.abort();
    },
    []
  );

  /** Fetches one page's explanation, reusing anything already fetched. */
  const explainPage = useCallback(
    async (page: number): Promise<string | null> => {
      if (!docId) return null;
      const cached = cacheRef.current[page];
      if (cached) return cached;

      const controller = new AbortController();
      abortRef.current = controller;
      setStatus({ kind: 'thinking', page });
      setError(null);

      try {
        const result = await api.explainPage(docId, page, controller.signal);
        cacheRef.current[page] = result.explanation;
        setExplanations((prev) => ({ ...prev, [page]: result.explanation }));
        return result.explanation;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return null;
        setError(err instanceof ApiError ? err.message : 'Could not reach the Aster server.');
        setStatus({ kind: 'idle' });
        return null;
      }
    },
    [docId]
  );

  /** Explain a page and read it out. Resolves true only if it finished. */
  const readPage = useCallback(
    async (page: number) => {
      const text = await explainPage(page);
      if (!text) return false;
      setStatus({ kind: 'speaking', page });
      const result = await speak(text);
      // Only clear the status if nothing newer has taken over since.
      setStatus((current) =>
        current.kind === 'speaking' && current.page === page ? { kind: 'idle' } : current
      );
      return !result.cancelled;
    },
    [explainPage, speak]
  );

  /** The whole-document orientation. */
  const readSummary = useCallback(async () => {
    if (!docId) return;
    stop();
    setSummaryLoading(true);
    setError(null);
    try {
      const text = summary ?? (await api.docSummary(docId)).summary;
      setSummary(text);
      setSummaryLoading(false);
      await speak(text);
    } catch (err) {
      setSummaryLoading(false);
      setError(err instanceof ApiError ? err.message : 'Could not reach the Aster server.');
    }
  }, [docId, summary, speak, stop]);

  /**
   * Walks the document from a given page: explain, speak, scroll on, repeat.
   *
   * `currentPage` is what the reader scrolls to, so during the walk the voice
   * drives it and scroll position must not — see `onPageInView`, which stands
   * down in auto mode. Otherwise the observer would report whatever page the
   * smooth scroll was passing over, and the walk would chase its own tail.
   */
  const startAuto = useCallback(
    async (from = 1) => {
      if (!docId) return;
      cancel();
      clearSettle();
      modeRef.current = 'auto';
      setMode('auto');
      setError(null);

      for (let page = from; page <= pages; page += 1) {
        if (modeRef.current !== 'auto') break;
        setCurrentPage(page);
        const finished = await readPage(page);
        // A cancelled utterance means the learner took over; stop walking.
        if (!finished || modeRef.current !== 'auto') break;
      }

      if (modeRef.current === 'auto') {
        modeRef.current = 'idle';
        setMode('idle');
        setStatus({ kind: 'idle' });
      }
    },
    [docId, pages, readPage, cancel]
  );

  /** Follow-along: explain whatever page the learner settles on. */
  const startFollow = useCallback(() => {
    cancel();
    modeRef.current = 'follow';
    followingRef.current = null;
    setMode('follow');
    setError(null);
    setStatus({ kind: 'settling', page: currentPage });

    // Start on the page already in view rather than waiting for a scroll —
    // turning it on and having nothing happen reads as broken.
    clearSettle();
    settleTimer.current = setTimeout(() => {
      if (modeRef.current !== 'follow') return;
      followingRef.current = currentPage;
      void readPage(currentPage);
    }, SETTLE_MS);
  }, [cancel, currentPage, readPage]);

  /**
   * Called by the reader as the page in view changes.
   *
   * Scrolling to a new page is a deliberate act, so it wins: whatever is being
   * said is cut off and the new page is explained instead. The earlier version
   * dropped the page whenever the voice was busy, which meant scrolling during
   * an explanation silently did nothing at all.
   *
   * The settle delay stops it firing for every page flicking past during a
   * long scroll — only the page actually rested on is explained.
   */
  const onPageInView = useCallback(
    (page: number) => {
      // In auto mode the voice leads and the scroll follows, not the reverse.
      if (modeRef.current === 'auto') return;

      setCurrentPage(page);
      if (modeRef.current !== 'follow') return;
      if (followingRef.current === page) return;

      clearSettle();
      setStatus({ kind: 'settling', page });
      settleTimer.current = setTimeout(() => {
        if (modeRef.current !== 'follow') return;
        followingRef.current = page;
        cancel();
        void readPage(page);
      }, SETTLE_MS);
    },
    [cancel, readPage]
  );

  /** Moves to a page and, if a mode is running, explains it there. */
  const goToPage = useCallback(
    (page: number) => {
      const target = Math.min(pages, Math.max(1, page));
      clearSettle();
      followingRef.current = target;
      setCurrentPage(target);
      if (modeRef.current !== 'idle') {
        cancel();
        void readPage(target);
      }
      return target;
    },
    [pages, cancel, readPage]
  );

  return {
    mode,
    status,
    goToPage,
    summary,
    summaryLoading,
    explanations,
    currentPage,
    error,
    speechSupported: supported,
    readSummary,
    startAuto,
    startFollow,
    stop,
    explainPage,
    readPage,
    onPageInView,
  };
}

export default useReading;
