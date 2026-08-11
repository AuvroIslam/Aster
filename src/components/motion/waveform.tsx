'use client';

import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * The speaking indicator. Aster is an audio-first product, so "a voice is
 * talking right now" needs a visual form for the low-vision and sighted
 * users watching alongside.
 */
export function Waveform({
  active = true,
  bars = 5,
  className,
}: {
  active?: boolean;
  bars?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <span className={cn('inline-flex h-4 items-center gap-[3px]', className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-current"
          initial={{ height: '35%' }}
          animate={
            active && !reduced
              ? { height: ['35%', '100%', '45%', '85%', '35%'] }
              : { height: active ? '70%' : '35%' }
          }
          transition={
            active && !reduced
              ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.11 }
              : { duration: 0.2 }
          }
        />
      ))}
    </span>
  );
}
