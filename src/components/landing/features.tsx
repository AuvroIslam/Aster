'use client';

import Link from 'next/link';
import { InView, InViewStagger, InViewItem } from '@/components/motion/in-view';
import { Magnetic, TiltCard } from '@/components/motion/tilt-card';
import { SpeakerIcon, ChatIcon, DocIcon, ArrowIcon, AsterMark } from '@/components/icons';

const FEATURES = [
  {
    icon: SpeakerIcon,
    title: 'Adaptive audio description',
    body: 'The creator’s narration plays untouched. Aster interrupts only when a diagram, a block of code, or a terminal is carrying information the words never mention.',
    points: ['Speaks into natural pauses', 'Pauses the video for long explanations', 'Full narration mode if you prefer it'],
  },
  {
    icon: ChatIcon,
    title: 'An AI tutor that watched with you',
    body: 'Not a chatbot with a transcript. Aster can look at the exact frame you paused on, re-explain a concept a different way, and walk you through it interactively.',
    points: ['Grounded in the frame on screen', 'Re-explains rather than repeats', 'Says when it cannot confirm something'],
  },
  {
    icon: DocIcon,
    title: 'Notes and PDFs, made audible',
    body: 'Upload a textbook chapter or your own notes. Aster reads the figures and tables aloud properly — then builds practice from the same gap-driven logic.',
    points: ['Describes figures, not just text', 'Handles tables and equations', 'Generates practice from the material'],
  },
];

export function Features() {
  return (
    <section id="features" className="px-4 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <InView preset="blur" className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rust">What you get</p>
          <h2 className="mt-4 text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Three surfaces, one learner model.
          </h2>
        </InView>

        <InViewStagger className="mt-16 grid gap-6 md:grid-cols-3" stagger={0.13}>
          {FEATURES.map((feature) => (
            <InViewItem key={feature.title} preset="rise">
              <TiltCard intensity={6} className="h-full rounded-panel">
                <article className="glass lift flex h-full flex-col rounded-panel p-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rust-soft text-rust">
                    <feature.icon className="h-5 w-5" />
                  </span>

                  <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">{feature.body}</p>

                  <ul className="mt-5 space-y-2 border-t border-line pt-5">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-center gap-2 text-sm text-ink-faint">
                        <span className="h-1 w-1 rounded-full bg-rust" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              </TiltCard>
            </InViewItem>
          ))}
        </InViewStagger>
      </div>
    </section>
  );
}

export function CallToAction() {
  return (
    <section className="px-4 pb-32">
      <InView preset="scale" className="mx-auto max-w-4xl">
        <div className="glass lift relative overflow-hidden rounded-panel px-8 py-16 text-center">
          <div
            aria-hidden
            className="animate-drift pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-rust/20 blur-[90px]"
          />
          <div
            aria-hidden
            className="animate-pulse-soft pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-moss/25 blur-[90px]"
          />

          <span className="mx-auto mb-6 flex h-12 w-12 items-center justify-center text-rust">
            <AsterMark className="h-10 w-10" />
          </span>

          <h2 className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Paste a link. Start learning.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-balance leading-relaxed text-ink-soft">
            Every control is keyboard-reachable, every state is announced, and nothing here
            requires sight.
          </p>

          <Magnetic>
            <Link
              href="/learn"
              className="glow group mt-9 inline-flex items-center gap-2 rounded-full bg-rust px-8 py-4 font-medium text-white"
            >
              Open Aster
              <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Magnetic>
        </div>
      </InView>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-ink-faint">
        <p className="flex items-center gap-2">
          <AsterMark className="h-5 w-5 text-rust" />
          Aster — audio-first learning.
        </p>
        <p>Built for learners who were told the video was “self-explanatory”.</p>
      </div>
    </footer>
  );
}
