'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { SHORTCUTS } from './use-shortcuts';
import { useVoiceSearch } from './use-voice-search';
import { useSpeech } from './use-speech';
import { SpeakerIcon, SparkIcon, PlayIcon } from '@/components/icons';
import { Waveform } from '@/components/motion/waveform';
import { formatTime, cn } from '@/lib/utils';

function Overlay({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus moves into the dialog on open so a screen reader lands inside it.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-ground-deep/70 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.97, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 16, scale: 0.98, filter: 'blur(10px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="panel w-full max-w-lg rounded-panel p-6 outline-none"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Overlay open={open} onClose={onClose} label="Keyboard shortcuts">
      <h2 className="font-display text-xl font-semibold tracking-tight">Keyboard shortcuts</h2>
      <p className="mt-1 text-sm text-ink-faint">
        Nothing here needs a mouse, and nothing here needs sight.
      </p>

      <ul className="mt-5 max-h-[55vh] space-y-1 overflow-y-auto">
        {SHORTCUTS.map((shortcut, i) => (
          <motion.li
            key={shortcut.keys}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.025, duration: 0.3 }}
            className="flex items-center justify-between gap-4 rounded-card px-3 py-2 text-sm transition-colors hover:bg-surface/60"
          >
            <span className="text-ink-soft">{shortcut.action}</span>
            <kbd className="shrink-0 rounded bg-ground-deep px-2 py-1 font-mono text-xs">
              {shortcut.keys}
            </kbd>
          </motion.li>
        ))}
      </ul>

      <button
        onClick={onClose}
        className="mt-5 w-full rounded-full bg-ink py-3 text-sm font-medium text-ground"
      >
        Close
      </button>
    </Overlay>
  );
}


/**
 * Find a lesson: hold to speak, or type. Speech is recognised in the browser,
 * so the search reaches the server as words and needs no transcription key.
 * Fully reachable without sight — the results list is keyboard-navigable and
 * the first result is focusable immediately.
 */
