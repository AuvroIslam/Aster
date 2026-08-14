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

export function useReading(docId: string | null, pages: number) {
  const [mode, setMode] = useState<ReadingMode>('idle');
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  /** Page number → explanation, as they arrive. */
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [busyPage, setBusyPage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const { speak, cancel, speaking, supported } = useSpeech();
  const modeRef = useRef<ReadingMode>('idle');
  modeRef.current = mode;
  const abortRef = useRef<AbortController | null>(null);
  /** Pages already fetched, so scrolling back does not refetch. */
  const seenRef = useRef<Set<number>>(new Set());

  const stop = useCallback(() => {
    modeRef.current = 'idle';
    setMode('idle');
    abortRef.current?.abort();
    abortRef.current = null;
    cancel();
    setBusyPage(null);
  }, [cancel]);

  // Leaving the page must not leave a voice running.
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  /** Fetches one page's explanation, reusing anything already fetched. */
  const explainPage = useCallback(
    async (page: number): Promise<string | null> => {
      if (!docId) return null;
      const existing = explanations[page];
      if (existing) return existing;

      const controller = new AbortController();
      abortRef.current = controller;
      setBusyPage(page);
      setError(null);

      try {
        const result = await api.explainPage(docId, page, controller.signal);
        setExplanations((prev) => ({ ...prev, [page]: result.explanation }));
        seenRef.current.add(page);
        return result.explanation;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return null;
        setError(err instanceof ApiError ? err.message : 'Could not reach the Aster server.');
        return null;
      } finally {
        setBusyPage((current) => (current === page ? null : current));
      }
    },
    [docId, explanations]
  );

  /** Explain a page and read it out, as one step. */
  const readPage = useCallback(
    async (page: number) => {
      const text = await explainPage(page);
      if (!text) return false;
      const result = await speak(text);
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
      const existing = summary ?? (await api.docSummary(docId)).summary;
      setSummary(existing);
      setSummaryLoading(false);
      await speak(existing);
    } catch (err) {
      setSummaryLoading(false);
      setError(err instanceof ApiError ? err.message : 'Could not reach the Aster server.');
    }
  }, [docId, summary, speak, stop]);

  /**
   * Walks the document from the current page, one page at a time. Each page is
   * fetched, spoken, and only then does it move on — so the explanation is
   * never cut off by the next one starting.
   */
  const startAuto = useCallback(
    async (from = 1) => {
      if (!docId) return;
      cancel();
      modeRef.current = 'auto';
      setMode('auto');
      setError(null);

      for (let page = from; page <= pages; page += 1) {
        if (modeRef.current !== 'auto') break;
        setCurrentPage(page);
        const finished = await readPage(page);
        // A cancelled utterance means the learner took over.
        if (!finished) break;
      }

      if (modeRef.current === 'auto') {
        modeRef.current = 'idle';
        setMode('idle');
      }
    },
    [docId, pages, readPage, cancel]
  );

  /** Follow-along: explain whatever page scrolls into view. */
  const startFollow = useCallback(() => {
    cancel();
    modeRef.current = 'follow';
    setMode('follow');
    setError(null);
  }, [cancel]);

  /**
   * Called by the reader as the page in view changes. Only acts in follow
   * mode, and never interrupts an explanation already being spoken.
   */
  const onPageInView = useCallback(
    (page: number) => {
      setCurrentPage(page);
      if (modeRef.current !== 'follow') return;
      if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) return;
      void readPage(page);
    },
    [readPage]
  );

  return {
    mode,
    summary,
    summaryLoading,
    explanations,
    busyPage,
    currentPage,
    error,
    speaking,
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
