'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { InView, InViewStagger, InViewItem } from '@/components/motion/in-view';
import { EyeIcon, SpeakerIcon, ChatIcon, TargetIcon } from '@/components/icons';

const STEPS = [
  {
    id: 'watch',
    label: 'Watch',
    icon: SpeakerIcon,
    headline: 'It stays quiet.',
    body: 'The instructor keeps talking. Aster speaks only when the screen carries something the narration leaves out — and only in a real pause, so two voices never collide.',
  },
  {
    id: 'understand',
    label: 'Understand',
    icon: EyeIcon,
    headline: 'It reads the room first.',
    body: 'Before judging a single frame, Aster reads the whole transcript and works out the subject, the key concepts, and how to pronounce the awkward terms. Descriptions come back in the lesson’s own vocabulary.',
  },
  {
    id: 'ask',
    label: 'Ask',
    icon: ChatIcon,
    headline: 'Pause and interrogate it.',
    body: 'Ask about the exact frame on screen. Read the code. Explain this formula. What changed? Every question you ask is quietly noted as a place you were unsure.',
  },
  {
    id: 'practice',
    label: 'Practice',
    icon: TargetIcon,
    headline: 'It tests what you could not see.',
    body: 'Not a generic quiz. Aster practises you on the visuals it had to describe and the moments you asked about — the concepts you took on trust rather than saw.',
  },
];

export function Loop() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.75', 'end 0.55'],
  });
  const height = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section id="how" className="relative px-4 py-28 sm:py-36">
      <div className="mx-auto max-w-5xl">
        <InView preset="blur" className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rust">The loop</p>
          <h2 className="mt-4 text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Watch, understand, ask, practise.
          </h2>
          <p className="mt-5 text-balance text-lg leading-relaxed text-ink-soft">
            Four stages, one continuous session. Each one feeds the next — which is what makes
            the last one worth anything.
          </p>
        </InView>

        <div ref={ref} className="relative mt-20">
          {/* The rail fills as you scroll — the loop literally drawing itself. */}
          <div className="absolute left-[27px] top-2 hidden h-full w-px bg-line sm:block" aria-hidden>
            <motion.div style={{ height }} className="w-px bg-gradient-to-b from-rust to-moss" />
          </div>

          <InViewStagger className="space-y-4" stagger={0.12}>
            {STEPS.map((step, i) => (
              <InViewItem key={step.id} preset="slide-left">
                <div className="group relative flex gap-5 rounded-panel p-4 transition-colors duration-500 hover:bg-surface/60 sm:p-5">
                  <div className="relative z-10 hidden sm:block">
                    <motion.div
                      whileHover={{ scale: 1.12, rotate: -6 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                      className="glass flex h-14 w-14 items-center justify-center rounded-full text-rust"
                    >
                      <step.icon className="h-6 w-6" />
                    </motion.div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs text-ink-faint">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-display text-2xl font-semibold tracking-tight">
                        {step.label}
                        <span className="ml-3 font-sans text-base font-normal text-rust opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                          {step.headline}
                        </span>
                      </h3>
                    </div>
                    <p className="mt-2 max-w-2xl leading-relaxed text-ink-soft">{step.body}</p>
                  </div>
                </div>
              </InViewItem>
            ))}
          </InViewStagger>
        </div>
      </div>
    </section>
  );
}
