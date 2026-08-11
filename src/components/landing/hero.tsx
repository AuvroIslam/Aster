'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { AuroraField, Parallax } from '@/components/motion/parallax';
import { Magnetic, TiltCard } from '@/components/motion/tilt-card';
import { TextEffect, RotatingWord } from '@/components/motion/text-effect';
import { Waveform } from '@/components/motion/waveform';
import { ArrowIcon, SpeakerIcon, CodeIcon, GraphIcon, TerminalIcon } from '@/components/icons';

const ROTATING = ['lecture', 'diagram', 'traceback', 'formula', 'textbook'];

export function Hero() {
  const [wordIndex, setWordIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setWordIndex((i) => i + 1), 2400);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-36 sm:pt-44">
      <AuroraField className="pointer-events-none absolute inset-0 -z-10" />

      {/* Faint paper grid, drifting slower than the content above it. */}
      <Parallax speed={0.35} clamp={80} className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="h-full w-full opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </Parallax>

      <div className="mx-auto max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="glass mx-auto mb-7 inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-sm text-ink-soft"
        >
          <span className="text-rust">
            <Waveform bars={4} className="h-3" />
          </span>
          Audio-first learning for blind and low-vision students
        </motion.div>

        <h1 className="font-display text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          <TextEffect as="span" className="block" delay={0.2}>
            Every lesson has a
          </TextEffect>
          <span className="mt-2 block">
            <RotatingWord words={ROTATING} index={wordIndex} />
          </span>
          <TextEffect as="span" className="mt-2 block text-ink-soft" delay={0.45}>
            nobody reads aloud.
          </TextEffect>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-8 max-w-2xl text-balance text-lg leading-relaxed text-ink-soft"
        >
          Aster watches the screen the instructor forgets to describe, speaks only into the
          pauses — then tutors you on exactly the parts you had to take on trust.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-11 flex flex-wrap items-center justify-center gap-3"
        >
          <Magnetic>
            <Link
              href="/learn"
              className="glow group inline-flex items-center gap-2 rounded-full bg-rust px-7 py-4 font-medium text-white transition-shadow"
            >
              Start a lesson
              <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Magnetic>
          <Magnetic strength={0.18}>
            <Link
              href="#how"
              className="glass inline-flex items-center gap-2 rounded-full px-6 py-4 font-medium text-ink transition-colors hover:text-rust"
            >
              <SpeakerIcon className="h-4 w-4" />
              Hear how it works
            </Link>
          </Magnetic>
        </motion.div>
      </div>

      <HeroPreview />
    </section>
  );
}

const SAMPLE = [
  { time: '03:12', icon: CodeIcon, mode: 'full explanation', confidence: 96, text: "The code editor shows a Python list named 'fruits' with three items: apple, banana, mango." },
  { time: '05:47', icon: TerminalIcon, mode: 'brief', confidence: 94, text: "The terminal prints ['apple', 'banana', 'mango', 'orange']." },
  { time: '08:21', icon: GraphIcon, mode: 'full explanation', confidence: 72, text: 'A diagram explains how list indices start from 0 and point to each item.' },
];

function HeroPreview() {
  return (
    <Parallax speed={-0.18} clamp={140} className="mx-auto mt-20 max-w-4xl">
      <TiltCard intensity={5} className="rounded-panel">
        <div className="glass lift overflow-hidden rounded-panel p-2">
          <div className="rounded-card bg-surface/80 p-5 sm:p-7">
            <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
              <p className="truncate text-sm font-medium">Intro to Python Lists — Full Course</p>
              <span className="shrink-0 rounded-full bg-moss-soft px-2.5 py-1 text-xs text-moss">
                12 descriptions
              </span>
            </div>

            <motion.ul
              className="mt-4 space-y-2"
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.14, delayChildren: 1.4 } } }}
            >
              {SAMPLE.map((row) => (
                <motion.li
                  key={row.time}
                  variants={{
                    hidden: { opacity: 0, x: -16, filter: 'blur(8px)' },
                    visible: { opacity: 1, x: 0, filter: 'blur(0px)' },
                  }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="group flex gap-3 rounded-card border border-transparent p-3 text-left transition-colors hover:border-line hover:bg-surface-raised/60"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rust-soft text-rust transition-transform duration-300 group-hover:scale-110">
                    <row.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      <span className="font-mono text-rust">{row.time}</span>
                      <span className="rounded-full bg-ground-deep px-2 py-0.5">{row.mode}</span>
                      <span>confidence {row.confidence}%</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{row.text}</p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>

            <div className="mt-4 flex items-center gap-3 rounded-card bg-rust-soft/70 px-4 py-3 text-sm text-rust">
              <Waveform />
              Aster is speaking — press <kbd className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-ink">S</kbd> to skip
            </div>
          </div>
        </div>
      </TiltCard>
    </Parallax>
  );
}
