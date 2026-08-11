'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { SHORTCUTS } from './use-shortcuts';
import { SpeakerIcon, SparkIcon, PlayIcon } from '@/components/icons';
import { Waveform } from '@/components/motion/waveform';

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
            className="glass lift w-full max-w-lg rounded-panel p-6 outline-none"
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
        className="mt-5 w-full rounded-full bg-moss py-3 text-sm font-medium text-ground"
      >
        Close
      </button>
    </Overlay>
  );
}

const SUGGESTIONS = [
  'AVL tree rotations explained',
  'Python list comprehensions',
  'পর্যায়বৃত্ত গতি — পদার্থবিজ্ঞান',
  'How gradient descent works',
];

/**
 * Voice search. Holding W records; releasing transcribes and searches. The
 * whole flow is reachable without ever seeing the results list — the top
 * result plays automatically.
 */
export function SearchDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (query: string) => void;
}) {
  const [holding, setHolding] = useState(false);
  const [heardQuery, setHeardQuery] = useState('');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!open) {
      setHolding(false);
      setHeardQuery('');
      setDraft('');
    }
  }, [open]);

  function release() {
    if (!holding) return;
    setHolding(false);
    // Stands in for Whisper: transcribe, then search, then play the top result.
    setTimeout(() => setHeardQuery(SUGGESTIONS[0]), 600);
  }

  return (
    <Overlay open={open} onClose={onClose} label="Find a video">
      <h2 className="font-display text-xl font-semibold tracking-tight">Find a lesson</h2>
      <p className="mt-1 text-sm text-ink-faint">
        Hold the button and speak, or type. The top result starts on its own.
      </p>

      <motion.button
        onPointerDown={() => setHolding(true)}
        onPointerUp={release}
        onPointerLeave={release}
        animate={holding ? { scale: 1.03 } : { scale: 1 }}
        className={`mt-5 flex w-full items-center justify-center gap-3 rounded-card border-2 py-8 transition-colors ${
          holding ? 'border-rust bg-rust-soft/60 text-rust' : 'border-dashed border-line text-ink-soft'
        }`}
      >
        {holding ? (
          <>
            <Waveform bars={7} className="h-6" />
            Listening — release to search
          </>
        ) : (
          <>
            <SpeakerIcon className="h-5 w-5" />
            Hold to speak <kbd className="rounded bg-ground-deep px-1.5 py-0.5 font-mono text-xs">W</kbd>
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {heardQuery && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 flex items-center gap-2 rounded-card border border-moss/25 bg-moss-soft/50 p-3 text-sm"
          >
            <SparkIcon className="h-4 w-4 shrink-0 text-moss" />
            <span className="flex-1">
              <span className="text-ink-faint">I heard: </span>
              {heardQuery}
            </span>
            <button
              onClick={() => onPick(heardQuery)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-moss px-3 py-1.5 text-xs font-medium text-ground"
            >
              <PlayIcon className="h-3.5 w-3.5" />
              Play
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) onPick(draft);
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
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-rust"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-rust px-5 py-3 text-sm font-medium text-white"
        >
          Go
        </button>
      </form>

      <ul className="mt-4 space-y-1">
        {SUGGESTIONS.map((suggestion) => (
          <li key={suggestion}>
            <button
              onClick={() => onPick(suggestion)}
              className="w-full rounded-card px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-surface/70 hover:text-rust"
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </Overlay>
  );
}
