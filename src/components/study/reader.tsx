'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { PracticeSheet } from '@/components/learn/practice';
import { useSpeech } from '@/components/learn/use-speech';
import { Waveform } from '@/components/motion/waveform';
import {
  DocIcon,
  GraphIcon,
  EyeIcon,
  SpeakerIcon,
  ChatIcon,
  TargetIcon,
  SparkIcon,
  CheckIcon,
} from '@/components/icons';
import { docConceptNotes } from '@/lib/fixtures';
import { cn } from '@/lib/utils';
import type { BlockKind, Description, DocBlock, LearnerQuestion, StudyDoc } from '@/lib/types';

const KIND_ICON: Record<BlockKind, typeof DocIcon> = {
  heading: DocIcon,
  text: DocIcon,
  figure: EyeIcon,
  table: DocIcon,
  formula: SparkIcon,
  chart: GraphIcon,
};

/**
 * A described block in a document is the same signal as a described visual in a
 * video: information a sighted reader takes in at a glance, that this reader
 * received only through Aster. Mapping it onto `Description` lets the identical
 * practice logic run over both.
 */
function blocksAsDescriptions(blocks: DocBlock[]): Description[] {
  return blocks
    .filter((block) => block.described && block.concept)
    .map((block) => ({
      id: block.id,
      // Documents have pages where a video has seconds.
      time: block.page,
      mode: block.kind === 'table' || block.kind === 'chart' ? 'explain' : 'brief',
      kind: block.kind === 'chart' ? 'graph' : block.kind === 'table' ? 'slide' : 'diagram',
      text: block.content,
      confidence: 0.9,
      concept: block.concept as string,
    }));
}

const DOC_PRESETS = [
  'Summarise this chapter',
  'Describe figure 7.1',
  'Read the table aloud',
  'What is the balance factor?',
];

