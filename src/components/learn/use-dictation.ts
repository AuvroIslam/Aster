'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hold-to-talk dictation using the browser's own speech recognition.
 *
 * Deliberately not Whisper: that needs a server-side OpenAI key, and someone
 * running Aster for the first time will not have one. This is built into
 * Chrome and Edge, costs nothing, and works the moment the page loads — which
 * matters most for the learner who cannot reach for a keyboard shortcut list.
 */

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type DictationState = 'idle' | 'listening' | 'error';

export function useDictation({ lang = 'en-US' }: { lang?: string } = {}) {
  const [state, setState] = useState<DictationState>('idle');
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<Recognition | null>(null);
  /** Resolves when a hold ends, with whatever was heard. */
  const settleRef = useRef<((text: string) => void) | null>(null);
  const finalRef = useRef('');

  useEffect(() => {
    setSupported(Boolean(getRecognition()));
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  /**
   * Starts listening and resolves with the final transcript when `stop` is
   * called or the browser ends the session on its own.
   */
  const listen = useCallback(
    (): Promise<string> =>
      new Promise((resolve) => {
        const Ctor = getRecognition();
        if (!Ctor) {
          setError('This browser cannot listen. Type your answer instead.');
          setState('error');
          resolve('');
          return;
        }

        // A previous session must be torn down or `start` throws.
        recognitionRef.current?.abort();
        finalRef.current = '';
        setTranscript('');
        setError(null);

        const recognition = new Ctor();
        recognition.lang = lang;
        recognition.continuous = true;
        // Interim results give the learner something to hear/see immediately,
        // rather than silence until they let go.
        recognition.interimResults = true;
        recognitionRef.current = recognition;
        settleRef.current = resolve;

        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (result.isFinal) finalRef.current += result[0].transcript;
            else interim += result[0].transcript;
          }
          setTranscript((finalRef.current + interim).trim());
        };

        recognition.onerror = (event) => {
          // "aborted" and "no-speech" are ordinary outcomes of letting go, not
          // failures worth alarming anyone about.
          if (event.error !== 'aborted' && event.error !== 'no-speech') {
            setError(
              event.error === 'not-allowed'
                ? 'I could not reach your microphone. Check the browser permission.'
                : `I could not hear that (${event.error}).`
            );
            setState('error');
          }
        };

        recognition.onend = () => {
          const heard = finalRef.current.trim();
          setState((current) => (current === 'error' ? current : 'idle'));
          settleRef.current?.(heard);
          settleRef.current = null;
          recognitionRef.current = null;
        };

        try {
          recognition.start();
          setState('listening');
        } catch {
          setState('error');
          resolve('');
        }
      }),
    [lang]
  );

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { listen, stop, state, transcript, supported, error };
}

export default useDictation;
