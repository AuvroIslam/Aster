'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { DocIcon, SparkIcon, AsterMark } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { DocPhase } from './use-doc';

const STAGES = [
  'Reading the pages',
  'Finding figures, tables and formulas',
  'Working out the structure',
];

export function UploadZone({
  phase,
  error,
  onUpload,
  onSample,
  onRetry,
}: {
  phase: DocPhase;
  error: string | null;
  onUpload: (file: File) => void;
  onSample: () => void;
  onRetry: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = phase === 'uploading' || phase === 'extracting';

  function take(files: FileList | null) {
    const file = files?.[0];
    if (file) onUpload(file);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => take(e.target.files)}
      />

      <AnimatePresence mode="wait">
        {phase === 'error' ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="panel rounded-panel p-8 text-center"
          >
            <h2 className="headline text-2xl">That didn’t work.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={onRetry}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-ground"
              >
                Try another file
              </button>
              <button
                onClick={onSample}
                className="rounded-full border border-line px-5 py-2.5 text-sm text-ink-soft transition-colors hover:text-ink"
              >
                Use the sample chapter
              </button>
            </div>
          </motion.div>
        ) : busy ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="panel rounded-panel p-8"
            aria-live="polite"
          >
            <p className="flex items-center gap-3 text-sm font-medium">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              >
                <AsterMark className="h-5 w-5" />
              </motion.span>
              Reading your document
            </p>

            <ul className="mt-6 space-y-3">
              {STAGES.map((label, i) => (
                <li key={label} className="flex items-center gap-3">
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }}
                    className="h-1.5 w-1.5 rounded-full bg-bloom"
                  />
                  <span className="text-sm text-ink-soft">{label}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : (
          <motion.div key="drop" exit={{ opacity: 0, scale: 0.97, filter: 'blur(10px)' }}>
            <motion.button
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                take(e.dataTransfer.files);
              }}
              animate={dragging ? { scale: 1.02 } : { scale: 1 }}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={cn(
                'panel flex w-full flex-col items-center rounded-panel border-2 border-dashed px-8 py-16 text-center transition-colors',
                dragging ? 'border-bloom' : 'border-line'
              )}
            >
              <motion.span
                animate={dragging ? { rotate: [0, -8, 8, 0] } : {}}
                transition={{ duration: 0.6 }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line text-bloom"
              >
                <DocIcon className="h-7 w-7" />
              </motion.span>

              <h2 className="headline mt-6 text-2xl">Drop a PDF, notes, or slides</h2>
              <p className="mt-3 max-w-md text-balance leading-relaxed text-ink-soft">
                I read the words, then do the part a screen reader cannot — pull apart every table,
                formula and figure so you get what a sighted reader gets.
              </p>
              <span className="mt-6 rounded-full bg-ink px-6 py-3 text-sm font-medium text-ground">
                Choose a file
              </span>
            </motion.button>

            <button
              onClick={onSample}
              className="mx-auto mt-4 flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
            >
              <SparkIcon className="h-4 w-4" />
              Or explore the sample chapter
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
