'use client';

import { useCallback, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useDictation } from '@/components/learn/use-dictation';
import { useSpeech } from '@/components/learn/use-speech';

export interface AskedQuestion {
  id: string;
  page: number | null;
  question: string;
  answer: string;
}

/**
 * Hold-to-ask about the document.
 *
 * The question is grounded in whatever page the learner is on, so "what does
 * this mean?" has a referent without them having to describe where they are.
 */
export function useAsk(docId: string | null, currentPage: () => number) {
  const dictation = useDictation();
  const { speak, cancel } = useSpeech();

  const [asking, setAsking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<AskedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** Begins listening. Resolves once the question has been answered aloud. */
  const start = useCallback(async () => {
    if (asking || !docId) return;
    setError(null);
    setAsking(true);
    cancel();

    if (!dictation.supported) {
      setAsking(false);
      setError('This browser cannot listen. Chrome or Edge can.');
      return;
    }

    const question = await dictation.listen();
    setAsking(false);

    // Silence is the commonest outcome of a quick tap, and saying nothing about
    // it is what made this feel broken. Name it instead.
    if (!question.trim()) {
      setError('I did not catch a question. Hold W while you speak, then let go.');
      return;
    }

    const page = currentPage();
    setThinking(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await api.askDoc(docId, question, page, controller.signal);
      setHistory((prev) => [
        ...prev,
        { id: `q-${Date.now()}`, page: result.page, question, answer: result.answer },
      ]);
      setThinking(false);
      await speak(result.answer);
    } catch (err) {
      setThinking(false);
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not reach the Aster server.');
    }
  }, [asking, docId, dictation, currentPage, speak, cancel]);

  /** Called when the key or button is released. */
  const finish = useCallback(() => dictation.stop(), [dictation]);

  return {
    start,
    finish,
    asking,
    thinking,
    history,
    error,
    transcript: dictation.transcript,
    supported: dictation.supported,
    dictationError: dictation.error,
  };
}

export default useAsk;
