'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SpeakResult {
  cancelled: boolean;
  error?: string;
}

export interface SpeechSettings {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string;
  lang?: string;
}

/** Bare language subtag, so "bn-IN" and "bn-BD" both match a "bn" target. */
const baseLang = (code?: string) =>
  String(code ?? '')
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

/**
 * Speech synthesis via the Web Speech API.
 *
 * `speak` resolves when the utterance finishes, which is what lets the player
 * hold the video for exactly as long as Aster is talking — no estimate, no
 * guessed duration.
 */
export function useSpeech({
  rate = 1,
  pitch = 1,
  volume = 1,
  voiceURI = '',
  lang = 'en',
}: SpeechSettings = {}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  const currentRef = useRef<{ resolve: (r: SpeakResult) => void } | null>(null);
  const settingsRef = useRef<Required<SpeechSettings>>({ rate, pitch, volume, voiceURI, lang });
  settingsRef.current = { rate, pitch, volume, voiceURI, lang };

  // `speechSynthesis` does not exist during SSR, so support is resolved on mount.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    setSupported(true);

    const load = () => setVoices(synth.getVoices() ?? []);
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => synth.removeEventListener?.('voiceschanged', load);
  }, []);

  // Chrome silently suspends synthesis after ~15 seconds; a periodic
  // pause/resume keeps long explanations from cutting off mid-sentence.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const timer = setInterval(() => {
      if (synth.speaking && !synth.paused) {
        synth.pause();
        synth.resume();
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const pending = currentRef.current;
    currentRef.current = null;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    pending?.resolve({ cancelled: true });
  }, []);

  const speak = useCallback(
    (text: string, overrides: SpeechSettings = {}) =>
      new Promise<SpeakResult>((resolve) => {
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
        const content = String(text ?? '').trim();

        if (!synth || !content) {
          resolve({ cancelled: true });
          return;
        }

        // A newer description is always more relevant than the one it
        // interrupts, so replace rather than queue.
        if (synth.speaking || synth.pending) {
          const previous = currentRef.current;
          currentRef.current = null;
          synth.cancel();
          previous?.resolve({ cancelled: true });
        }

        const settings = { ...settingsRef.current, ...overrides };
        const utterance = new SpeechSynthesisUtterance(content);
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch;
        utterance.volume = settings.volume;

        // Choose a voice that actually speaks the description's language.
        const target = baseLang(settings.lang) || 'en';
        const available = synth.getVoices() ?? [];
        const chosen = available.find((v) => v.voiceURI === settings.voiceURI);
        const voice =
          chosen && baseLang(chosen.lang) === target
            ? chosen
            : available.find((v) => baseLang(v.lang) === target);

        if (voice) utterance.voice = voice;
        // Never force en-US — that would mislabel non-English speech.
        utterance.lang = voice?.lang || (target === 'en' ? 'en-US' : settings.lang || target);

        const entry = { resolve };
        currentRef.current = entry;

        let settled = false;
        const finish = (result: SpeakResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          if (currentRef.current === entry) {
            currentRef.current = null;
            setSpeaking(false);
          }
          resolve(result);
        };

        // Some browsers drop `end` entirely when the tab is backgrounded.
        // Without this the caller waits forever with the video paused.
        const watchdog = setTimeout(
          () => finish({ cancelled: false, error: 'speech-timeout' }),
          Math.max(8000, (content.length / 8) * 1000 * (1 / Math.max(0.5, settings.rate)))
        );

        utterance.onend = () => finish({ cancelled: false });
        utterance.onerror = (event) =>
          finish({
            cancelled: event.error === 'interrupted' || event.error === 'canceled',
            error: event.error,
          });

        setSpeaking(true);
        synth.speak(utterance);
      }),
    []
  );

  useEffect(() => cancel, [cancel]);

  const target = baseLang(lang) || 'en';
  const languageVoices = useMemo(
    () => voices.filter((voice) => baseLang(voice.lang) === target),
    [voices, target]
  );

  return {
    speak,
    cancel,
    speaking,
    /** Voices for the active language; all voices when the device has none. */
    voices: languageVoices.length ? languageVoices : voices,
    /** False when nothing installed can speak the lesson's language. */
    voiceAvailable: languageVoices.length > 0,
    lang: target,
    supported,
  };
}

export default useSpeech;
