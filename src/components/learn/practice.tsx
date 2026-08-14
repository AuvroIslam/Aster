'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TargetIcon, CheckIcon, ArrowIcon, SpeakerIcon, MuteIcon } from '@/components/icons';
import { Waveform } from '@/components/motion/waveform';
import { buildPracticeSet, explainReason, type ConceptNote } from '@/lib/practice';
import { conceptNotes } from '@/lib/fixtures';
import { api, ApiError } from '@/lib/api';
import { formatTime, cn } from '@/lib/utils';
import type { Description, LearnerQuestion, PracticeReason, PracticeVerdict } from '@/lib/types';
import { useDictation } from './use-dictation';

/** How long a learner may sit in silence before Aster offers a hint. */
const QUIET_MS = 22_000;

/**
 * One question, however it was arrived at.
 *
 * Generated questions are about the subject and have no timestamp; the locally
 * built ones cite the moment they came from. The sheet handles both.
 */
interface PracticeQuestion {
  id: string;
  prompt: string;
  concept: string;
  reference: string;
  reason?: PracticeReason;
  sourceTime?: number;
}

type Phase = 'asking' | 'answering' | 'grading' | 'judged';

export function PracticeSheet({
  heard,
  asked,
  onSeek,
  notes = conceptNotes,
  /** Videos cite a timestamp; documents cite a page. */
  locate = (value: number) => `replay ${formatTime(value)}`,
  emptyHint = 'Play the lesson. Every visual I have to describe, and every question you stop to ask, becomes something worth checking afterwards.',
  /** Everything described in the lesson, for practising without watching it all. */
  all = [],
  /** Reads text aloud through the same voice the lesson uses. */
  speak,
  /** With a real lesson, questions come from the model, about the subject. */
  videoId,
}: {
  heard: Description[];
  asked: LearnerQuestion[];
  onSeek: (seconds: number) => void;
  notes?: Record<string, ConceptNote>;
  locate?: (value: number) => string;
  emptyHint?: string;
  all?: Description[];
  speak?: (text: string) => Promise<unknown> | void;
  videoId?: string | null;
}) {
  /** Falls back to the whole lesson when the learner asks for it. */
  const [useAll, setUseAll] = useState(false);
  const source = useAll ? all : heard;

  const [generated, setGenerated] = useState<PracticeQuestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Real tutor questions about the topic, from the whole lesson.
   *
   * The concepts the learner heard second-hand or asked about are sent as a
   * steer, so the gap-driven priority survives — but the question asks about
   * the subject, not about what Aster said at some timestamp.
   */
  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    setLoading(true);

    const focus = [
      ...new Set([...heard.map((d) => d.concept), ...asked.map((q) => q.concept)]),
    ].filter((c) => c && c !== 'unanchored');

    api
      .practiceQuestions({ videoId, focus, count: 5 })
      .then((data) => {
        if (cancelled) return;
        setGenerated(
          (data.questions ?? []).map((q) => ({
            id: q.id,
            prompt: q.question,
            concept: q.concept,
            reference: q.reference,
          }))
        );
      })
      .catch(() => {
        /* Falls back to the locally built set below. */
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // Generated once per lesson: refetching as `heard` grows would rewrite the
    // question set under the learner mid-answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const localItems = useMemo(
    () => buildPracticeSet(source, useAll ? [] : asked, notes, 5),
    [source, asked, notes, useAll]
  );

  const items: PracticeQuestion[] = generated?.length
    ? generated
    : localItems.map((item) => ({
        id: item.id,
        prompt: item.prompt,
        concept: item.concept,
        reference: item.reference,
        reason: item.reason,
        sourceTime: item.sourceTime,
      }));

  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<Phase>('asking');
  const [verdict, setVerdict] = useState<PracticeVerdict>('unanswered');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dictation = useDictation();
  const quietTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const item = items[index];

  const clearQuiet = () => {
    if (quietTimer.current) clearTimeout(quietTimer.current);
    quietTimer.current = null;
  };

  useEffect(() => () => {
    clearQuiet();
    abortRef.current?.abort();
  }, []);

  /**
   * Asks the question out loud, then starts the quiet timer.
   *
   * A learner who cannot see the card has no idea a question is waiting unless
   * it is spoken, so this is the difference between a working exercise and a
   * blank screen.
   */
  useEffect(() => {
    if (!item) return;
    setPhase('asking');
    setVerdict('unanswered');
    setFeedback('');
    setDraft('');
    setError(null);

    let cancelled = false;
    (async () => {
      await speak?.(item.prompt);
      if (cancelled) return;
      setPhase('answering');
      clearQuiet();
      quietTimer.current = setTimeout(() => void nudge(), QUIET_MS);
    })();

    return () => {
      cancelled = true;
      clearQuiet();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  /** Offers a way in when the learner has gone quiet, rather than the answer. */
  const nudge = useCallback(async () => {
    if (!item) return;
    try {
      const { hint } = await api.practiceHint({
        concept: item.concept,
        reference: item.reference,
      });
      setFeedback(hint);
      await speak?.(hint);
    } catch {
      /* A missing hint is not worth an error message. */
    }
  }, [item, speak]);

  const submit = useCallback(
    async (answer: string) => {
      if (!item || !answer.trim()) return;
      clearQuiet();
      setPhase('grading');
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await api.gradeAnswer({
          concept: item.concept,
          question: item.prompt,
          reference: item.reference,
          answer,
          signal: controller.signal,
        });
        setVerdict(result.verdict);
        setFeedback(result.feedback);
        setPhase('judged');
        await speak?.(result.feedback);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof ApiError ? err.message : 'Could not reach the Aster server.');
        setPhase('answering');
      }
    },
    [item, speak]
  );

  /** Hold to talk; releasing submits whatever was heard. */
  const startListening = useCallback(async () => {
    clearQuiet();
    const heardText = await dictation.listen();
    if (heardText.trim()) void submit(heardText);
    else quietTimer.current = setTimeout(() => void nudge(), QUIET_MS);
  }, [dictation, submit, nudge]);

  function next() {
    clearQuiet();
    setIndex((i) => (i + 1) % items.length);
  }

  /*
   * On a real lesson the questions come from the model, so wait for them even
   * when a locally built set exists. Showing the fallback first and swapping it
   * out a few seconds later changes the question under the learner — and if
   * they are listening rather than looking, they would hear one question and
   * then be graded against another.
   */
  if (loading && (items.length === 0 || (videoId && !generated))) {
    return (
      <section className="panel rounded-panel p-6 text-center" aria-live="polite" aria-label="Practice">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ground-deep text-bloom">
          <Waveform bars={4} className="h-4" />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
          Writing your questions…
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-faint">
          Reading the whole lesson to work out what is worth checking.
        </p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="panel rounded-panel p-6 text-center" aria-label="Practice">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ground-deep text-ink-faint">
          <TargetIcon className="h-5 w-5" />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
          Nothing to practise yet
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-faint">{emptyHint}</p>

        {/* Practice is built from what was *heard*. Someone who skipped ahead
            has heard nothing, and an empty panel looks broken rather than
            principled — so offer the whole lesson explicitly. */}
        {all.length > 0 && (
          <button
            onClick={() => setUseAll(true)}
            className="mt-5 rounded-full border border-line px-4 py-2 text-sm transition-colors hover:border-line-strong"
          >
            Practise everything Aster described ({all.length})
          </button>
        )}
      </section>
    );
  }

  const listening = dictation.state === 'listening';

  return (
    <section className="panel rounded-panel" aria-label="Practice">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <TargetIcon className="h-5 w-5 text-ink" />
          Practice
        </h2>
        <span className="text-xs text-ink-faint">
          {index + 1} of {items.length} · {generated?.length ? 'on the whole lesson' : useAll ? 'whole lesson' : 'built from your session'}
        </span>
      </header>

      <div className="p-5">
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
                ? 'bg-ink text-ground'
                : item.reason === 'asked'
                  ? 'bg-white/[0.06] text-ink'
                  : 'bg-white/[0.05] text-ink-soft'
            )}
          >
            {item.reason ? explainReason(item.reason) : item.concept}
          </span>
          {item.sourceTime !== undefined && (
            <button
              onClick={() => onSeek(Math.max(0, item.sourceTime! - 5))}
              className="inline-flex items-center gap-1 text-ink-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
            >
              <SpeakerIcon className="h-3.5 w-3.5" />
              {locate(item.sourceTime)}
            </button>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 24, filter: 'blur(10px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -24, filter: 'blur(10px)' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <p
              className="mt-4 text-balance font-display text-xl leading-snug tracking-tight"
              aria-live="polite"
            >
              {item.prompt}
            </p>

            {phase !== 'judged' && (
              <>
                {/* Speaking is the primary way to answer here: the learner is
                    already listening, and typing is the slower path. */}
                {dictation.supported && (
                  <div className="mt-4">
                    <button
                      onPointerDown={() => void startListening()}
                      onPointerUp={dictation.stop}
                      onPointerLeave={() => listening && dictation.stop()}
                      onKeyDown={(e) => {
                        if ((e.key === ' ' || e.key === 'Enter') && !listening && !e.repeat) {
                          e.preventDefault();
                          void startListening();
                        }
                      }}
                      onKeyUp={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') dictation.stop();
                      }}
                      disabled={phase === 'grading'}
                      aria-label="Hold to answer out loud"
                      className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-colors',
                        listening ? 'bg-bloom text-ground' : 'bg-ink text-ground',
                        phase === 'grading' && 'opacity-50'
                      )}
                    >
                      {listening ? (
                        <>
                          <Waveform bars={4} className="h-3" />
                          Listening — let go when you are done
                        </>
                      ) : (
                        <>
                          <SpeakerIcon className="h-4 w-4" />
                          Hold to answer out loud
                        </>
                      )}
                    </button>
                    {dictation.transcript && (
                      <p className="mt-2 text-center text-xs text-ink-faint">
                        “{dictation.transcript}”
                      </p>
                    )}
                  </div>
                )}

                <label htmlFor="practice-answer" className="sr-only">
                  Your answer
                </label>
                <textarea
                  id="practice-answer"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder={
                    dictation.supported ? 'Or type it instead…' : 'Say it in your own words…'
                  }
                  disabled={phase === 'grading'}
                  className="mt-3 w-full resize-none rounded-card border border-line bg-surface px-4 py-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-ink-faint focus:border-ink disabled:opacity-70"
                />

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <motion.button
                    onClick={() => void submit(draft)}
                    disabled={!draft.trim() || phase === 'grading'}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    className="rounded-full border border-line-strong px-5 py-2.5 text-sm disabled:opacity-40"
                  >
                    {phase === 'grading' ? 'Checking…' : 'Check my answer'}
                  </motion.button>
                  <button
                    onClick={next}
                    className="text-sm text-ink-faint transition-colors hover:text-ink"
                  >
                    Skip this one
                  </button>
                  {phase === 'grading' && (
                    <span className="flex items-center gap-2 text-xs text-ink-faint">
                      <Waveform bars={3} className="h-3 text-bloom" />
                      thinking
                    </span>
                  )}
                </div>

                {/* A hint arrives here when the learner has gone quiet. The
                    graded verdict renders separately, below. */}
                {feedback && (
                  <p className="mt-3 rounded-card border border-line bg-surface/60 p-3 text-sm leading-relaxed text-ink-soft">
                    {feedback}
                  </p>
                )}
              </>
            )}

            {dictation.error && <p className="mt-3 text-xs text-live">{dictation.error}</p>}
            {error && (
              <p role="alert" className="mt-3 text-xs text-live">
                {error}
              </p>
            )}

            {phase === 'judged' && (
              <Verdict verdict={verdict} feedback={feedback} onNext={next} onRepeat={() => speak?.(feedback)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function Verdict({
  verdict,
  feedback,
  onNext,
  onRepeat,
}: {
  verdict: PracticeVerdict;
  feedback: string;
  onNext: () => void;
  onRepeat: () => void;
}) {
  const tone = {
    correct: { label: 'That’s it.', className: 'border-line bg-white/[0.05] text-ink-soft' },
    partial: { label: 'Halfway there.', className: 'border-line-strong bg-white/[0.06] text-live' },
    missed: {
      label: 'Let me come at it differently.',
      className: 'border-line-strong bg-white/[0.06] text-ink',
    },
    unanswered: { label: '', className: '' },
  }[verdict];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mt-4"
    >
      <div className={cn('rounded-card border p-4', tone.className)} aria-live="polite">
        <p className="flex items-center gap-2 text-sm font-medium">
          {verdict === 'correct' && <CheckIcon className="h-4 w-4" strokeWidth={2.4} />}
          {tone.label}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feedback}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-ground"
        >
          Next question
          <ArrowIcon className="h-4 w-4" />
        </motion.button>
        <button
          onClick={onRepeat}
          className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
        >
          <MuteIcon className="h-3.5 w-3.5" />
          Say that again
        </button>
        {verdict !== 'correct' && (
          <p className="text-xs text-ink-faint">I’ll ask this one again later.</p>
        )}
      </div>
    </motion.div>
  );
}
