'use client';

import { motion } from 'motion/react';
import { InView, InViewStagger, InViewItem } from '@/components/motion/in-view';
import { PlayIcon, ChatIcon, DocIcon } from '@/components/icons';

const FEATURES = [
  {
    n: '01',
    icon: PlayIcon,
    title: 'YouTube Accessibility',
    body: 'Aster understands the entire video and explains important visual information in a way a visually impaired learner can understand.',
    cards: [
      {
        title: 'Adaptive description',
        body: 'The creator keeps speaking and Aster pauses only when visual information needs explanation.',
      },
      {
        title: 'Full explanation',
        body: 'Aster narrates the entire lesson visually, describing what appears on screen.',
      },
    ],
  },
  {
    n: '02',
    icon: ChatIcon,
    title: 'Interactive AI Tutor',
    body: 'Aster becomes a personal tutor that answers questions, re-explains difficult concepts, and guides students through what they are learning.',
    cards: [],
  },
  {
    n: '03',
    icon: DocIcon,
    title: 'Notes & PDF Learning',
    body: 'Upload notes, textbooks, or PDFs. Aster understands the material, explains it accessibly, and creates quizzes to help students learn.',
    cards: [],
  },
];

export function Features() {
  return (
    <section id="features" className="px-6 py-28 sm:px-10 sm:py-36">
      <div className="mx-auto max-w-[1180px]">
        <InView preset="blur">
          <h2 className="headline text-balance text-4xl sm:text-5xl md:text-[3.75rem]">
            Learning should never depend on sight.
          </h2>
        </InView>

        <div className="mt-20 border-t border-line">
          {FEATURES.map((feature, i) => (
            <InView key={feature.n} preset="rise" delay={i * 0.05}>
              <article className="group grid gap-6 border-b border-line py-14 md:grid-cols-[7rem_1fr]">
                <div className="flex items-start gap-5">
                  <span className="font-mono text-xs text-ink-faint">{feature.n}</span>
                  <motion.span
                    whileHover={{ scale: 1.1, borderColor: 'var(--ink)' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors duration-500 group-hover:text-ink"
                  >
                    <feature.icon className="h-4 w-4" />
                  </motion.span>
                </div>

                <div className="min-w-0">
                  <h3 className="headline text-[1.75rem] sm:text-[2rem]">{feature.title}</h3>
                  <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
                    {feature.body}
                  </p>

                  {feature.cards.length > 0 && (
                    <InViewStagger className="mt-8 grid gap-4 sm:grid-cols-2" stagger={0.1}>
                      {feature.cards.map((card) => (
                        <InViewItem key={card.title}>
                          <motion.div
                            whileHover={{ y: -4, borderColor: 'var(--line-strong)' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                            className="panel h-full rounded-card p-5"
                          >
                            <h4 className="text-[15px] font-medium">{card.title}</h4>
                            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{card.body}</p>
                          </motion.div>
                        </InViewItem>
                      ))}
                    </InViewStagger>
                  )}
                </div>
              </article>
            </InView>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: '01', title: 'Content', body: 'YouTube videos, notes & PDFs' },
  { n: '02', title: 'Understanding', body: 'Aster understands text, visuals, diagrams, code and context.' },
  { n: '03', title: 'Learning', body: 'Listen, ask questions, understand and practice.' },
];

export function HowItWorks() {
  return (
    <section id="how" className="px-6 pb-28 sm:px-10 sm:pb-36">
      <div className="mx-auto max-w-[1180px]">
        <InView preset="blur">
          <p className="label-micro">How it works</p>
        </InView>

        {/* Each step and the arrow after it are separate grid cells, so the
            reveal animates on a real box rather than a `display: contents` one. */}
        <InViewStagger
          className="mt-8 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch"
          stagger={0.12}
        >
          {STEPS.map((step, i) => [
            <InViewItem key={step.n} className="h-full">
              <motion.div
                whileHover={{ y: -5, borderColor: 'var(--line-strong)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                className="panel h-full rounded-panel p-7"
              >
                <span className="font-mono text-xs text-ink-faint">{step.n}</span>
                <h3 className="headline mt-4 text-2xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </motion.div>
            </InViewItem>,
            i < STEPS.length - 1 ? (
              <InViewItem
                key={`${step.n}-arrow`}
                className="hidden items-center justify-center text-ink-ghost md:flex"
              >
                <motion.svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                >
                  <path d="M4 12h16M14 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </InViewItem>
            ) : null,
          ])}
        </InViewStagger>
      </div>
    </section>
  );
}
