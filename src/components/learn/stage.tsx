'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Waveform } from '@/components/motion/waveform';
import { PlayIcon, PauseIcon, SpeakerIcon, EyeIcon } from '@/components/icons';
import { formatTime, cn } from '@/lib/utils';
import type { Description, Lesson } from '@/lib/types';

export function Stage({
  lesson,
  time,
  playing,
  speaking,
  holding,
  onToggle,
  onSeek,
}: {
  lesson: Lesson;
  time: number;
  playing: boolean;
  speaking: Description | null;
  holding: boolean;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
}) {
  const progress = (time / lesson.duration) * 100;

  return (
    <section className="glass lift overflow-hidden rounded-panel" aria-label="Lesson">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-semibold tracking-tight">
            {lesson.title}
          </h2>
          <p className="truncate text-sm text-ink-faint">{lesson.channel}</p>
        </div>
        <span className="shrink-0 rounded-full bg-moss-soft px-3 py-1 text-xs font-medium text-moss">
          {lesson.language}
        </span>
      </header>

      {/* Stand-in for the video surface. Deliberately dark so the described
          content reads as "the screen" rather than part of the app chrome. */}
      <div className="relative aspect-video overflow-hidden bg-[#14130e]">
        <FrameArt kind={speaking?.kind} />

        <AnimatePresence>
          {holding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-[#14130e]/70 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                className="mx-6 max-w-lg rounded-card border border-white/10 bg-black/40 p-5 text-center"
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-rust px-3 py-1 text-xs font-medium text-white">
                  <Waveform bars={4} className="h-3" />
                  Extended description
                </span>
                <p className="mt-3 text-sm leading-relaxed text-white/85">{speaking?.text}</p>
                <p className="mt-3 text-xs text-white/50">
                  Video held so the explanation is not cut short. It resumes on its own.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* While an explanation is holding playback the overlay card owns the
            centre, so the play control moves out from under it. */}
        <button
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className={cn(
            'group absolute inset-0 grid',
            holding ? 'place-items-end p-4' : 'place-items-center'
          )}
        >
          <motion.span
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className={cn(
              'flex items-center justify-center rounded-full bg-moss/90 text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100',
              holding ? 'h-11 w-11' : 'h-16 w-16'
            )}
          >
            {playing ? (
              <PauseIcon className={holding ? 'h-5 w-5' : 'h-7 w-7'} />
            ) : (
              <PlayIcon className={holding ? 'h-5 w-5' : 'h-7 w-7'} />
            )}
          </motion.span>
        </button>
      </div>

      {/* Scrubber */}
      <div className="px-5 pt-4">
        <label htmlFor="scrub" className="sr-only">
          Position in lesson
        </label>
        {/* A native range so it is keyboard- and screen-reader-operable, with the
            track painted to show progress (browsers do not fill it by default). */}
        <input
          id="scrub"
          type="range"
          min={0}
          max={lesson.duration}
          step={1}
          value={Math.floor(time)}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="scrubber w-full accent-rust"
          style={{
            background: `linear-gradient(to right, var(--rust) ${progress}%, var(--line) ${progress}%)`,
            height: '4px',
            borderRadius: '9999px',
            appearance: 'none',
          }}
        />
        <div className="mt-3 flex justify-between font-mono text-xs text-ink-faint">
          <span>{formatTime(time)}</span>
          <span>{formatTime(lesson.duration)}</span>
        </div>
      </div>

      {/* Speaking bar — the live state of the product. */}
      <div className="px-5 pb-5 pt-3">
        <AnimatePresence mode="wait">
          {speaking ? (
            <motion.div
              key="speaking"
              initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3 rounded-card border border-rust/25 bg-rust-soft/60 px-4 py-3"
            >
              <span className="mt-0.5 text-rust">
                <Waveform />
              </span>
              <p className="flex-1 text-sm leading-relaxed text-ink">{speaking.text}</p>
            </motion.div>
          ) : (
            <motion.div
              key="quiet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-card border border-dashed border-line px-4 py-3 text-sm text-ink-faint"
            >
              <SpeakerIcon className="h-4 w-4" />
              Quiet — the instructor has this covered.
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-3 flex items-center gap-2 text-xs text-ink-faint">
          <EyeIcon className="h-3.5 w-3.5" />
          Aster examined {lesson.consideredMoments} moments and chose to speak at{' '}
          {lesson.descriptions.length}.
        </p>
      </div>
    </section>
  );
}

/**
 * A suggestion of what is on screen, keyed to the kind of visual being
 * described. Sighted users get a hint of the frame; the description carries the
 * actual information.
 */
function FrameArt({ kind }: { kind?: Description['kind'] }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-8">
      <motion.div
        key={kind ?? 'idle'}
        initial={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md font-mono text-[11px] leading-relaxed text-white/35"
      >
        {kind === 'code' && (
          <pre className="whitespace-pre-wrap">{`def insert(node, value):
    if node is None:
        return Node(value)
    if value < node.value:
        node.left  = insert(node.left, value)
    else:
        node.right = insert(node.right, value)
    return node`}</pre>
        )}
        {kind === 'terminal' && (
          <pre className="whitespace-pre-wrap">{`$ python bst.py
[3, 7, 10, 14, 20]
height before rotate: 5
height after  rotate: 3`}</pre>
        )}
        {kind === 'formula' && (
          <p className="text-center text-lg tracking-wide text-white/45">
            balance = height(left) − height(right)
          </p>
        )}
        {(kind === 'diagram' || kind === 'graph' || kind === 'slide' || !kind) && (
          <div className="flex h-32 items-end justify-center gap-2" aria-hidden>
            {[24, 46, 68, 90, 112].map((h, i) => (
              <motion.span
                key={h}
                initial={{ height: 8 }}
                animate={{ height: h }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className="w-8 rounded-t bg-white/12"
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
