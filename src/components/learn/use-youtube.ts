'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerBridge } from './use-playback';

/* Minimal shape of the bits of the IFrame API we actually use. */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  loadVideoById(id: string): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

/** Loads the IFrame API once per page, however many players ask for it. */
function loadApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });

  return apiPromise;
}

/**
 * Wraps a YouTube iframe as a `PlayerBridge`.
 *
 * The iframe is `aria-hidden` and keyboard-disabled: focus must never fall into
 * a player a blind learner cannot navigate. Everything meaningful is exposed by
 * Aster's own controls instead.
 */
export function useYouTube({
  videoId,
  onStateChange,
}: {
  videoId: string | null;
  onStateChange?: (playing: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  const stateHandler = useRef(onStateChange);
  stateHandler.current = onStateChange;

  useEffect(() => {
    if (!videoId || !hostRef.current) return;

    let cancelled = false;

    void loadApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return;

      // Re-use the existing player when only the video changed.
      if (playerRef.current) {
        playerRef.current.loadVideoById(videoId);
        return;
      }

      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event: { target: YTPlayer }) => {
            if (cancelled) return;
            setReady(true);
            setDuration(event.target.getDuration());
          },
          onStateChange: (event: { data: number }) => {
            const YT = window.YT;
            if (!YT) return;
            if (event.data === YT.PlayerState.PLAYING) stateHandler.current?.(true);
            if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
              stateHandler.current?.(false);
            }
            if (playerRef.current) setDuration(playerRef.current.getDuration());
          },
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(
    () => () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    },
    []
  );

  const bridge: PlayerBridge = {
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    seekTo: (seconds) => playerRef.current?.seekTo(seconds, true),
    getTime: () => playerRef.current?.getCurrentTime() ?? 0,
  };

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isMuted()) {
      player.unMute();
      setMuted(false);
    } else {
      player.mute();
      setMuted(true);
    }
  }, []);

  return { hostRef, bridge: ready ? bridge : null, ready, duration, muted, toggleMute };
}
