'use client';

import { motion } from 'motion/react';
import { InView } from '@/components/motion/in-view';
import { Parallax } from '@/components/motion/parallax';
import { TiltCard } from '@/components/motion/tilt-card';
import { CheckIcon, GraphIcon, ChatIcon, EyeIcon } from '@/components/icons';

const SIGNALS = [
  {
    icon: EyeIcon,
    tag: 'Described, never seen',
    detail: '12 visuals reached you through Aster’s voice instead of your eyes.',
    strength: 'High priority',
  },
  {
    icon: ChatIcon,
    tag: 'You asked about it',
    detail: 'You stopped at 8:21 and asked what the formula meant.',
    strength: 'High priority',
  },
  {
    icon: GraphIcon,
    tag: 'Spoken by the instructor',
    detail: 'Covered fully in the narration. You heard it exactly as a sighted learner did.',
    strength: 'Skipped',
  },
];

export function Method() {
  return (
    <section id="method" className="relative overflow-hidden px-4 py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-ground-deep/40 to-transparent" />

      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
        <InView preset="slide-left">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rust">Teaching method</p>
          <h2 className="mt-4 text-balance font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Aster already knows what you couldn’t see.
          </h2>

          <div className="mt-6 space-y-5 text-lg leading-relaxed text-ink-soft">
            <p>
              Every audio description is a record of a concept delivered to your ear instead of
              your eye. Those are the fragile ones — you got them second-hand, in one pass, with
              no diagram to glance back at.
            </p>
            <p className="text-ink">
              So that is what Aster practises you on. Not five generic questions about the video.
              The specific things you had to take on trust.
            </p>
          </div>

          <ul className="mt-8 space-y-3">
            {[
              'Silent during the lesson — practice is offered, never forced.',
              'One question at a time, phrased to be answered out loud.',
              'Miss one and it is re-explained differently, then asked again later.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-ink-soft">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-moss-soft text-moss">
                  <CheckIcon className="h-3 w-3" strokeWidth={2.4} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </InView>

        <Parallax speed={-0.22} clamp={110}>
          <InView preset="scale">
            <TiltCard intensity={7} className="rounded-panel">
              <div className="glass lift rounded-panel p-6 sm:p-8">
                <p className="text-sm text-ink-faint">What Aster decides to test</p>

                <div className="mt-5 space-y-3">
                  {SIGNALS.map((signal, i) => {
                    const skipped = signal.strength === 'Skipped';
                    return (
                      <motion.div
                        key={signal.tag}
                        initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        viewport={{ once: true, margin: '-15%' }}
                        transition={{ duration: 0.6, delay: i * 0.14, ease: [0.22, 1, 0.36, 1] }}
                        className={`rounded-card border p-4 transition-colors duration-300 ${
                          skipped
                            ? 'border-line bg-ground-deep/40 opacity-60'
                            : 'border-rust/25 bg-rust-soft/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <signal.icon className={`h-4 w-4 ${skipped ? 'text-ink-faint' : 'text-rust'}`} />
                          <span className="text-sm font-medium">{signal.tag}</span>
                          <span
                            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
                              skipped ? 'bg-ground text-ink-faint' : 'bg-rust text-white'
                            }`}
                          >
                            {signal.strength}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{signal.detail}</p>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-card border border-moss/25 bg-moss-soft/60 p-4">
                  <p className="text-sm font-medium text-moss">Resulting question</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    “I described a right-skewed tree at 3:45. In your own words — why does that
                    shape make lookup slow?”
                  </p>
                </div>
              </div>
            </TiltCard>
          </InView>
        </Parallax>
      </div>
    </section>
  );
}
