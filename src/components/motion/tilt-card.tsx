'use client';

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A card that tilts toward the pointer and carries a spotlight that follows it.
 * The tilt is disabled under reduced motion; the spotlight stays because it is
 * a position cue rather than movement.
 */
export function TiltCard({
  children,
  className,
  intensity = 8,
  spotlight = true,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
  spotlight?: boolean;
}) {
  const reduced = useReducedMotion();

  const px = useMotionValue(50);
  const py = useMotionValue(50);
  const rotateX = useSpring(useMotionValue(0), { stiffness: 260, damping: 24 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 260, damping: 24 });

  const glare = useMotionTemplate`radial-gradient(340px circle at ${px}% ${py}%, rgb(192 82 42 / 0.16), transparent 70%)`;

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    px.set(x * 100);
    py.set(y * 100);

    if (!reduced) {
      rotateY.set((x - 0.5) * intensity * 2);
      rotateX.set((0.5 - y) * intensity * 2);
    }
  }

  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
    px.set(50);
    py.set(50);
  }

  return (
    <motion.div
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      whileHover={reduced ? undefined : { y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className={cn('group relative [transform-style:preserve-3d]', className)}
    >
      {spotlight && (
        <motion.div
          aria-hidden
          style={{ background: glare }}
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
      )}
      {children}
    </motion.div>
  );
}

/**
 * Pulls gently toward the cursor. Reserved for the one or two primary actions
 * on a screen — it is a strong signal and loses meaning if everything moves.
 */
export function Magnetic({
  children,
  className,
  strength = 0.28,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduced = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
  }

  return (
    <motion.div
      className={cn('inline-block', className)}
      onPointerMove={handleMove}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ x, y }}
    >
      {children}
    </motion.div>
  );
}