export function SearchDialog({
  open,
  onClose,
  onPick,
  /** True when opened by holding W, so the microphone starts with the dialog. */
  autoListen = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Receives a YouTube URL ready to load. */
  onPick: (url: string) => void;
  autoListen?: boolean;
}) {
  const voice = useVoiceSearch();
  const speech = useSpeech();
  const [draft, setDraft] = useState('');
  /** Which result is being read out, and therefore what Enter will load. */
  const [announced, setAnnounced] = useState(0);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!open) {
      voice.reset();
      setDraft('');
      setAnnounced(0);
      setReading(false);
      speech.cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * W is advertised on the button as hold-to-speak, so it has to actually hold
   * the microphone open. The keypress that opened this dialog is already spent
   * by the time it mounts, hence `autoListen` rather than a keydown here.
   */
  const listening = voice.state === 'recording';
  useEffect(() => {
    if (!open || !autoListen) return;
    void voice.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoListen]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'w' || event.repeat) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      event.preventDefault();
      if (!listening) void voice.start();
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'w' && listening) voice.stop();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listening]);

  /**
   * Reads the results out, one at a time.
   *
   * A list on screen is no use to someone who cannot see it, so the results are
   * announced in order and the one being spoken is the one Enter will load.
   * That makes choosing a lesson possible with two keys and no sight: W to
   * speak the search, Enter when you hear the one you want.
   */
  useEffect(() => {
    const results = voice.results;
    if (!open || results.length === 0) return;

    let cancelled = false;
    setReading(true);

    // Typing a search leaves focus in the field, where Enter means "search
    // again" and the result being read aloud cannot be chosen. Step out of it
    // once there are results, so Enter belongs to the list.
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();

    (async () => {
      await speech.speak(
        `${results.length} result${results.length === 1 ? '' : 's'}. Press Enter on the one you want.`
      );
      for (let i = 0; i < results.length; i += 1) {
        if (cancelled) return;
        setAnnounced(i);
        const r = results[i];
        const spoken = `${i + 1}. ${r.title}.${r.channel ? ` By ${r.channel}.` : ''}${
          r.duration ? ` ${Math.round(r.duration / 60)} minutes.` : ''
        }`;
        const result = await speech.speak(spoken);
        // Cancelled means the learner pressed Enter, or closed the dialog.
        if (cancelled || result.cancelled) return;
      }
      if (!cancelled) setReading(false);
    })();

    return () => {
      cancelled = true;
      setReading(false);
      speech.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voice.results]);

  /** Enter loads whichever result is currently being announced. */
  useEffect(() => {
    if (!open || voice.results.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter') return;
      // The typed-search field has its own submit behaviour.
      if (event.target instanceof HTMLElement && event.target.tagName === 'INPUT') return;
      const chosen = voice.results[announced];
      if (!chosen) return;
      event.preventDefault();
      speech.cancel();
      onPick(chosen.url);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voice.results, announced]);

  useEffect(() => setAnnounced(0), [voice.results]);

  const recording = listening;
  const busy = voice.state === 'transcribing';

  return (
    <Overlay open={open} onClose={onClose} label="Find a lesson">
      <h2 className="text-xl font-medium tracking-tight">Find a lesson</h2>
      <p className="mt-1 text-sm text-ink-faint">
        Hold to speak, type a search, or paste a YouTube link.
      </p>

      {voice.available && (
        <motion.button
          onPointerDown={() => void voice.start()}
          onPointerUp={() => void voice.stop()}
          onPointerLeave={() => recording && void voice.stop()}
          disabled={busy}
          animate={recording ? { scale: 1.02 } : { scale: 1 }}
          className={cn(
            'mt-5 flex w-full items-center justify-center gap-3 rounded-card border-2 py-8 transition-colors',
            recording
              ? 'border-bloom bg-white/[0.05] text-bloom'
              : 'border-dashed border-line text-ink-soft hover:border-line-strong'
          )}
        >
          {recording ? (
            <span className="flex flex-col items-center gap-2">
              <span className="flex items-center gap-3">
                <Waveform bars={7} className="h-6" />
                Listening — release to search
              </span>
              {/* Showing the words as they land is the only proof a blind
                  learner has that the microphone is actually hearing them. */}
              {voice.transcript && (
                <span className="max-w-sm text-sm text-ink">“{voice.transcript}”</span>
              )}
            </span>
          ) : busy ? (
            <>
              <Waveform bars={4} className="h-4" />
              Transcribing…
            </>
          ) : (
            <>
              <SpeakerIcon className="h-5 w-5" />
              Hold to speak{' '}
              <kbd className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs">W</kbd>
            </>
          )}
        </motion.button>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = draft.trim();
          if (!value) return;
          // A pasted link skips search entirely.
          if (/youtu\.?be/.test(value)) onPick(value);
          else void voice.searchText(value);
        }}
        className="mt-4 flex gap-2"
      >
        <label htmlFor="search" className="sr-only">
          Search or paste a link
        </label>
        <input
          id="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search, or paste a YouTube link…"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="shrink-0 rounded-full bg-ink px-5 py-3 text-sm font-medium text-ground disabled:opacity-40"
        >
          Go
        </button>
      </form>

      <AnimatePresence>
        {voice.heard && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 flex items-center gap-2 text-sm text-ink-soft"
          >
            <SparkIcon className="h-4 w-4 shrink-0 text-bloom" />
            <span className="text-ink-faint">I heard:</span> {voice.heard}
          </motion.p>
        )}
        {voice.error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
            className="mt-4 text-sm text-live"
          >
            {voice.error}
          </motion.p>
        )}
      </AnimatePresence>

      {voice.results.length > 0 && (
        <>
          <p className="mt-4 text-xs text-ink-faint" aria-live="polite">
            {reading
              ? `Reading result ${announced + 1} of ${voice.results.length} — press Enter to load it.`
              : 'Press Enter to load the highlighted result.'}
          </p>
          <ul className="mt-2 max-h-[40vh] space-y-1 overflow-y-auto" aria-label="Search results">
            {voice.results.map((result, i) => (
              <li key={result.videoId}>
                <button
                  onClick={() => onPick(result.url)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left transition-colors',
                    i === announced
                      ? 'bg-bloom/15 ring-1 ring-inset ring-bloom/40'
                      : 'hover:bg-white/[0.05]'
                  )}
                >
                  <PlayIcon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      i === announced ? 'text-bloom' : 'text-ink-faint'
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{result.title}</span>
                    <span className="block truncate text-xs text-ink-faint">
                      {result.channel}
                      {result.duration ? ` · ${formatTime(result.duration)}` : ''}
                    </span>
                  </span>
                  {i === announced && reading && <Waveform bars={4} className="h-3 text-bloom" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Overlay>
  );
}
