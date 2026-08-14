'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useMemo, type Ref } from 'react';
import { splitSentences } from './use-playback';
import { Waveform } from '@/components/motion/waveform';
import { PlayIcon, PauseIcon, SpeakerIcon, MuteIcon, AsterMark } from '@/components/icons';
import { formatTime, languageName, cn } from '@/lib/utils';
import type { Description, Lesson } from '@/lib/types';

export function Stage({
  lesson,
  time,
  playing,
  speaking,
  spokenSentence = 0,
  holding,
  onToggle,
  onSeek,
  playerHost,
  live = false,
  muted = false,
  onMute,
}: {
  lesson: Lesson;
  time: number;
  playing: boolean;
  speaking: Description | null;
  /** How far the voice has got through `speaking.text`, as a sentence index. */
  spokenSentence?: number;
  holding: boolean;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  /**
   * Where the YouTube iframe mounts. Absent in fixture mode. A callback ref, so
   * the hook is notified when this node actually appears — see use-youtube.ts.
   */
  playerHost?: Ref<HTMLDivElement>;
  live?: boolean;
  muted?: boolean;
  onMute?: () => void;
}) {
  const progress = (time / lesson.duration) * 100;
  const sentences = useMemo(
    () => (speaking ? splitSentences(speaking.text) : []),
    [speaking]
  );

  return (
    <section className="panel overflow-hidden rounded-panel" aria-label="Lesson">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className="label-micro flex items-center gap-2">
          <span className={cn('h-1.5 w-1.5 rounded-full', playing ? 'bg-live' : 'bg-ink-ghost')} />
          {playing ? 'Playing' : 'Paused'}
        </span>
        <motion.span
          animate={speaking ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.5 }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="ml-auto flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs"
        >
          <AsterMark className="h-3 w-3" />
          {languageName(lesson.language)}
        </motion.span>
      </header>

      <div className="px-5 pb-3">
        <h2 className="headline text-xl">{lesson.title}</h2>
        <p className="mt-1 text-sm text-ink-faint">{lesson.channel}</p>
      </div>

      {/* The lesson surface. Pure black so described content reads as "the
          screen" rather than as part of the app. */}
      {/*
        Full width, but capped in height: at 16:9 across a wide monitor the
        frame alone is taller than the viewport, which would push the transport
        and the caption off-screen. YouTube pillarboxes inside a wider box, so
        nothing is cropped.
      */}
      <div className="relative mx-auto aspect-video max-h-[68vh] overflow-hidden border-y border-line bg-ground-deep">
        {live ? (
          // The iframe is hidden from assistive tech and cannot take focus:
          // a blind learner must never land inside a player they cannot drive.
          // Every meaningful control lives in Aster's own UI below.
          <div
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
          >
            {/*
              The IFrame API *replaces* the node it is handed, rather than
              nesting inside it — so it has to be given a disposable child.
              Handing it this wrapper instead would destroy the styled box and
              leave the iframe unsized, which is why the sizing rules above
              target the iframe as a child of the wrapper, not as the wrapper.
            */}
            <div ref={playerHost} />
          </div>
        ) : (
          <FrameArt kind={speaking?.kind} />
        )}

        <AnimatePresence>
          {holding && (
            // Anchored to the bottom and scrim-free. Dimming or blurring the
            // frame would hide the very thing being described — and this lesson
            // is watched by low-vision learners with usable sight, and by
            // sighted people alongside them.
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 bottom-0 p-3"
            >
              <motion.div
                initial={{ y: 12, filter: 'blur(8px)' }}
                animate={{ y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                // Spans the frame like a subtitle bar. Only the bar is opaque,
                // so the screen behind it stays readable.
                className="w-full rounded-card border border-line-strong bg-surface/95 px-4 py-3 backdrop-blur-sm"
              >
                <span className="label-micro inline-flex items-center gap-2 text-ink">
                  <Waveform bars={4} className="h-3" />
                  Extended description
                </span>

                {/*
                  Revealed sentence by sentence, in step with the voice, rather
                  than as one wall of text. Sentences already spoken stay on
                  screen so the thread can be followed; the current one is
                  brightest.
                */}
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {sentences.slice(0, spokenSentence + 1).map((sentence, i) => (
                    <motion.span
                      key={sentence.start}
                      initial={{ opacity: 0, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, filter: 'blur(0px)' }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className={i === spokenSentence ? 'text-ink' : undefined}
                    >
                      {sentence.text}{' '}
                    </motion.span>
                  ))}
                </p>

                {sentences.length > 1 && (
                  <p className="mt-2 text-xs text-ink-ghost">
                    {spokenSentence + 1} of {sentences.length} · video held so the explanation is
                    not cut short. It resumes on its own.
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className={cn('group absolute inset-0 grid', holding ? 'place-items-end p-4' : 'place-items-center')}
        >
          <motion.span
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className={cn(
              'flex items-center justify-center rounded-full border border-line-strong bg-ground/70 text-ink opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100',
              holding ? 'h-10 w-10' : 'h-14 w-14'
            )}
          >
            {playing ? (
              <PauseIcon className={holding ? 'h-4 w-4' : 'h-6 w-6'} />
            ) : (
              <PlayIcon className={holding ? 'h-4 w-4' : 'h-6 w-6'} />
            )}
          </motion.span>
        </button>
      </div>

      {/* Transport */}
      <div className="flex items-center gap-4 px-5 py-4">
        <button
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong transition-colors hover:bg-white/[0.06]"
        >
          {playing ? <PauseIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
        </button>

        <div className="relative flex-1">
          <label htmlFor="scrub" className="sr-only">
            Position in lesson
          </label>
          <input
            id="scrub"
            type="range"
            min={0}
            max={lesson.duration}
            step={1}
            value={Math.floor(time)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="scrubber w-full"
            style={{
              background: `linear-gradient(to right, var(--ink) ${progress}%, var(--line-strong) ${progress}%)`,
            }}
          />
        </div>

        <span className="shrink-0 font-mono text-xs text-ink-faint">
          {formatTime(time)} / {formatTime(lesson.duration)}
        </span>
        <button
          onClick={onMute}
          disabled={!onMute}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          className="shrink-0 text-ink-faint transition-colors hover:text-ink disabled:opacity-40"
        >
          {muted ? <MuteIcon className="h-4 w-4" /> : <SpeakerIcon className="h-4 w-4" />}
        </button>
      </div>

      {/* What Aster is saying right now */}
      <div className="border-t border-line px-5 py-4">
        <AnimatePresence mode="wait">
          {speaking ? (
            <motion.div
              key="speaking"
              initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3"
            >
              <span className="mt-0.5 text-ink">
                <Waveform />
              </span>
              <p className="flex-1 text-sm leading-relaxed">{speaking.text}</p>
            </motion.div>
          ) : (
            <motion.p
              key="quiet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 text-sm text-ink-faint"
            >
              <SpeakerIcon className="h-4 w-4" />
              Quiet — the instructor has this covered.
            </motion.p>
          )}
        </AnimatePresence>

        <p className="label-micro mt-4">
          {lesson.consideredMoments} moments examined · {lesson.descriptions.length} described
        </p>
      </div>
    </section>
  );
}

/** A suggestion of what is on screen, keyed to the kind of visual described. */
/**
 * The stand-in screen for the sample lesson, which has no real video behind it.
 *
 * It has to be legible: drawn too faintly it reads as an image that failed to
 * load rather than as a deliberate placeholder, which is what a first-time
 * visitor sees before they have pasted any link.
 */
function FrameArt({ kind }: { kind?: Description['kind'] }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-8">
      <span className="label-micro absolute left-4 top-4 rounded-full border border-line-strong bg-surface/80 px-2.5 py-1 text-ink-faint">
        Sample lesson · simulated screen
      </span>
      <motion.div
        key={kind ?? 'idle'}
        initial={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-card border border-line bg-surface/40 p-5 font-mono text-[11px] leading-relaxed text-ink-soft"
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
          <p className="text-center text-lg tracking-wide text-ink">
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
                className="w-8 rounded-t bg-bloom/60"
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
