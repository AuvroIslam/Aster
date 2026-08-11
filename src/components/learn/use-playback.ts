'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Description } from '@/lib/types';

const TICK_MS = 100;

/**
 * A simulated playback clock standing in for the YouTube player.
 *
 * It models the one behaviour that matters and is easy to get wrong: a
 * description must never overlap the instructor. A `brief` description is
 * spoken while the video keeps rolling, because it fits inside a natural pause.
 * An `explain` description is long enough to outlast the pause, so playback is
 * *held* until Aster finishes — and released automatically afterwards.
 */
export function usePlayback(descriptions: Description[], duration: number) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState<Description | null>(null);
  const [heard, setHeard] = useState<Description[]>([]);
  const [descriptionsOn, setDescriptionsOn] = useState(true);
  const [rate, setRate] = useState(1.25);

  /** True while a full explanation is holding playback. */
  const [holding, setHolding] = useState(false);
  const firedRef = useRef<Set<string>>(new Set());
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopSpeaking = useCallback(() => {
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = null;
    setSpeaking(null);
    setHolding(false);
  }, []);

  const speak = useCallback(
    (description: Description) => {
      if (speechTimer.current) clearTimeout(speechTimer.current);

      setSpeaking(description);
      setHeard((prev) => (prev.some((d) => d.id === description.id) ? prev : [...prev, description]));
      if (description.mode === 'explain') setHolding(true);

      // Roughly how long the utterance takes at the current speech rate.
      const words = description.text.split(/\s+/).length;
      const seconds = Math.max(2.5, (words / 2.6) / rate);

      speechTimer.current = setTimeout(() => {
        setSpeaking(null);
        setHolding(false);
        speechTimer.current = null;
      }, seconds * 1000);
    },
    [rate]
  );

  // The clock. Held while a full explanation is being delivered.
  useEffect(() => {
    if (!playing || holding) return;

    const id = setInterval(() => {
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
  }, [playing, holding, duration]);

  // Fire any description the clock has just passed.
  useEffect(() => {
    if (!playing || !descriptionsOn) return;

    const due = descriptions.find(
      (d) => !firedRef.current.has(d.id) && time >= d.time && time < d.time + 1.5
    );

    if (due) {
      firedRef.current.add(due.id);
      speak(due);
    }
  }, [time, playing, descriptionsOn, descriptions, speak]);

  const seek = useCallback(
    (seconds: number) => {
      const target = Math.min(duration, Math.max(0, seconds));
      stopSpeaking();
      // Seeking backwards re-arms everything after the new position, so a
      // learner who rewinds hears the descriptions again.
      firedRef.current = new Set(
        descriptions.filter((d) => d.time < target).map((d) => d.id)
      );
      setTime(target);
    },
    [duration, descriptions, stopSpeaking]
  );

  const toggle = useCallback(() => {
    // Forcing playback while Aster is mid-sentence stops the speech rather than
    // letting two voices collide.
    if (holding || speaking) stopSpeaking();
    setPlaying((p) => !p);
  }, [holding, speaking, stopSpeaking]);

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  return {
    time,
    playing,
    speaking,
    holding,
    heard,
    descriptionsOn,
    rate,
    setRate,
    setDescriptionsOn,
    toggle,
    seek,
    replay: (d: Description) => speak(d),
    stopSpeaking,
  };
}
