'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { Waveform } from '@/components/motion/waveform';
import {
  DocIcon,
  GraphIcon,
  EyeIcon,
  SpeakerIcon,
  SparkIcon,
  PauseIcon,
  PlayIcon,
  ChatIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import type { BlockKind, DocBlock, StudyDoc } from '@/lib/types';
import { useReading, type ReadingStatus } from './use-reading';
import { useAsk } from './use-ask';
import { PdfPage } from './pdf-page';

const KIND_ICON: Record<BlockKind, typeof DocIcon> = {
  heading: DocIcon,
  text: DocIcon,
  figure: EyeIcon,
  table: DocIcon,
  formula: SparkIcon,
  chart: GraphIcon,
};

/**
 * Says what Aster is doing, out loud in the accessibility tree as well as on
 * screen. The gap between scrolling and the voice starting is several seconds
 * of model latency, and unexplained silence reads as a broken feature.
 */
function StatusPill({ status }: { status: ReadingStatus }) {
  if (status.kind === 'idle') return null;

  const label =
    status.kind === 'settling'
      ? `Page ${status.page} — hold still…`
      : status.kind === 'thinking'
        ? `Reading page ${status.page}…`
        : `Explaining page ${status.page}`;

  return (
    <span
      aria-live="polite"
      className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft"
    >
      {status.kind === 'speaking' ? (
        <Waveform bars={4} className="h-3 text-bloom" />
      ) : (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
          className="inline-block h-3 w-3 rounded-full border border-line-strong border-t-bloom"
        />
      )}
      {label}
    </span>
  );
}

/** A keyboard key in running text. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-ink-soft">{children}</kbd>
  );
}

/** Groups the flat block list into the pages the reader scrolls through. */
function byPage(blocks: DocBlock[]) {
  const pages = new Map<number, DocBlock[]>();
  for (const block of blocks) {
    const list = pages.get(block.page) ?? [];
    list.push(block);
    pages.set(block.page, list);
  }
  return [...pages.entries()].sort((a, b) => a[0] - b[0]);
}

export function PageReader({ doc }: { doc: StudyDoc }) {
  const reading = useReading(doc.id, doc.pages);
  const pages = useMemo(() => byPage(doc.blocks), [doc.blocks]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLElement>());

  // Read through a ref so the hook always asks about the page in view now,
  // not the one that was current when the handler was created.
  const pageRef = useRef(1);
  pageRef.current = reading.currentPage;
  const ask = useAsk(doc.id, () => pageRef.current);
  /** When W went down, to tell a hold from a tap. */
  const pressedAt = useRef(0);

  const { onPageInView, mode, currentPage } = reading;

  /**
   * Tracks which page the learner is actually looking at. Only the page
   * nearest the top of the viewport counts — with several pages visible at
   * once, anything else would flip between them as you scroll.
   */
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (!top) return;
        const page = Number(top.target.getAttribute('data-page'));
        if (Number.isInteger(page)) onPageInView(page);
      },
      { root, rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );

    for (const el of pageRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [onPageInView, pages.length]);

  // In auto mode the reader follows the voice rather than the other way round.
  // `onPageInView` ignores the observer while this runs, so the smooth scroll
  // passing over intermediate pages cannot redirect the walk.
  useEffect(() => {
    if (mode !== 'auto') return;
    const el = pageRefs.current.get(currentPage);
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [mode, currentPage]);

  const running = mode !== 'idle';

  /**
   * Keyboard control, so the document is navigable without sight or a mouse.
   *
   * S moves on a page. W is hold-to-talk: press and speak a question, release
   * and Aster answers out loud. Both stand down while the learner is typing.
   */
  useEffect(() => {
    const typing = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        reading.stop();
        return;
      }
      if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        const next = reading.goToPage(currentPage + 1);
        pageRefs.current.get(next)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (key === 'w' && !event.repeat) {
        event.preventDefault();
        // Pressing W while already listening ends the question.
        if (ask.asking) {
          ask.finish();
          return;
        }
        pressedAt.current = Date.now();
        void ask.start();
      }
    }

    /**
     * Releasing W only stops the recogniser if the key was actually *held*.
     *
     * A quick tap used to start and stop listening within a few milliseconds,
     * capturing nothing and reporting nothing — which is exactly why this
     * looked dead. A tap now latches: keep talking, and press W again to send.
     */
    function onKeyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'w') return;
      const held = Date.now() - pressedAt.current;
      if (held >= 500) ask.finish();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 p-4">
      <section className="panel rounded-panel" aria-label="Reading controls">
        <header className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
            <DocIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-semibold tracking-tight">
              {doc.title}
            </h2>
            <p className="text-sm text-ink-faint">
              {doc.pages} pages · {doc.words.toLocaleString()} words · page{' '}
              <span className="text-ink">{currentPage}</span>
            </p>
          </div>

          <StatusPill status={reading.status} />
        </header>

        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
          <button
            onClick={reading.readSummary}
            disabled={reading.summaryLoading}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-ground disabled:opacity-50"
          >
            <SparkIcon className="h-4 w-4" />
            {reading.summaryLoading ? 'Summarising…' : 'Summarise the whole document'}
          </button>

          <button
            onClick={() => (mode === 'auto' ? reading.stop() : void reading.startAuto(currentPage))}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
              mode === 'auto'
                ? 'border-bloom text-bloom'
                : 'border-line hover:border-line-strong'
            )}
            aria-pressed={mode === 'auto'}
          >
            {mode === 'auto' ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
            {mode === 'auto' ? 'Stop reading' : 'Explain page by page'}
          </button>

          <button
            onClick={() => (mode === 'follow' ? reading.stop() : reading.startFollow())}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
              mode === 'follow'
                ? 'border-bloom text-bloom'
                : 'border-line hover:border-line-strong'
            )}
            aria-pressed={mode === 'follow'}
          >
            <EyeIcon className="h-4 w-4" />
            {mode === 'follow' ? 'Stop following' : 'Explain as I scroll'}
          </button>

          {ask.supported && (
            <button
              onPointerDown={() => void ask.start()}
              onPointerUp={ask.finish}
              onPointerLeave={() => ask.asking && ask.finish()}
              aria-label="Hold to ask a question about this page"
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
                ask.asking ? 'border-bloom bg-bloom text-ground' : 'border-line hover:border-line-strong'
              )}
            >
              {ask.asking ? <Waveform bars={4} className="h-3" /> : <ChatIcon className="h-4 w-4" />}
              {ask.asking ? 'Listening…' : 'Hold W to ask'}
            </button>
          )}

          {running && (
            <button
              onClick={reading.stop}
              className="ml-auto rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              Stop
            </button>
          )}
        </div>

        <p className="border-t border-line px-5 py-2 text-xs text-ink-faint">
          <Key>S</Key> next page · <Key>W</Key> hold to ask · <Key>Esc</Key> stop
        </p>

        {/* Every stage of a spoken question is reported here, out loud in the
            accessibility tree too. Silence during the several seconds this
            takes is what made the feature feel dead. */}
        {(ask.asking || ask.thinking) && (
          <div
            aria-live="assertive"
            className="flex items-center gap-3 border-t border-line px-5 py-3"
          >
            {ask.thinking ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong border-t-bloom"
              />
            ) : (
              <Waveform bars={5} className="h-4 shrink-0 text-bloom" />
            )}
            <span className="min-w-0 flex-1 text-sm">
              {ask.thinking ? (
                <span className="text-ink-soft">Thinking about your question…</span>
              ) : ask.transcript ? (
                <span className="text-ink">“{ask.transcript}”</span>
              ) : (
                <span className="text-ink-soft">
                  Listening — speak now, then press <Key>W</Key> again or let go.
                </span>
              )}
            </span>
          </div>
        )}

        {(ask.error || ask.dictationError) && !ask.asking && (
          <p role="alert" className="border-t border-line px-5 py-3 text-xs text-live">
            {ask.error ?? ask.dictationError}
          </p>
        )}

        {ask.history.length > 0 && (
          <ul className="border-t border-line px-5 py-4 space-y-3">
            {[...ask.history].reverse().slice(0, 3).map((entry) => (
              <li key={entry.id} className="rounded-card border border-line bg-surface/60 p-3">
                <p className="text-sm font-medium">{entry.question}</p>
                {entry.page && <p className="mt-0.5 text-xs text-ink-faint">about page {entry.page}</p>}
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{entry.answer}</p>
              </li>
            ))}
          </ul>
        )}

        {!reading.speechSupported && (
          <p className="border-t border-line px-5 py-3 text-xs text-live">
            This browser has no speech synthesis. Explanations will appear as text only.
          </p>
        )}
        {reading.error && (
          <p role="alert" className="border-t border-line px-5 py-3 text-xs text-live">
            {reading.error}
          </p>
        )}

        <AnimatePresence>
          {reading.summary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-line"
            >
              <div className="px-5 py-4">
                <p className="label-micro text-ink-faint">Summary</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                  {reading.summary}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* The document itself: one continuous scroll, split into pages. */}
      <div
        ref={scrollerRef}
        className="panel max-h-[70vh] overflow-y-auto rounded-panel"
        aria-label="Document"
      >
        {pages.map(([page, blocks]) => {
          const active = reading.status.kind !== 'idle' && reading.status.page === page;
          const busy = reading.status.kind === 'thinking' && reading.status.page === page;

          return (
          <section
            key={page}
            data-page={page}
            ref={(el) => {
              if (el) pageRefs.current.set(page, el);
              else pageRefs.current.delete(page);
            }}
            aria-label={`Page ${page}`}
            className={cn(
              'border-b border-line px-5 py-5 transition-colors duration-500',
              currentPage === page && 'bg-white/[0.03]',
              // The page being worked on is marked clearly, so a glance says
              // where Aster is even when it is still thinking.
              active && 'bg-bloom/[0.06] ring-1 ring-inset ring-bloom/30'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-ink-faint">page {page}</span>
              {active && (
                <span className="rounded-full bg-bloom/15 px-2 py-0.5 text-[11px] text-bloom">
                  {reading.status.kind === 'settling'
                    ? 'holding…'
                    : reading.status.kind === 'thinking'
                      ? 'reading…'
                      : 'explaining'}
                </span>
              )}
              <span className="h-px flex-1 bg-line" />
              <button
                onClick={() => void reading.readPage(page)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink disabled:opacity-50"
              >
                <SpeakerIcon className="h-3.5 w-3.5" />
                {busy ? 'Thinking…' : 'Explain this page'}
              </button>
            </div>

            {/* The page as it actually looks. */}
            <div className="mt-3">
              <PdfPage docId={doc.id} page={page} active={Math.abs(page - currentPage) <= 2} />
            </div>

            {/*
              The same page as text, for screen readers. The canvas above says
              nothing to assistive technology, and this is the surface whose
              whole reason for existing is that a blind reader gets the content
              — so it is in the DOM, just not competing for the eye.
            */}
            <div className="sr-only">
              <h3>Page {page} text</h3>
              {blocks.map((block) => (
                <p key={block.id}>{block.content}</p>
              ))}
            </div>

            {/* Visual blocks are still worth naming on screen: they are what
                a sighted reader takes in at a glance and Aster has to say. */}
            {blocks.some((b) => b.described) && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-hidden>
                {blocks
                  .filter((b) => b.described)
                  .map((block) => {
                    const Icon = KIND_ICON[block.kind];
                    return (
                      <li
                        key={block.id}
                        className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-ink-faint"
                      >
                        <Icon className="h-3 w-3" />
                        {block.kind}
                      </li>
                    );
                  })}
              </ul>
            )}

            {/* A placeholder while the model works, so the wait is visibly a
                wait rather than nothing happening. */}
            {busy && !reading.explanations[page] && (
              <div className="mt-4 rounded-card border border-line bg-surface/40 p-4">
                <p className="label-micro flex items-center gap-2 text-ink-faint">
                  <SparkIcon className="h-3.5 w-3.5" />
                  Aster is reading page {page}…
                </p>
                <div className="mt-3 space-y-2" aria-hidden>
                  {[100, 92, 64].map((width) => (
                    <motion.div
                      key={width}
                      animate={{ opacity: [0.25, 0.6, 0.25] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="h-2 rounded-full bg-line-strong"
                      style={{ width: `${width}%` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {reading.explanations[page] && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-card border border-line-strong bg-surface/70 p-4"
                >
                  <p className="label-micro flex items-center gap-2 text-bloom">
                    <SparkIcon className="h-3.5 w-3.5" />
                    Aster explains page {page}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {reading.explanations[page]}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
          );
        })}
      </div>
    </div>
  );
}

export default PageReader;
