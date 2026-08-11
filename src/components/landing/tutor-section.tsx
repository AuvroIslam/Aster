'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { InView } from '@/components/motion/in-view';
import { AsterMark, DocIcon, SpeakerIcon, SparkIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

export function TutorSection() {
  return (
    <section className="px-6 pb-28 sm:px-10 sm:pb-36">
      <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <InView preset="slide-left">
          <p className="label-micro">Interactive AI tutor</p>
          <h2 className="headline mt-5 text-4xl sm:text-[2.75rem]">
            Ask anything.
            <br />
            Understand everything.
          </h2>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-soft">
            Aster is a patient tutor that answers questions, re-explains difficult concepts, and
            guides students through what they are learning — by voice or text.
          </p>
        </InView>

        <InView preset="scale">
          <div className="panel rounded-panel p-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="ml-auto w-fit max-w-[80%] rounded-2xl border border-line bg-surface-raised px-4 py-3 text-[15px]"
            >
              Can you explain that diagram again?
            </motion.div>

            <div className="mt-4 flex items-start gap-3">
              <AsterMark className="mt-2 h-4 w-4 shrink-0" />
              <motion.p
                initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-line bg-surface-raised px-4 py-3 text-[15px] leading-relaxed text-ink-soft"
              >
                Of course. Think of the root as the starting point — 10 sits at the top. Everything
                smaller, like 5, branches to the left. Everything larger, like 15, branches to the
                right.
              </motion.p>
            </div>

            <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft">
                <MicIcon />
              </span>
              <span className="text-[15px] text-ink-faint">Hold to speak</span>
              <span className="ml-auto flex items-center gap-2 text-ink-faint">
                <SpeakerIcon className="h-4 w-4" />
                <MiniBars />
              </span>
            </div>
          </div>
        </InView>
      </div>
    </section>
  );
}

const OPTIONS = ['It halves', 'It doubles', 'It stays the same'];

export function StudySection() {
  return (
    <section className="px-6 pb-28 sm:px-10 sm:pb-36">
      <div className="mx-auto grid max-w-[1180px] gap-4 lg:grid-cols-2">
        {/* The document */}
        <InView preset="slide-left">
          <div className="panel flex h-full flex-col rounded-panel p-6">
            <p className="label-micro flex items-center gap-2">
              <DocIcon className="h-3.5 w-3.5" />
              Physics — Chapter 4
            </p>

            <div className="mt-6 space-y-2.5" aria-hidden>
              {[100, 92, 96, 74, 88, 62].map((w, i) => (
                <motion.div
                  key={i}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${w}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  className="h-2 rounded-full bg-white/[0.07]"
                />
              ))}
            </div>

            <div className="mt-6 grid flex-1 place-items-center rounded-card border border-line py-10">
              <div className="flex items-center gap-6 text-ink-ghost" aria-hidden>
                <span className="h-5 w-12 rounded border border-current" />
                <span className="h-2 w-5 rounded-full border border-current" />
              </div>
            </div>

            <span className="mt-5 w-fit self-end rounded-full border border-line px-4 py-2 text-sm text-ink-soft">
              “Explain this page.”
            </span>
          </div>
        </InView>

        {/* Aster's reading of it */}
        <InView preset="slide-right">
          <div className="panel flex h-full flex-col rounded-panel p-6">
            <div className="flex items-start gap-3">
              <AsterMark className="mt-1 h-4 w-4 shrink-0" />
              <p className="text-[15px] leading-relaxed">
                This page introduces Newton’s second law. The diagram shows a mass being pushed by
                a force, producing acceleration proportional to the force and inversely
                proportional to the mass.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-auto rounded-card border border-line bg-surface-raised p-5"
            >
              <p className="label-micro flex items-center gap-2">
                <SparkIcon className="h-3.5 w-3.5" />
                Ready for a quick quiz?
              </p>
              <p className="mt-3 text-[15px]">What happens to acceleration if the force doubles?</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {OPTIONS.map((option) => (
                  <motion.span
                    key={option}
                    whileHover={{ y: -2 }}
                    className={cn(
                      'cursor-default rounded-full border px-4 py-2 text-sm transition-colors',
                      option === 'It doubles'
                        ? 'border-line-strong bg-white/[0.08] text-ink'
                        : 'border-line text-ink-soft'
                    )}
                  >
                    {option}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          </div>
        </InView>
      </div>
    </section>
  );
}

export function Privacy() {
  return (
    <section id="privacy" className="px-6 pb-36 sm:px-10">
      <InView preset="blur" className="mx-auto max-w-2xl text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line text-ink-soft">
          <ShieldIcon />
        </span>
        <h2 className="headline mt-8 text-4xl sm:text-5xl">Private by design.</h2>
        <p className="mt-6 text-balance text-[17px] leading-relaxed text-ink-soft">
          Where possible, Aster runs AI models locally on the learner’s device, reducing dependence
          on cloud APIs and per-request costs while keeping learning content private.
        </p>

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          className="mx-auto mt-14 w-fit"
        >
          <AsterMark className="h-8 w-8" />
        </motion.div>
      </InView>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-medium">
          <AsterMark className="h-4 w-4" />
          Aster
        </Link>
        <p className="text-sm text-ink-faint">
          Built for learners who were told the video was “self-explanatory”.
        </p>
      </div>
    </footer>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniBars() {
  const reduced = useReducedMotion();
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden>
      {[40, 75, 55, 95, 65].map((h, i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full bg-current"
          style={{ height: `${h}%` }}
          animate={reduced ? {} : { scaleY: [1, 0.4, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </span>
  );
}
