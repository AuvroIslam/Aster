'use client';

import { useEffect } from 'react';

export interface ShortcutHandlers {
  onToggle: () => void;
  onSeekBy: (delta: number) => void;
  onSeekStart: () => void;
  onSkipSpeech: () => void;
  onReplayLast: () => void;
  onToggleDescriptions: () => void;
  onRateBy: (delta: number) => void;
  onFocusAsk: () => void;
  onPreset: (index: number) => void;
  onSearch: () => void;
  onHelp: () => void;
  onEscape: () => void;
}

/** True when the key belongs to whatever the learner is typing into. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

/**
 * The whole app is operable without sight, which means without a mouse. Every
 * action on the learning surface has a single-key shortcut.
 */
export function useShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Escape must work even mid-typing — it is the stop-talking key.
      if (event.key === 'Escape') {
        handlers.onEscape();
        return;
      }

      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key;

      /*
       * Finding a lesson and asking for help are how someone *without* a
       * lesson gets started, so they cannot be gated on having one — pressing
       * W on the empty page used to do nothing at all, which is the worst
       * possible answer for a learner who cannot see that a search box exists.
       * Everything below drives playback and does need a lesson.
       */
      if (key.toLowerCase() === 'w') {
        event.preventDefault();
        handlers.onSearch();
        return;
      }
      if (key === '?') {
        handlers.onHelp();
        return;
      }

      if (!enabled) return;

      if (key >= '1' && key <= '8') {
        event.preventDefault();
        handlers.onPreset(Number(key) - 1);
        return;
      }

      switch (key.toLowerCase()) {
        case ' ':
        case 'k':
          event.preventDefault();
          handlers.onToggle();
          break;
        case 'arrowleft':
          event.preventDefault();
          handlers.onSeekBy(-5);
          break;
        case 'arrowright':
          event.preventDefault();
          handlers.onSeekBy(5);
          break;
        case 'j':
          handlers.onSeekBy(-10);
          break;
        case 'l':
          handlers.onSeekBy(10);
          break;
        case 'home':
          handlers.onSeekStart();
          break;
        case 's':
          handlers.onSkipSpeech();
          break;
        case 'r':
          handlers.onReplayLast();
          break;
        case 'd':
          handlers.onToggleDescriptions();
          break;
        case ',':
          handlers.onRateBy(-0.1);
          break;
        case '.':
          handlers.onRateBy(0.1);
          break;
        case 'a':
          event.preventDefault();
          handlers.onFocusAsk();
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers, enabled]);
}

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space / K', action: 'Play or pause' },
  { keys: '← / →', action: 'Back or forward 5 seconds' },
  { keys: 'J / L', action: 'Back or forward 10 seconds' },
  { keys: 'Home', action: 'Back to the start' },
  { keys: 'S', action: 'Skip the current description' },
  { keys: 'R', action: 'Replay the last description' },
  { keys: 'D', action: 'Audio descriptions on or off' },
  { keys: ', / .', action: 'Speak slower or faster' },
  { keys: 'A', action: 'Jump to the question box' },
  { keys: '1 – 8', action: 'Ask a preset question' },
  { keys: 'W', action: 'Search for a video by voice' },
  { keys: 'Escape', action: 'Stop speaking' },
  { keys: '?', action: 'This help' },
];
