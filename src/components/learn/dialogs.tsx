'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { SHORTCUTS } from './use-shortcuts';
import { useVoiceSearch } from './use-voice-search';
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
 * Find a lesson: hold to speak, or type. Spoken search records a clip, the
 * server transcribes it with Whisper and searches YouTube. Fully reachable
 * without sight — the results list is keyboard-navigable and the first result
 * is focusable immediately.
 */
export function SearchDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  /** Receives a YouTube URL ready to load. */
  onPick: (url: string) => void;
}) {
  const voice = useVoiceSearch();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!open) {
      voice.reset();
      setDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const recording = voice.state === 'recording';
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
            <>
              <Waveform bars={7} className="h-6" />
              Listening — release to search
            </>
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
        <ul className="mt-4 max-h-[40vh] space-y-1 overflow-y-auto" aria-label="Search results">
          {voice.results.map((result) => (
            <li key={result.id}>
              <button
                onClick={() => onPick(result.url)}
                className="flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
              >
                <PlayIcon className="h-4 w-4 shrink-0 text-ink-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{result.title}</span>
                  <span className="block truncate text-xs text-ink-faint">
                    {result.channel}
                    {result.duration ? ` · ${formatTime(result.duration)}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Overlay>
  );
}
