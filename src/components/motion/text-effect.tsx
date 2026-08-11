'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Blur-in text, revealed per word. The whole string stays in the accessibility
 * tree as one label, so a screen reader never hears it word-by-word.
 */
export function TextEffect({
  children,
  className,
  delay = 0,
  stagger = 0.045,
  as: Tag = 'p',
}: {
  children: string;
  className?: string;
  delay?: number;
  stagger?: number;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'span';
}) {
  const reduced = useReducedMotion();
  const words = children.split(' ');

  if (reduced) return <Tag className={className}>{children}</Tag>;

  return (
    <Tag className={className}>
      <span aria-label={children}>
        <motion.span
          aria-hidden
          className="inline"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
          }}
        >
          {words.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              className="inline-block whitespace-pre"
              variants={{
                hidden: { opacity: 0, y: '0.4em', filter: 'blur(10px)' },
                visible: { opacity: 1, y: '0em', filter: 'blur(0px)' },
              }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              {word}
              {i < words.length - 1 ? ' ' : ''}
            </motion.span>
          ))}
        </motion.span>
      </span>
    </Tag>
  );
}

/**
 * A word that cycles through a list — used in the hero to name the three
 * kinds of content Aster opens up.
 */
export function RotatingWord({
  words,
  index,
  className,
}: {
  words: string[];
  index: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const word = words[index % words.length];

  return (
    <span className={cn('relative inline-block align-bottom', className)}>
      {/* Reserves the width of the longest word so the headline never reflows. */}
      <span className="invisible" aria-hidden>
        {words.reduce((a, b) => (a.length >= b.length ? a : b))}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={reduced ? 'static' : word}
          className="absolute inset-0 text-ink"
          initial={reduced ? false : { opacity: 0, y: '0.5em', filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: '0em', filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: '-0.5em', filter: 'blur(8px)' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
