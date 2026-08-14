'use client';

import { useCallback, useState } from 'react';
import { useDictation } from './use-dictation';
import { api, ApiError, type SearchResult } from '@/lib/api';

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'error';

/**
 * Hold-to-speak search.
 *
 * Recognition happens in the browser, so a spoken search reaches the server as
 * plain text and there is no transcription key to configure. The trade is that
 * this needs Chrome or Edge — the same browsers the app already needs for
 * speech synthesis, so it costs nothing extra in practice. Typed search works
 * everywhere.
 */
export function useVoiceSearch() {
  const [state, setState] = useState<VoiceState>('idle');
  const [heard, setHeard] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const dictation = useDictation();

  const searchText = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setError(null);
    setState('transcribing');
    try {
      const payload = await api.search(query);
      setResults(payload.results ?? []);
      setHeard(query);
      setState('idle');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed.');
      setState('error');
    }
  }, []);

  const start = useCallback(async () => {
    if (state === 'recording') return;
    setError(null);
    setHeard('');

    if (!dictation.supported) {
      setError('This browser cannot listen. Type your search instead.');
      setState('error');
      return;
    }

    setState('recording');
    const spoken = await dictation.listen();
    if (!spoken.trim()) {
      setState('idle');
      setError('I did not catch that. Hold a moment longer and speak.');
      return;
    }
    await searchText(spoken);
  }, [state, dictation, searchText]);

  const stop = useCallback(() => dictation.stop(), [dictation]);

  const reset = useCallback(() => {
    setHeard('');
    setResults([]);
    setError(null);
    setState('idle');
  }, []);

  return {
    state,
    available: dictation.supported,
    heard,
    results,
    error: error ?? dictation.error,
    start,
    stop,
    searchText,
    reset,
    /** Words appearing as they are spoken, so the learner sees it working. */
    transcript: dictation.transcript,
  };
}

export default useVoiceSearch;
