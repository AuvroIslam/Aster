'use client';

import { motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { InView } from '@/components/motion/in-view';
import { AsterMark, PlayIcon, SpeakerIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const PHASES = ['Narration', 'Visual gap detected', 'Aster explains', 'Video continues'];

const LINE = 'The diagram shows a binary search tree with 10 at the root, 5 on the left, and 15 on the right.';

/**
 * The centrepiece: the decide-then-describe moment, played out. The phase strip
 * advances on its own once the section is in view, so the mechanism is visible
 * without anyone having to press anything.
 */
export function Demo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: '-25%' });
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 2600);
    return () => clearInterval(id);
  }, [inView, reduced]);

  const explaining = phase === 2;

  return (
    <section id="demo" className="px-6 pb-28 sm:px-10 sm:pb-36">
      <div className="mx-auto max-w-[1180px]">
        <InView preset="blur" className="text-center">
          <p className="label-micro">The Aster difference</p>
          <h2 className="headline mt-5 text-balance text-4xl sm:text-5xl md:text-[3.5rem]">
            A lesson that explains itself.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-[17px] leading-relaxed text-ink-soft">
            When a video reaches visual information that matters, Aster pauses and describes what
            sight alone would reveal — then the lesson continues.
          </p>
        </InView>

        <div ref={ref} className="mt-16">
          <InView preset="scale">
            <div className="panel overflow-hidden rounded-panel">
              {/* Player */}
              <div className="relative">
                <div className="flex items-center justify-between px-5 pt-5">
                  <span className="label-micro flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-live" />
                    Coding lecture
                  </span>
                  <motion.span
                    animate={explaining && !reduced ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.5 }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs"
                  >
                    <AsterMark className="h-3 w-3" />
                    Aster
                  </motion.span>
                </div>

                <div className="grid h-[22rem] place-items-center px-5">
                  <TreeDiagram active={explaining} />
                </div>

                <div className="flex items-center gap-4 border-t border-line px-5 py-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong">
                    <PlayIcon className="h-3.5 w-3.5" />
                  </span>
                  <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-line-strong">
                    <motion.div
                      className="h-full bg-ink"
                      animate={{ width: explaining ? '34%' : ['22%', '34%'] }}
                      transition={{ duration: 2.4, ease: 'linear' }}
                    />
                  </div>
                  <span className="font-mono text-xs text-ink-faint">04:12</span>
                  <SpeakerIcon className="h-4 w-4 text-ink-faint" />
                </div>
              </div>
            </div>
          </InView>

          {/* Phase strip */}
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {PHASES.map((label, i) => (
              <motion.div
                key={label}
                animate={{
                  borderColor: phase === i ? 'var(--line-strong)' : 'var(--line)',
                  backgroundColor: phase === i ? 'var(--surface-raised)' : 'transparent',
                }}
                transition={{ duration: 0.5 }}
                className="rounded-card border p-4"
              >
                <p className={cn('label-micro', phase === i && 'text-ink')}>{label}</p>
                {i === 2 && phase === 2 && (
                  <motion.p
                    initial={{ opacity: 0, y: 6, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.5 }}
                    className="mt-2 text-[13px] leading-relaxed text-ink-soft"
                  >
                    “{LINE}”
                  </motion.p>
                )}
              </motion.div>
            ))}
          </div>

          {/* What Aster actually said */}
          <motion.div
            animate={{ opacity: explaining ? 1 : 0.4 }}
            transition={{ duration: 0.6 }}
            className="panel mt-4 flex items-start gap-3 rounded-card px-5 py-4"
          >
            <AsterMark className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-[15px] leading-relaxed text-ink-soft">“{LINE}”</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/** The tree from the lesson. Nodes draw themselves in when Aster describes it. */
function TreeDiagram({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const nodes = [
    { label: '10', x: 50, y: 18 },
    { label: '5', x: 28, y: 62 },
    { label: '15', x: 72, y: 62 },
  ];

  return (
    <div className="relative h-full w-full max-w-lg" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {['M50 27 L29 55', 'M50 27 L71 55'].map((d, i) => (
          <motion.path
            key={d}
            d={d}
            stroke="currentColor"
            strokeWidth="0.4"
            fill="none"
            className="text-ink-ghost"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            // Emphasis comes from opacity, never from shortening the edge — a
            // half-drawn line reads as a rendering fault, not as a dim state.
            animate={{ opacity: active ? 1 : 0.45 }}
            transition={{ duration: 0.9, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </svg>

      {nodes.map((node, i) => (
        <motion.span
          key={node.label}
          className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-lg"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          animate={{
            borderColor: active ? 'var(--ink-soft)' : 'var(--line-strong)',
            color: active ? 'var(--ink)' : 'var(--ink-faint)',
            scale: reduced ? 1 : active ? [1, 1.06, 1] : 1,
          }}
          transition={{ duration: 0.7, delay: i * 0.12 }}
        >
          {node.label}
        </motion.span>
      ))}
    </div>
  );
}
