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
} from '@/components/icons';
import { cn } from '@/lib/utils';
import type { BlockKind, DocBlock, StudyDoc } from '@/lib/types';
import { useReading } from './use-reading';

const KIND_ICON: Record<BlockKind, typeof DocIcon> = {
  heading: DocIcon,
  text: DocIcon,
  figure: EyeIcon,
  table: DocIcon,
  formula: SparkIcon,
  chart: GraphIcon,
};

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
  useEffect(() => {
    if (mode !== 'auto') return;
    const el = pageRefs.current.get(currentPage);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [mode, currentPage]);

  const running = mode !== 'idle';

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

          {reading.speaking && (
            <span className="flex items-center gap-2 text-xs text-ink-soft">
              <Waveform bars={4} className="h-3 text-bloom" />
              speaking
            </span>
          )}
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

          {running && (
            <button
              onClick={reading.stop}
              className="ml-auto rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              Stop
            </button>
          )}
        </div>

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
        {pages.map(([page, blocks]) => (
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
              currentPage === page && 'bg-white/[0.03]'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-ink-faint">page {page}</span>
              <span className="h-px flex-1 bg-line" />
              <button
                onClick={() => void reading.readPage(page)}
                disabled={reading.busyPage === page}
                className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink disabled:opacity-50"
              >
                <SpeakerIcon className="h-3.5 w-3.5" />
                {reading.busyPage === page ? 'Thinking…' : 'Explain this page'}
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {blocks.map((block) => {
                const Icon = KIND_ICON[block.kind];
                return (
                  <li key={block.id} className="flex gap-3">
                    {block.described && (
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-ink-faint">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <p
                      className={cn(
                        block.kind === 'heading'
                          ? 'font-display text-base font-semibold tracking-tight'
                          : 'text-sm leading-relaxed',
                        block.described ? 'text-ink' : 'text-ink-soft'
                      )}
                    >
                      {block.content}
                    </p>
                  </li>
                );
              })}
            </ul>

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
        ))}
      </div>
    </div>
  );
}

export default PageReader;
