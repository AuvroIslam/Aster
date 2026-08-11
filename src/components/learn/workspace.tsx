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
import { UrlBar, Processing, EmptyStage } from './loader';
import { usePlayback } from './use-playback';
import { useShortcuts } from './use-shortcuts';
import { useLesson } from './use-lesson';
import { useYouTube } from './use-youtube';
import { AsterMark, ChatIcon, TargetIcon, DocIcon } from '@/components/icons';
import { lesson as sampleLesson } from '@/lib/fixtures';
import { cn, formatTime } from '@/lib/utils';
import type { Description, LearnerQuestion } from '@/lib/types';

type Tab = 'tutor' | 'practice';

export function Workspace() {
  const loader = useLesson();
  const [useSample, setUseSample] = useState(false);

  const lesson = loader.lesson ?? (useSample ? sampleLesson : null);
  const live = Boolean(loader.lesson);

  const [asked, setAsked] = useState<LearnerQuestion[]>([]);
  const [tab, setTab] = useState<Tab>('tutor');
  const [highContrast, setHighContrast] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const tutorRef = useRef<TutorHandle>(null);
  const lastSpokenRef = useRef<Description | null>(null);
  const playbackRef = useRef<ReturnType<typeof usePlayback> | null>(null);

  const youtube = useYouTube({
    videoId: live ? loader.videoId : null,
    // Reads through a ref because the player is created before playback exists.
    onStateChange: (isPlaying) => playbackRef.current?.syncPlaying(isPlaying),
  });

  const playback = usePlayback(
    lesson?.descriptions ?? [],
    lesson?.duration ?? 0,
    live ? youtube.bridge : null,
    lesson?.language ?? 'en'
  );
  playbackRef.current = playback;

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? 'high' : '';
  }, [highContrast]);

  useEffect(() => {
    if (playback.speaking) lastSpokenRef.current = playback.speaking;
  }, [playback.speaking]);

  // A new lesson re-arms the schedule and clears the session's question log.
  const loadedId = loader.lesson?.id;
  useEffect(() => {
    if (!loadedId) return;
    playbackRef.current?.reset();
    setAsked([]);
  }, [loadedId]);

  /** The frame Aster last described — what a question gets grounded against. */
  const nearest = useMemo(() => {
    if (!lesson) return null;
    const past = lesson.descriptions.filter((d) => d.time <= playback.time);
    return past.length ? past[past.length - 1] : null;
  }, [lesson, playback.time]);

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
    ),
    Boolean(lesson)
  );

  const busy = loader.phase === 'loading' || loader.phase === 'processing';

  return (
    <div className="min-h-dvh">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <header className="panel sticky top-0 z-30 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <AsterMark className="h-5 w-5" />
            <span className="tracking-tight">Aster</span>
          </Link>

          <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <UrlBar
              onLoad={(url) => {
                setUseSample(false);
                void loader.load(url);
              }}
              busy={busy}
              onDemo={() => setUseSample(true)}
              showDemo={!lesson}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/study"
              className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs transition-colors hover:border-line-strong sm:inline-flex"
            >
              <DocIcon className="h-3.5 w-3.5" />
              Notes and PDFs
            </Link>
            <button
              onClick={() => setShowSearch(true)}
              className="rounded-full border border-line px-3 py-1.5 text-xs transition-colors hover:border-line-strong"
            >
              Find a lesson
            </button>
            {lesson && (
              <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-ink-soft">
                {practiceCount} {practiceCount === 1 ? 'concept' : 'concepts'} tracked
              </span>
            )}
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
            volume={playback.volume}
            onVolume={playback.setVolume}
            voiceURI={playback.voiceURI}
            onVoiceURI={playback.setVoiceURI}
            voices={playback.voices}
            voiceAvailable={playback.voiceAvailable}
            speechSupported={playback.speechSupported}
            descriptionsOn={playback.descriptionsOn}
            onDescriptionsOn={playback.setDescriptionsOn}
            narration={playback.narration}
            onNarration={playback.setNarration}
            language={lesson?.language ?? 'auto'}
            highContrast={highContrast}
            onHighContrast={setHighContrast}
            speaking={Boolean(playback.speaking)}
            onTestVoice={() =>
              void playback.speakText('This is how Aster will describe what is on screen.')
            }
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          <AnimatePresence mode="wait">
            {busy || loader.phase === 'error' ? (
              <Processing
                key="processing"
                phase={loader.phase}
                progress={loader.progress}
                error={loader.error}
                onRetry={loader.clear}
                onDemo={() => {
                  loader.clear();
                  setUseSample(true);
                }}
              />
            ) : lesson ? (
              <motion.div key="lesson" className="space-y-5">
                <Stage
                  lesson={lesson}
                  time={playback.time}
                  playing={playback.playing}
                  speaking={playback.speaking}
                  holding={playback.holding}
                  onToggle={playback.toggle}
                  onSeek={playback.seek}
                  playerHost={youtube.hostRef}
                  live={live}
                  muted={youtube.muted}
                  onMute={live ? youtube.toggleMute : undefined}
                />
                <Timeline
                  descriptions={lesson.descriptions}
                  time={playback.time}
                  heardIds={heardIds}
                  onSeek={playback.seek}
                  onReplay={playback.replay}
                />
              </motion.div>
            ) : (
              <EmptyStage key="empty" onDemo={() => setUseSample(true)} />
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          <div className="panel flex gap-1 rounded-full p-1" role="tablist" aria-label="Assistant">
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
                  tab === entry.id ? 'text-ground' : 'text-ink-soft hover:text-ink'
                )}
              >
                {tab === entry.id && (
                  <motion.span
                    layoutId="assistant-tab"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-ink"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <entry.icon className="h-4 w-4" />
                  {entry.label}
                  {entry.id === 'practice' && practiceCount > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[11px]',
                        tab === 'practice' ? 'bg-ground/20' : 'bg-white/[0.08] text-ink-soft'
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
                  videoId={live ? loader.videoId : null}
                  onAsk={(question) => {
                    setAsked((prev) => [...prev, question]);
                    announce('Answer ready');
                  }}
                  onSpeak={(text) => void playback.speakText(text)}
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
        onPick={(url) => {
          setShowSearch(false);
          setUseSample(false);
          void loader.load(url);
        }}
      />
    </div>
  );
}
