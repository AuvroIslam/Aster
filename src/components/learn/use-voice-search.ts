'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type SearchResult } from '@/lib/api';

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'error';

/**
 * Hold-to-speak search.
 *
 * Records a short clip with MediaRecorder, posts it to the server, which
 * transcribes it with Whisper and searches YouTube. Whisper is ASR only — it
 * generates no content, it just turns the spoken query into text.
 */
export function useVoiceSearch() {
  const [state, setState] = useState<VoiceState>('idle');
  const [available, setAvailable] = useState(false);
  const [heard, setHeard] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Spoken search needs a server-side key; the button stays hidden without one.
  useEffect(() => {
    let cancelled = false;
    api
      .voiceSearchStatus()
      .then((status) => !cancelled && setAvailable(Boolean(status.enabled)))
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (state === 'recording') return;
    setError(null);
    setHeard('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();
      setState('recording');
    } catch {
      setError('I could not reach your microphone. Check the browser permission.');
      setState('error');
    }
  }, [state]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
    });

    recorder.stop();
    setState('transcribing');

    const blob = await finished;
    stopTracks();

    // A clip this short is almost always a mis-press, not a query.
    if (blob.size < 1200) {
      setState('idle');
      return;
    }

    try {
      const payload = await api.voiceSearch(blob);
      setHeard(payload.transcript);
      setResults(payload.results ?? []);
      setState('idle');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not transcribe that.');
      setState('error');
    }
  }, [stopTracks]);

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

  const reset = useCallback(() => {
    setHeard('');
    setResults([]);
    setError(null);
    setState('idle');
  }, []);

  useEffect(() => () => stopTracks(), [stopTracks]);

  return { state, available, heard, results, error, start, stop, searchText, reset };
}
