'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { DocIcon, SparkIcon, CheckIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const STAGES = [
  'Reading the pages',
  'Finding figures, tables and formulas',
  'Working out what the chapter is about',
  'Describing each visual for the ear',
];

export function UploadZone({ onDone }: { onDone: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState(-1);

  const processing = stage >= 0;

  useEffect(() => {
    if (!processing) return;

    if (stage >= STAGES.length) {
      const done = setTimeout(onDone, 500);
      return () => clearTimeout(done);
    }

    const next = setTimeout(() => setStage((s) => s + 1), 900);
    return () => clearTimeout(next);
  }, [stage, processing, onDone]);

  return (
    <div className="mx-auto max-w-2xl">
      <AnimatePresence mode="wait">
        {!processing ? (
          <motion.div
            key="drop"
            exit={{ opacity: 0, scale: 0.97, filter: 'blur(10px)' }}
            transition={{ duration: 0.4 }}
          >
            <motion.button
              onClick={() => setStage(0)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                setStage(0);
              }}
              animate={dragging ? { scale: 1.02 } : { scale: 1 }}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={cn(
                'panel flex w-full flex-col items-center rounded-panel border-2 border-dashed px-8 py-16 text-center transition-colors',
                dragging ? 'border-line-strong bg-white/[0.06]' : 'border-line'
              )}
            >
              <motion.span
                animate={dragging ? { rotate: [0, -8, 8, 0] } : {}}
                transition={{ duration: 0.6 }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] text-ink"
              >
                <DocIcon className="h-7 w-7" />
              </motion.span>

              <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">
                Drop a PDF, notes, or slides
              </h2>
              <p className="mt-3 max-w-md text-balance leading-relaxed text-ink-soft">
                I read the words, then do the part a screen reader cannot — describe every figure,
                table, chart and formula so you get what a sighted reader gets.
              </p>
              <span className="mt-6 rounded-full bg-ink px-6 py-3 text-sm font-medium text-ground">
                Choose a file
              </span>
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.97, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="panel rounded-panel p-8"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <SparkIcon className="h-4 w-4" />
              Gemma is reading your chapter
            </p>

            <ul className="mt-6 space-y-3" aria-live="polite">
              {STAGES.map((label, i) => {
                const done = stage > i;
                const active = stage === i;

                return (
                  <li key={label} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-500',
                        done
                          ? 'bg-ink text-ground'
                          : active
                            ? 'bg-ink text-ground'
                            : 'bg-ground-deep text-ink-faint'
                      )}
                    >
                      {done ? (
                        <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                      ) : (
                        <motion.span
                          animate={active ? { scale: [1, 1.4, 1] } : {}}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="h-1.5 w-1.5 rounded-full bg-current"
                        />
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-sm transition-colors duration-500',
                        done || active ? 'text-ink' : 'text-ink-faint'
                      )}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 h-1 overflow-hidden rounded-full bg-line">
              <motion.div
                className="h-full bg-gradient-to-r from-ink to-ink-faint"
                animate={{ width: `${Math.min(100, (stage / STAGES.length) * 100)}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
