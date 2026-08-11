'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpeech } from './use-speech';
import type { Description, NarrationMode } from '@/lib/types';

const TICK_MS = 100;

export interface PlayerBridge {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getTime: () => number;
}

/**
 * Playback + description scheduling.
 *
 * The one rule this enforces: Aster never talks over the instructor. A `brief`
 * description fits inside a natural pause and plays while the video rolls. An
 * `explain` description outlasts the pause, so the video is *held* until speech
 * genuinely ends — resolved by the speech promise, not by a guessed duration.
 *
 * `player` is optional: without it the clock is simulated, which is how the
 * surface behaves before a real video is loaded.
 */
export function usePlayback(
  descriptions: Description[],
  duration: number,
  player?: PlayerBridge | null,
  language = 'en'
) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState<Description | null>(null);
  const [heard, setHeard] = useState<Description[]>([]);
  const [descriptionsOn, setDescriptionsOn] = useState(true);
  const [rate, setRate] = useState(1.25);
  const [volume, setVolume] = useState(1);
  const [voiceURI, setVoiceURI] = useState('');
  const [narration, setNarration] = useState<NarrationMode>('adaptive');
  const [holding, setHolding] = useState(false);

  const speech = useSpeech({ rate, volume, voiceURI, lang: language });

  const firedRef = useRef<Set<string>>(new Set());
  /** True while a hold is in progress, readable synchronously by the clock. */
  const holdingRef = useRef(false);

  const stopSpeaking = useCallback(() => {
    speech.cancel();
    setSpeaking(null);
    if (holdingRef.current) {
      holdingRef.current = false;
      setHolding(false);
      player?.play();
    }
  }, [speech, player]);

  const speak = useCallback(
    async (description: Description) => {
      setSpeaking(description);
      setHeard((prev) =>
        prev.some((d) => d.id === description.id) ? prev : [...prev, description]
      );

      // Full-explanation mode holds for every moment, not just the long ones —
      // the learner is relying on Aster for the whole lesson.
      const mustHold = description.mode === 'explain' || narration === 'full';

      if (mustHold) {
        holdingRef.current = true;
        setHolding(true);
        player?.pause();
      }

      const result = await speech.speak(description.text);

      setSpeaking((current) => (current?.id === description.id ? null : current));

      if (mustHold && holdingRef.current) {
        holdingRef.current = false;
        setHolding(false);
        // Only resume if the learner did not take over in the meantime.
        if (!result.cancelled) player?.play();
      }
    },
    [speech, narration, player]
  );

  // The clock. Reads the real player when one is attached, otherwise simulates.
  useEffect(() => {
    if (!playing) return;

    const id = setInterval(() => {
      if (player) {
        setTime(player.getTime());
        return;
      }
      if (holdingRef.current) return;
      setTime((previous) => {
        const next = previous + TICK_MS / 1000;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, [playing, duration, player]);

  // Fire any description the clock has just passed.
  useEffect(() => {
    if (!playing || !descriptionsOn || holdingRef.current) return;

    const due = descriptions.find(
      (d) => !firedRef.current.has(d.id) && time >= d.time && time < d.time + 1.5
    );

    if (due) {
      firedRef.current.add(due.id);
      void speak(due);
    }
  }, [time, playing, descriptionsOn, descriptions, speak]);

  const seek = useCallback(
    (seconds: number) => {
      const target = Math.min(duration, Math.max(0, seconds));
      stopSpeaking();
      // Seeking backwards re-arms everything after the new position, so a
      // learner who rewinds hears those descriptions again.
      firedRef.current = new Set(descriptions.filter((d) => d.time < target).map((d) => d.id));
      setTime(target);
      player?.seekTo(target);
    },
    [duration, descriptions, stopSpeaking, player]
  );

  const toggle = useCallback(() => {
    // Forcing playback while Aster is mid-sentence stops the speech rather than
    // letting two voices collide.
    if (holdingRef.current || speaking) stopSpeaking();

    setPlaying((wasPlaying) => {
      if (wasPlaying) player?.pause();
      else player?.play();
      return !wasPlaying;
    });
  }, [speaking, stopSpeaking, player]);

  /** Called by the player bridge when YouTube itself changes state. */
  const syncPlaying = useCallback((next: boolean) => setPlaying(next), []);

  /** Re-arm the schedule when a different lesson is loaded. */
  const reset = useCallback(() => {
    stopSpeaking();
    firedRef.current = new Set();
    setHeard([]);
    setTime(0);
    setPlaying(false);
  }, [stopSpeaking]);

  useEffect(() => () => speech.cancel(), [speech]);

  return {
    time,
    playing,
    speaking,
    holding,
    heard,
    descriptionsOn,
    rate,
    volume,
    voiceURI,
    narration,
    voices: speech.voices,
    voiceAvailable: speech.voiceAvailable,
    speechSupported: speech.supported,
    setRate,
    setVolume,
    setVoiceURI,
    setNarration,
    setDescriptionsOn,
    toggle,
    seek,
    reset,
    syncPlaying,
    replay: (d: Description) => void speak(d),
    speakText: (text: string) => speech.speak(text),
    stopSpeaking,
  };
}