export function Reader({ doc }: { doc: StudyDoc }) {
  const [read, setRead] = useState<Set<string>>(new Set());
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [asked, setAsked] = useState<LearnerQuestion[]>([]);
  const [tab, setTab] = useState<'ask' | 'practice'>('ask');
  const [draft, setDraft] = useState('');
  const { speak, supported: speechSupported } = useSpeech();

  const describedBlocks = useMemo(
    () => doc.blocks.filter((block) => block.described),
    [doc]
  );

  /** Only blocks the learner has actually had read to them count as heard. */
  const heard = useMemo(
    () => blocksAsDescriptions(doc.blocks.filter((block) => read.has(block.id))),
    [doc, read]
  );

  /**
   * Real synthesis, not a timer: `speak` resolves when the utterance actually
   * ends, so the reading indicator tracks the voice rather than an estimate.
   * Starting a second block cancels the first, which resolves its promise as
   * cancelled — hence the guard, so the older call cannot clear the newer one.
   */
  async function readAloud(block: DocBlock) {
    setSpeaking(block.id);
    setRead((prev) => new Set(prev).add(block.id));
    await speak(block.content);
    setSpeaking((current) => (current === block.id ? null : current));
  }

  function ask(question: string) {
    if (!question.trim()) return;
    const target = describedBlocks.find((block) =>
      question.toLowerCase().includes((block.concept ?? '').split(' ').pop() ?? '')
    );

    setAsked((prev) => [
      ...prev,
      {
        id: `dq-${Date.now()}`,
        time: target?.page ?? 1,
        question,
        answer:
          target?.content ??
          'The chapter argues that a search tree is only fast while it stays shallow, and that rotations are the cheap local fix that keeps it that way.',
        grounded: Boolean(target),
        concept: target?.concept ?? 'chapter summary',
      },
    ]);
    setDraft('');
  }

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <motion.section
        initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="panel rounded-panel"
        aria-label="Document"
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-ink">
            <DocIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-semibold tracking-tight">
              {doc.title}
            </h2>
            <p className="text-sm text-ink-faint">
              {doc.pages} pages · {doc.words.toLocaleString()} words ·{' '}
              <span className="text-ink">{describedBlocks.length} visuals described</span>
            </p>
          </div>
        </header>

        <ul className="divide-y divide-line">
          {doc.blocks.map((block, i) => {
            const Icon = KIND_ICON[block.kind];
            const isSpeaking = speaking === block.id;
            const hasRead = read.has(block.id);

            return (
              <motion.li
                key={block.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.4) }}
                className={cn(
                  'group flex gap-4 px-5 py-4 transition-colors duration-300',
                  isSpeaking ? 'bg-white/[0.06]' : 'hover:bg-surface/50'
                )}
              >
                <div className="flex w-14 shrink-0 flex-col items-center gap-2">
                  <span className="font-mono text-[11px] text-ink-faint">p{block.page}</span>
                  {block.described && (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-ink">
                      <Icon className="h-4 w-4" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {block.described && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-ink px-2 py-0.5 text-ground">
                        {block.kind}
                      </span>
                      <span className="text-ink-faint">
                        described for you — a sighted reader sees this
                      </span>
                      {hasRead && (
                        <span className="ml-auto inline-flex items-center gap-1 text-ink-soft">
                          <CheckIcon className="h-3 w-3" strokeWidth={2.6} />
                          heard
                        </span>
                      )}
                    </div>
                  )}

                  <p
                    className={cn(
                      block.kind === 'heading'
                        ? 'font-display text-lg font-semibold tracking-tight'
                        : 'text-sm leading-relaxed',
                      block.described ? 'text-ink' : 'text-ink-soft'
                    )}
                  >
                    {block.content}
                  </p>

                  <button
                    onClick={() => readAloud(block)}
                    disabled={!speechSupported}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-faint opacity-0 transition-all duration-300 hover:text-ink focus-visible:opacity-100 disabled:cursor-not-allowed disabled:hover:text-ink-faint group-hover:opacity-100"
                  >
                    {isSpeaking ? (
                      <>
                        <Waveform bars={4} className="h-3 text-ink" />
                        <span className="text-ink">reading…</span>
                      </>
                    ) : (
                      <>
                        <SpeakerIcon className="h-3.5 w-3.5" />
                        {speechSupported ? 'Read this aloud' : 'Speech unavailable in this browser'}
                      </>
                    )}
                  </button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </motion.section>

      <motion.aside
        initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-5"
      >
        <div className="panel flex gap-1 rounded-full p-1" role="tablist" aria-label="Document assistant">
          {[
            { id: 'ask' as const, label: 'Ask', icon: ChatIcon },
            { id: 'practice' as const, label: 'Quiz', icon: TargetIcon },
          ].map((entry) => (
            <button
              key={entry.id}
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={cn(
                'relative flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
                tab === entry.id ? 'text-ground' : 'text-ink-soft hover:text-ink'
              )}
            >
              {tab === entry.id && (
                <motion.span
                  layoutId="doc-tab"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-ink"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <entry.icon className="h-4 w-4" />
                {entry.label}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, filter: 'blur(8px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === 'ask' ? (
              <section className="panel rounded-panel p-5" aria-label="Ask about this document">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Ask about this chapter
                </h2>

                <div className="mt-4 space-y-2">
                  {DOC_PRESETS.map((preset) => (
                    <motion.button
                      key={preset}
                      onClick={() => ask(preset)}
                      whileHover={{ x: 4 }}
                      className="w-full rounded-card border border-line bg-surface/60 px-3 py-2.5 text-left text-sm transition-colors hover:border-line-strong hover:bg-white/[0.08]"
                    >
                      {preset}
                    </motion.button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(draft);
                  }}
                  className="mt-4 flex gap-2"
                >
                  <label htmlFor="doc-ask" className="sr-only">
                    Ask about the document
                  </label>
                  <input
                    id="doc-ask"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ask anything…"
                    className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-ink"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-full bg-ink px-5 py-3 text-sm font-medium text-ground"
                  >
                    Ask
                  </button>
                </form>

                <ul className="mt-5 space-y-3">
                  <AnimatePresence initial={false}>
                    {[...asked].reverse().map((entry) => (
                      <motion.li
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0 }}
                        className="rounded-card border border-line bg-surface/70 p-4"
                      >
                        <p className="text-sm font-medium">{entry.question}</p>
                        <p className="mt-1 text-xs text-ink-soft">
                          {entry.grounded ? `Found on page ${entry.time}` : 'From the whole chapter'}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{entry.answer}</p>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ) : (
              <PracticeSheet
                heard={heard}
                asked={asked}
                notes={docConceptNotes}
                locate={(page) => `re-read page ${page}`}
                emptyHint="Have me read a figure, table or formula aloud. Those are the parts you cannot skim — so those are the parts worth checking."
                onSeek={() => setTab('ask')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.aside>
    </div>
  );
}
