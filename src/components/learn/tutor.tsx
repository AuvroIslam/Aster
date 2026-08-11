'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { ChatIcon, SparkIcon, CheckIcon, EyeIcon, SpeakerIcon } from '@/components/icons';
import { Waveform } from '@/components/motion/waveform';
import { api, ApiError } from '@/lib/api';
import { formatTime, cn } from '@/lib/utils';
import type { Description, LearnerQuestion } from '@/lib/types';

const PRESETS = [
  { key: '1', id: 'whats-on-screen', label: 'What’s on screen?' },
  { key: '2', id: 'read-the-code', label: 'Read the code' },
  { key: '3', id: 'read-the-terminal', label: 'Read the terminal' },
  { key: '4', id: 'describe-the-diagram', label: 'Describe the diagram' },
  { key: '5', id: 'explain-the-formula', label: 'Explain the formula' },
  { key: '6', id: 'simpler', label: 'Say it more simply' },
  { key: '7', id: 'why-it-matters', label: 'Why does this matter?' },
  { key: '8', id: 'what-changed', label: 'What changed?' },
];

/**
 * Offline fallback, used only when there is no live video to ground against —
 * the sample lesson. It never invents a frame: with nothing described nearby it
 * says so, which is the same rule the server applies.
 */
function localAnswer(preset: string, nearest: Description | null) {
  if (!nearest) {
    return {
      answer:
        'Nothing on screen right now carries information the narration is leaving out. Ask again once something is drawn or written.',
      grounded: false,
      concept: 'unanchored',
    };
  }

  const map: Record<string, string> = {
    'What’s on screen?': nearest.text,
    'Read the code': `${nearest.text} The structure matters more than the characters — that is what I read out first.`,
    'Read the terminal': nearest.text,
    'Describe the diagram': nearest.text,
    'Explain the formula': nearest.text,
    'Say it more simply': `Put plainly: ${nearest.concept} is the point here. ${nearest.text}`,
    'Why does this matter?': `Because the rest of the lesson leans on ${nearest.concept}. Miss it and the next section will not follow.`,
    'What changed?': `Since the last moment I described, the screen moved on to ${nearest.concept}.`,
  };

  return {
    answer: map[preset] ?? nearest.text,
    grounded: nearest.confidence >= 0.8,
    concept: nearest.concept,
  };
}

export interface TutorHandle {
  focus: () => void;
  askPreset: (index: number) => void;
}

export function TutorPanel({
  time,
  nearest,
  asked,
  onAsk,
  handleRef,
  videoId,
  onSpeak,
}: {
  time: number;
  nearest: Description | null;
  asked: LearnerQuestion[];
  onAsk: (question: LearnerQuestion) => void;
  handleRef?: RefObject<TutorHandle | null>;
  /** When present, questions are answered by the model against a real frame. */
  videoId?: string | null;
  onSpeak?: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(question: string, presetId?: string) {
    const text = question.trim();
    if (!text || thinking) return;

    setThinking(true);
    setFailure(null);
    abortRef.current?.abort();

    try {
      let result: { answer: string; grounded: boolean; concept: string };

      if (videoId) {
        const controller = new AbortController();
        abortRef.current = controller;
        const wire = await api.askFrame({
          videoId,
          time,
          question: text,
          presetId,
          signal: controller.signal,
        });
        result = {
          answer: wire.answer,
          grounded: wire.grounded,
          // The server may not name a concept; anchor to the nearest described
          // visual so the answer still feeds gap-driven practice.
          concept: wire.concept ?? nearest?.concept ?? 'unanchored',
        };
      } else {
        await new Promise((r) => setTimeout(r, 500));
        result = localAnswer(text, nearest);
      }

      onAsk({
        id: `q-${Date.now()}`,
        time,
        question: text,
        answer: result.answer,
        grounded: result.grounded,
        concept: result.concept,
      });

      onSpeak?.(result.answer);
      setDraft('');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setFailure(
        err instanceof ApiError ? err.message : 'Could not reach the server to answer that.'
      );
    } finally {
      setThinking(false);
    }
  }

  useImperativeHandle(handleRef, () => ({
    focus: () => inputRef.current?.focus(),
    askPreset: (index: number) => {
      const preset = PRESETS[index];
      if (preset) void ask(preset.label, preset.id);
    },
  }));

  return (
    <section className="panel rounded-panel" aria-label="Ask about the screen">
      <header className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight">
          <ChatIcon className="h-5 w-5 text-bloom" />
          Ask about the screen
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-faint">
          I pause the lesson, look at the current frame, answer, then resume.
        </p>
      </header>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset, i) => (
            <motion.button
              key={preset.key}
              onClick={() => void ask(preset.label, preset.id)}
              disabled={thinking}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="group flex items-center gap-2 rounded-card border border-line bg-surface-raised px-3 py-2.5 text-left text-sm transition-colors hover:border-line-strong disabled:opacity-50"
            >
              <kbd className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/[0.06] font-mono text-[10px] text-ink-faint transition-colors group-hover:bg-bloom group-hover:text-ground">
                {preset.key}
              </kbd>
              <span className="truncate">{preset.label}</span>
            </motion.button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
          className="mt-4 flex gap-2"
        >
          <label htmlFor="ask" className="sr-only">
            Type your question
          </label>
          <input
            id="ask"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={300}
            placeholder="Type your question…"
            className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
          />
          <motion.button
            type="submit"
            disabled={thinking || !draft.trim()}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-5 py-3 text-sm font-medium text-ground disabled:opacity-40"
          >
            Ask
            <SparkIcon className="h-4 w-4" />
          </motion.button>
        </form>

        <AnimatePresence>
          {thinking && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-center gap-2 text-sm text-bloom"
            >
              <Waveform bars={4} />
              Looking at the frame at {formatTime(time)}…
            </motion.p>
          )}
          {failure && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              role="alert"
              className="mt-3 text-sm text-live"
            >
              {failure}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {asked.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <h3 className="text-sm font-medium">Answers</h3>
          <ul className="mt-3 space-y-3">
            <AnimatePresence initial={false}>
              {[...asked].reverse().map((entry) => (
                <motion.li
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-card border border-line bg-surface-raised p-4"
                >
                  <p className="text-sm font-medium">
                    <span className="text-ink-faint">You asked: </span>
                    {entry.question}
                  </p>
                  <p
                    className={cn(
                      'mt-2 flex items-center gap-1.5 text-xs',
                      entry.grounded ? 'text-ink-soft' : 'text-live'
                    )}
                  >
                    {entry.grounded ? (
                      <>
                        <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                        Grounded in the frame at {formatTime(entry.time)}
                      </>
                    ) : (
                      <>
                        <EyeIcon className="h-3.5 w-3.5" />
                        I could not confirm this from the frame — treat it with caution.
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{entry.answer}</p>

                  {onSpeak && (
                    <button
                      onClick={() => onSpeak(entry.answer)}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-bloom"
                    >
                      <SpeakerIcon className="h-3.5 w-3.5" />
                      Read it again
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </section>
  );
}
