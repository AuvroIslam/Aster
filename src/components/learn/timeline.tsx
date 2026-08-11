'use client';

import { motion } from 'motion/react';
import {
  CodeIcon,
  TerminalIcon,
  GraphIcon,
  DocIcon,
  EyeIcon,
  PlayIcon,
  SpeakerIcon,
} from '@/components/icons';
import { formatTime, cn } from '@/lib/utils';
import type { Description, VisualKind } from '@/lib/types';

const KIND_ICON: Record<VisualKind, typeof CodeIcon> = {
  code: CodeIcon,
  terminal: TerminalIcon,
  diagram: EyeIcon,
  graph: GraphIcon,
  formula: DocIcon,
  slide: DocIcon,
};

export function Timeline({
  descriptions,
  time,
  heardIds,
  onSeek,
  onReplay,
}: {
  descriptions: Description[];
  time: number;
  heardIds: Set<string>;
  onSeek: (seconds: number) => void;
  onReplay: (description: Description) => void;
}) {
  return (
    <section className="glass lift rounded-panel" aria-label="Audio descriptions">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Audio descriptions{' '}
          <span className="font-sans text-sm font-normal text-ink-faint">
            ({descriptions.length})
          </span>
        </h2>
        <p className="text-xs text-ink-faint">
          {heardIds.size} heard so far
        </p>
      </header>

      <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
        {descriptions.map((description, i) => {
          const Icon = KIND_ICON[description.kind];
          const isPast = time >= description.time;
          const isCurrent = time >= description.time && time < description.time + 6;
          const isHeard = heardIds.has(description.id);

          return (
            <motion.li
              key={description.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4) }}
            >
              <div
                className={cn(
                  'group flex gap-3 px-5 py-4 transition-colors duration-300',
                  isCurrent ? 'bg-rust-soft/50' : 'hover:bg-surface/60'
                )}
              >
                <button
                  onClick={() => onSeek(description.time)}
                  aria-label={`Jump to ${formatTime(description.time)}`}
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                    isCurrent
                      ? 'bg-rust text-white'
                      : isPast
                        ? 'bg-rust-soft text-rust'
                        : 'bg-ground-deep text-ink-faint',
                    'group-hover:scale-110'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-rust">{formatTime(description.time)}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5',
                        description.mode === 'explain'
                          ? 'bg-moss-soft text-moss'
                          : 'bg-ground-deep text-ink-faint'
                      )}
                    >
                      {description.mode === 'explain' ? 'full explanation' : 'brief'}
                    </span>
                    {description.mode === 'explain' && (
                      <span className="text-ink-faint">pauses video</span>
                    )}
                    <span
                      className={cn(
                        'ml-auto',
                        description.confidence < 0.8 ? 'text-amber' : 'text-ink-faint'
                      )}
                    >
                      confidence {Math.round(description.confidence * 100)}%
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{description.text}</p>

                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => onReplay(description)}
                      className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-rust"
                    >
                      <SpeakerIcon className="h-3.5 w-3.5" />
                      Replay
                    </button>
                    <button
                      onClick={() => onSeek(Math.max(0, description.time - 4))}
                      className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-rust"
                    >
                      <PlayIcon className="h-3.5 w-3.5" />
                      Play from here
                    </button>
                    {isHeard && (
                      <span className="ml-auto rounded-full bg-moss-soft px-2 py-0.5 text-[11px] text-moss">
                        heard
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
