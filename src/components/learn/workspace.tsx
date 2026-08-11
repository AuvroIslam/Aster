'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from './stage';
import { Timeline } from './timeline';
import { TutorPanel, type TutorHandle } from './tutor';
import { PracticeSheet } from './practice';
import { SettingsPanel } from './settings';
import { ShortcutsDialog, SearchDialog } from './dialogs';
import { usePlayback } from './use-playback';
import { useShortcuts } from './use-shortcuts';
import { AsterMark, ChatIcon, TargetIcon, DocIcon } from '@/components/icons';
import { lesson } from '@/lib/fixtures';
import { cn, formatTime } from '@/lib/utils';
import type { LearnerQuestion } from '@/lib/types';

type Tab = 'tutor' | 'practice';

export function Workspace() {
  const playback = usePlayback(lesson.descriptions, lesson.duration);
  const [asked, setAsked] = useState<LearnerQuestion[]>([]);
  const [tab, setTab] = useState<Tab>('tutor');
  const [language, setLanguage] = useState('auto');
  const [highContrast, setHighContrast] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  /** Announced to a screen reader whenever the app changes state on its own. */
  const [announcement, setAnnouncement] = useState('');
  const tutorRef = useRef<TutorHandle>(null);
  const lastSpokenRef = useRef(playback.speaking);

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? 'high' : '';
  }, [highContrast]);

  // Remember the last thing spoken so R can replay it after it has finished.
  useEffect(() => {
    if (playback.speaking) lastSpokenRef.current = playback.speaking;
  }, [playback.speaking]);

  /** The frame Aster last described — what a question gets grounded against. */
  const nearest = useMemo(() => {
    const past = lesson.descriptions.filter((d) => d.time <= playback.time);
    return past.length ? past[past.length - 1] : null;
  }, [playback.time]);

  const heardIds = useMemo(() => new Set(playback.heard.map((d) => d.id)), [playback.heard]);

  const practiceCount = useMemo(() => {
    const concepts = new Set([
      ...playback.heard.map((d) => d.concept),
      ...asked.map((q) => q.concept),
    ]);
    concepts.delete('unanchored');
    return concepts.size;
  }, [playback.heard, asked]);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  useShortcuts(
    useMemo(
      () => ({
        onToggle: () => {
          playback.toggle();
          announce(playback.playing ? 'Paused' : 'Playing');
        },
        onSeekBy: (delta: number) => {
          playback.seek(playback.time + delta);
          announce(formatTime(playback.time + delta));
        },
        onSeekStart: () => {
          playback.seek(0);
          announce('Back to the start');
        },
        onSkipSpeech: () => {
          playback.stopSpeaking();
          announce('Description skipped');
        },
        onReplayLast: () => {
          if (lastSpokenRef.current) playback.replay(lastSpokenRef.current);
        },
        onToggleDescriptions: () => {
          const next = !playback.descriptionsOn;
          playback.setDescriptionsOn(next);
          announce(next ? 'Descriptions on' : 'Descriptions off');
        },
        onRateBy: (delta: number) => {
          const next = Math.min(2.5, Math.max(0.5, playback.rate + delta));
          playback.setRate(next);
          announce(`Speech speed ${next.toFixed(2)} times`);
        },
        onFocusAsk: () => {
          setTab('tutor');
          tutorRef.current?.focus();
        },
        onPreset: (index: number) => {
          setTab('tutor');
          tutorRef.current?.askPreset(index);
        },
        onSearch: () => setShowSearch(true),
        onHelp: () => setShowShortcuts(true),
        onEscape: () => {
          playback.stopSpeaking();
          setShowShortcuts(false);
          setShowSearch(false);
        },
      }),
      [playback, announce]
    )
  );

  return (
    <div className="min-h-dvh">
      {/* Two live regions: state changes are polite, errors would be assertive. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <AsterMark className="h-6 w-6 text-rust" />
            <span className="tracking-tight">Aster</span>
          </Link>
          <span className="ml-2 hidden text-sm text-ink-faint sm:block">
            {playback.playing ? 'Lesson playing' : 'Lesson paused'}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/study"
              className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-rust hover:text-rust sm:inline-flex"
            >
              <DocIcon className="h-3.5 w-3.5" />
              Notes and PDFs
            </Link>
            <button
              onClick={() => setShowSearch(true)}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-rust hover:text-rust"
            >
              Find a lesson
            </button>
            <span className="rounded-full bg-moss-soft px-3 py-1 text-xs font-medium text-moss">
              {practiceCount} {practiceCount === 1 ? 'concept' : 'concepts'} tracked
            </span>
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto grid max-w-[1600px] gap-5 p-4 xl:grid-cols-[300px_minmax(0,1fr)_400px]"
      >
        <motion.div
          initial={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          <SettingsPanel
            rate={playback.rate}
            onRate={playback.setRate}
            descriptionsOn={playback.descriptionsOn}
            onDescriptionsOn={playback.setDescriptionsOn}
            narration={playback.narration}
            onNarration={playback.setNarration}
            language={language}
            onLanguage={setLanguage}
            highContrast={highContrast}
            onHighContrast={setHighContrast}
            speaking={Boolean(playback.speaking)}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          <Stage
            lesson={lesson}
            time={playback.time}
            playing={playback.playing}
            speaking={playback.speaking}
            holding={playback.holding}
            onToggle={playback.toggle}
            onSeek={playback.seek}
          />
          <Timeline
            descriptions={lesson.descriptions}
            time={playback.time}
            heardIds={heardIds}
            onSeek={playback.seek}
            onReplay={playback.replay}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          <div className="glass flex gap-1 rounded-full p-1" role="tablist" aria-label="Assistant">
            {[
              { id: 'tutor' as const, label: 'Tutor', icon: ChatIcon },
              { id: 'practice' as const, label: 'Practice', icon: TargetIcon },
            ].map((entry) => (
              <button
                key={entry.id}
                role="tab"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={cn(
                  'relative flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
                  tab === entry.id ? 'text-white' : 'text-ink-soft hover:text-ink'
                )}
              >
                {tab === entry.id && (
                  <motion.span
                    layoutId="assistant-tab"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-rust"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <entry.icon className="h-4 w-4" />
                  {entry.label}
                  {entry.id === 'practice' && practiceCount > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[11px]',
                        tab === 'practice' ? 'bg-white/25' : 'bg-rust-soft text-rust'
                      )}
                    >
                      {practiceCount}
                    </span>
                  )}
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
              {tab === 'tutor' ? (
                <TutorPanel
                  time={playback.time}
                  nearest={nearest}
                  asked={asked}
                  handleRef={tutorRef}
                  onAsk={(question) => {
                    setAsked((prev) => [...prev, question]);
                    announce('Answer ready');
                  }}
                />
              ) : (
                <PracticeSheet
                  heard={playback.heard}
                  asked={asked}
                  onSeek={(seconds) => {
                    playback.seek(seconds);
                    setTab('tutor');
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </main>

      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <SearchDialog
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onPick={(query) => {
          setShowSearch(false);
          announce(`Loading ${query}`);
        }}
      />
    </div>
  );
}
