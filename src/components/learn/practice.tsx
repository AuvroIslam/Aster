'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { TargetIcon, CheckIcon, ArrowIcon, SpeakerIcon } from '@/components/icons';
import { buildPracticeSet, explainReason } from '@/lib/practice';
import { conceptNotes } from '@/lib/fixtures';
import { formatTime, cn } from '@/lib/utils';
import type { Description, LearnerQuestion, PracticeVerdict } from '@/lib/types';

/**
 * Judges an open response against the points a correct explanation must reach.
 * Deliberately generous — the goal is retrieval practice, not marking. In
 * production the model judges the explanation; the verdict shape stays the same.
 */
function judge(answer: string, expects: string[]): PracticeVerdict {
  if (!answer.trim()) return 'unanswered';

  const normalised = answer.toLowerCase();
  const hits = expects.filter((point) =>
    point
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .some((word) => normalised.includes(word))
  ).length;

  if (hits === 0) return 'missed';
  if (hits >= Math.ceil(expects.length / 2)) return 'correct';
  return 'partial';
}

export function PracticeSheet({
  heard,
  asked,
  onSeek,
}: {
  heard: Description[];
  asked: LearnerQuestion[];
  onSeek: (seconds: number) => void;
}) {
  const items = useMemo(
    () => buildPracticeSet(heard, asked, conceptNotes, 5),
    [heard, asked]
  );

  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [verdict, setVerdict] = useState<PracticeVerdict>('unanswered');

  const item = items[index];

  if (items.length === 0) {
    return (
      <section className="glass lift rounded-panel p-6 text-center" aria-label="Practice">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ground-deep text-ink-faint">
          <TargetIcon className="h-5 w-5" />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
          Nothing to practise yet
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-faint">
          Play the lesson. Every visual I have to describe, and every question you stop to ask,
          becomes something worth checking afterwards.
        </p>
      </section>
    );
  }

  function submit() {
    setVerdict(judge(draft, item.expects));
  }

  function next() {
    setVerdict('unanswered');
    setDraft('');
    setIndex((i) => (i + 1) % items.length);
  }

  return (
    <section className="glass lift rounded-panel" aria-label="Practice">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <TargetIcon className="h-5 w-5 text-rust" />
          Practice
        </h2>
        <span className="text-xs text-ink-faint">
          {index + 1} of {items.length} · built from your session
        </span>
      </header>

      <div className="p-5">
        {/* Why this question exists. The method, shown rather than claimed. */}
        <motion.div
          key={`${item.id}-why`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 text-xs"
        >
          <span
            className={cn(
              'rounded-full px-2.5 py-1 font-medium',
              item.reason === 'both'
                ? 'bg-rust text-white'
                : item.reason === 'asked'
                  ? 'bg-rust-soft text-rust'
                  : 'bg-moss-soft text-moss'
            )}
          >
            {explainReason(item.reason)}
          </span>
          <button
            onClick={() => onSeek(Math.max(0, item.sourceTime - 5))}
            className="inline-flex items-center gap-1 text-ink-faint underline-offset-2 transition-colors hover:text-rust hover:underline"
          >
            <SpeakerIcon className="h-3.5 w-3.5" />
            replay {formatTime(item.sourceTime)}
          </button>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 24, filter: 'blur(10px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -24, filter: 'blur(10px)' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="mt-4 text-balance font-display text-xl leading-snug tracking-tight">
              {item.prompt}
            </p>

            <label htmlFor="practice-answer" className="sr-only">
              Your answer
            </label>
            <textarea
              id="practice-answer"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Say it in your own words…"
              disabled={verdict !== 'unanswered'}
              className="mt-4 w-full resize-none rounded-card border border-line bg-surface px-4 py-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-ink-faint focus:border-rust disabled:opacity-70"
            />

            {verdict === 'unanswered' ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <motion.button
                  onClick={submit}
                  disabled={!draft.trim()}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className="rounded-full bg-rust px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  Check my answer
                </motion.button>
                <button
                  onClick={next}
                  className="text-sm text-ink-faint transition-colors hover:text-ink"
                >
                  Skip this one
                </button>
              </div>
            ) : (
              <Verdict verdict={verdict} item={item} onNext={next} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function Verdict({
  verdict,
  item,
  onNext,
}: {
  verdict: PracticeVerdict;
  item: ReturnType<typeof buildPracticeSet>[number];
  onNext: () => void;
}) {
  const tone = {
    correct: { label: 'That’s it.', className: 'border-moss/30 bg-moss-soft/60 text-moss' },
    partial: { label: 'Halfway there.', className: 'border-amber/35 bg-amber/10 text-amber' },
    missed: { label: 'Let me come at it differently.', className: 'border-rust/30 bg-rust-soft/60 text-rust' },
    unanswered: { label: '', className: '' },
  }[verdict];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mt-4"
    >
      <div className={cn('rounded-card border p-4', tone.className)}>
        <p className="flex items-center gap-2 text-sm font-medium">
          {verdict === 'correct' && <CheckIcon className="h-4 w-4" strokeWidth={2.4} />}
          {tone.label}
        </p>

        {/* Missing it earns a different explanation, never the same words again. */}
        {verdict !== 'correct' && item.reexplain && (
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.reexplain}</p>
        )}

        <ul className="mt-3 space-y-1.5">
          {item.expects.map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-ink-soft">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center gap-2 rounded-full bg-moss px-5 py-2.5 text-sm font-medium text-ground"
        >
          Next question
          <ArrowIcon className="h-4 w-4" />
        </motion.button>
        {verdict !== 'correct' && (
          <p className="text-xs text-ink-faint">I’ll ask this one again later.</p>
        )}
      </div>
    </motion.div>
  );
}
