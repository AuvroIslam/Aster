'use client';

import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { TextEffect } from '@/components/motion/text-effect';
import { Magnetic } from '@/components/motion/tilt-card';
import { AsterMark, PlayIcon } from '@/components/icons';

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  // The hero copy drifts up and dissolves as the page moves past it.
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const stageY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <section ref={ref} className="relative overflow-hidden px-6 pb-28 pt-40 sm:px-10 sm:pt-52">
      {/* A single soft bloom behind the mark, the only light in the section. */}
      <div
        aria-hidden
        className="animate-pulse-soft pointer-events-none absolute left-1/2 top-40 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-white/[0.045] blur-[130px]"
      />

      <motion.div
        style={reduced ? undefined : { y: copyY, opacity: copyOpacity }}
        className="mx-auto max-w-4xl text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.7, rotate: -60 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-12 w-fit"
        >
          <AsterMark className="animate-spin-slow h-14 w-14" />
        </motion.div>

        <h1 className="headline text-balance text-[3.25rem] leading-[0.98] sm:text-7xl md:text-[5.5rem]">
          <TextEffect as="span" delay={0.25} stagger={0.06}>
            Learn without limits.
          </TextEffect>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-8 max-w-xl text-balance text-lg leading-relaxed text-ink-soft"
        >
          Aster turns visual learning into an accessible, audio-first experience for blind and
          low-vision students.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Magnetic>
            <Link
              href="/learn"
              className="inline-block rounded-full bg-ink px-7 py-3 text-[15px] font-medium text-ground transition-transform duration-300 hover:scale-[1.03]"
            >
              Try Aster
            </Link>
          </Magnetic>
          <Magnetic strength={0.16}>
            <Link
              href="#how"
              className="inline-block rounded-full border border-line-strong px-7 py-3 text-[15px] transition-colors duration-300 hover:bg-white/[0.06]"
            >
              See how it works
            </Link>
          </Magnetic>
        </motion.div>
      </motion.div>

      <motion.div style={reduced ? undefined : { y: stageY }}>
        <HeroStage />
      </motion.div>

      <motion.div
        aria-hidden
        animate={reduced ? {} : { y: [0, 8, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="mx-auto mt-16 w-fit text-ink-ghost"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M12 4v15M6 13.5l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
    </section>
  );
}

/**
 * The hero diagram: a visual lesson on the left, the same lesson as audio on
 * the right, Aster as the transform between them. It is the whole product in
 * one picture.
 */
function HeroStage() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, filter: 'blur(14px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1.1, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto mt-24 max-w-5xl"
    >
      <div className="hairline grain rounded-panel p-3 sm:p-5">
        <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          {/* Visual lesson */}
          <div className="panel-raised relative flex min-h-[15rem] flex-col justify-between rounded-card p-5">
            <div className="flex flex-1 items-center justify-center">
              <motion.span
                whileHover={{ scale: 1.08 }}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-line-strong text-ink-soft"
              >
                <PlayIcon className="h-4 w-4" />
              </motion.span>
            </div>
            <span className="label-micro">Visual lesson</span>
          </div>

          {/* Aster */}
          <div className="flex flex-col items-center justify-center gap-2 px-2 py-4">
            <motion.span
              animate={reduced ? {} : { rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            >
              <AsterMark className="h-7 w-7" />
            </motion.span>
            <span className="label-micro">Aster</span>
          </div>

          {/* Accessible audio */}
          <div className="panel-raised relative flex min-h-[15rem] flex-col justify-between rounded-card p-5">
            <div className="flex flex-1 items-center justify-center">
              <Bars />
            </div>
            <span className="label-micro">Accessible audio</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** A dense waveform, each bar breathing on its own offset. */
function Bars() {
  const reduced = useReducedMotion();
  // Rounded: an unrounded float serialises to different precision on the server
  // than on the client, which React reports as a hydration mismatch.
  const heights = Array.from({ length: 44 }, (_, i) =>
    Math.round(30 + Math.abs(Math.sin(i * 0.9)) * 55 + (i % 3) * 6)
  );

  return (
    <div className="flex h-16 items-center gap-[3px]" aria-hidden>
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full bg-ink-soft/70"
          style={{ height: `${h}%` }}
          animate={reduced ? {} : { scaleY: [1, 0.45, 1] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: (i % 11) * 0.13,
          }}
        />
      ))}
    </div>
  );
}
