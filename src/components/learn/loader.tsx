'use client';

import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AsterMark, ArrowIcon, PlayIcon } from '@/components/icons';
import type { LessonPhase, LessonProgress } from './use-lesson';
import { api, type ReadyVideo } from '@/lib/api';
import { cn, formatTime } from '@/lib/utils';

/** The bar that turns a URL into a described lesson. */
export function UrlBar({
  onLoad,
  busy,
  onDemo,
  showDemo,
}: {
  onLoad: (url: string) => void;
  busy: boolean;
  onDemo: () => void;
  showDemo: boolean;
}) {
  const [draft, setDraft] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim()) onLoad(draft.trim());
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor="video-url" className="sr-only">
        YouTube link
      </label>
      <input
        id="video-url"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste a YouTube link…"
        disabled={busy}
        className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-ink disabled:opacity-50"
      />
      <motion.button
        type="submit"
        disabled={busy || !draft.trim()}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-ground disabled:opacity-40"
      >
        {busy ? 'Working…' : 'Load lesson'}
      </motion.button>
      {showDemo && (
        <button
          type="button"
          onClick={onDemo}
          className="shrink-0 rounded-full border border-line px-4 py-2.5 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
        >
          Use the sample lesson
        </button>
      )}
    </form>
  );
}

const STEPS = [
  'Reading the captions',
  'Understanding the whole lesson',
  'Finding the natural pauses',
  'Deciding what needs describing',
];

/**
 * Processing is front-loaded and can take minutes on a long video, so the wait
 * is narrated rather than hidden behind a spinner.
 */
export function Processing({
  phase,
  progress,
  error,
  onRetry,
  onDemo,
}: {
  phase: LessonPhase;
  progress: LessonProgress;
  error: string | null;
  onRetry: () => void;
  onDemo: () => void;
}) {
  if (phase === 'error') {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel rounded-panel p-8 text-center"
        aria-live="assertive"
      >
        <h2 className="headline text-2xl">That didn’t work.</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">{error}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={onRetry}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-ground"
          >
            Try again
          </button>
          <button
            onClick={onDemo}
            className="rounded-full border border-line px-5 py-2.5 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            Use the sample lesson
          </button>
        </div>
      </motion.section>
    );
  }

  const active = Math.min(STEPS.length - 1, Math.floor((progress.percent / 100) * STEPS.length));

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel rounded-panel p-8"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          <AsterMark className="h-5 w-5" />
        </motion.span>
        <p className="text-sm font-medium">{progress.step || 'Preparing the lesson'}</p>
        <span className="ml-auto font-mono text-xs text-ink-faint">{progress.percent}%</span>
      </div>

      <div className="mt-5 h-[3px] overflow-hidden rounded-full bg-line-strong">
        <motion.div
          className="h-full bg-bloom"
          animate={{ width: `${Math.max(4, progress.percent)}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <ul className="mt-6 space-y-2.5">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors duration-500',
                i < active ? 'bg-bloom' : i === active ? 'bg-ink' : 'bg-ink-ghost'
              )}
            />
            <span
              className={cn(
                'text-sm transition-colors duration-500',
                i <= active ? 'text-ink-soft' : 'text-ink-ghost'
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs leading-relaxed text-ink-faint">
        This happens once per video. Everything is cached, so opening it again is instant.
      </p>
    </motion.section>
  );
}

/**
 * Videos this server has already described, offered as one-click examples.
 *
 * Renders nothing when the server is unreachable or has no cached timelines —
 * the URL bar is the primary path, and a broken list would be worse than none.
 */
export function ReadyVideos({
  onPick,
  busy,
  onCount,
}: {
  onPick: (url: string) => void;
  busy?: boolean;
  /** Reports how many are available, so the empty state can point at them. */
  onCount?: (count: number) => void;
}) {
  const [videos, setVideos] = useState<ReadyVideo[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .readyVideos()
      .then((data) => {
        if (cancelled) return;
        const found = data?.videos ?? [];
        setVideos(found);
        onCount?.(found.length);
      })
      .catch(() => {
        /* No server, or nothing cached. Stay out of the way. */
      });
    return () => {
      cancelled = true;
    };
    // `onCount` is a stable setter from the parent; refetching on identity
    // changes would hammer the endpoint on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (videos.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      id="ready-to-play"
      className="panel rounded-panel p-5"
      aria-labelledby="ready-heading"
    >
      <h2 id="ready-heading" className="font-display text-lg font-semibold tracking-tight">
        Ready to play
      </h2>
      <p id="ready-help" className="mt-1 text-sm text-ink-faint">
        {videos.length === 1
          ? '1 lesson has already been described on this server.'
          : `${videos.length} lessons have already been described on this server.`}{' '}
        They start straight away, with no processing wait.
      </p>

      <ul className="mt-4 space-y-1.5" aria-describedby="ready-help">
        {videos.map((video) => (
          <li key={video.videoId}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(video.url)}
              aria-label={`${video.title}${video.channel ? `, by ${video.channel}` : ''}${
                video.duration ? `, ${formatTime(video.duration)}` : ''
              }, ${video.descriptions} audio description${
                video.descriptions === 1 ? '' : 's'
              }. Ready to play now.`}
              className="group flex w-full items-center gap-3 rounded-card border border-line bg-surface/60 p-2 text-left transition-colors hover:border-line-strong hover:bg-white/[0.06] disabled:opacity-40"
            >
              {/* Decorative: the label above already names the lesson. */}
              <Image
                src={video.thumbnail}
                alt=""
                width={96}
                height={54}
                unoptimized
                className="h-[54px] w-24 shrink-0 rounded object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{video.title}</span>
                <span className="block truncate text-xs text-ink-faint" aria-hidden>
                  {video.channel}
                  {video.channel && video.duration ? ' · ' : ''}
                  {video.duration ? formatTime(video.duration) : ''}
                  {` · ${video.descriptions} description${video.descriptions === 1 ? '' : 's'}`}
                </span>
              </span>
              <PlayIcon className="mr-1 h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-ink" />
            </button>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}

/**
 * Sends the learner to the already-described lessons below, moving keyboard
 * focus with the scroll so this works without a mouse and announces itself.
 */
function goToReadyList() {
  const section = document.getElementById('ready-to-play');
  if (!section) return false;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  section.querySelector('button')?.focus({ preventScroll: true });
  return true;
}

/** Shown before anything is loaded. */
export function EmptyStage({ onDemo, readyCount = 0 }: { onDemo: () => void; readyCount?: number }) {
  // Real described lessons beat the fixture whenever the server has any, so
  // the primary action points at them and only falls back to the sample.
  const hasReady = readyCount > 0;

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="panel grid place-items-center rounded-panel px-8 py-20 text-center"
      >
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
        >
          <AsterMark className="h-10 w-10" />
        </motion.span>
        <h2 className="headline mt-6 text-2xl">Paste a lesson to begin.</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
          Aster reads the captions, looks at the frames, and speaks only where the screen carries
          something the narration leaves out.
        </p>
        <button
          onClick={() => {
            if (hasReady && goToReadyList()) return;
            onDemo();
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm transition-colors hover:border-line-strong"
        >
          <PlayIcon className="h-3.5 w-3.5" />
          {hasReady
            ? `Explore ${readyCount} described ${readyCount === 1 ? 'lesson' : 'lessons'}`
            : 'Explore the sample lesson'}
          <ArrowIcon className="h-3.5 w-3.5" />
        </button>
      </motion.section>
    </AnimatePresence>
  );
}
