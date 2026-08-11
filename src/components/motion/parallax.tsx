'use client';

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { useRef, type ReactNode } from 'react';

/**
 * Scroll-linked vertical parallax. `speed` is the fraction of the scroll
 * distance the element travels: negative rises faster than the page,
 * positive lags behind it.
 */
export function Parallax({
  children,
  className,
  speed = -0.2,
  clamp = 120,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
  clamp?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const raw = useTransform(scrollYProgress, [0, 1], [-clamp * speed, clamp * speed]);
  const y = useSpring(raw, { stiffness: 120, damping: 30, mass: 0.4 });

  if (reduced) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}

/**
 * The aurora field behind the hero: soft blurred colour blobs that drift on
 * their own and shift with scroll. Purely decorative.
 */
export function AuroraField({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();

  const y1 = useTransform(scrollYProgress, [0, 1], [0, 240]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -180]);

  return (
    <div ref={ref} className={className} aria-hidden>
      <motion.div
        style={reduced ? undefined : { y: y1 }}
        className="animate-drift absolute -left-24 -top-24 h-[32rem] w-[32rem] rounded-full bg-rust/20 blur-[110px]"
      />
      <motion.div
        style={reduced ? undefined : { y: y2 }}
        className="animate-drift absolute -right-32 top-16 h-[36rem] w-[36rem] rounded-full bg-moss/25 blur-[120px]"
        // Offset so the two blobs never breathe in sync.
      />
      <div className="animate-pulse-soft absolute left-1/3 top-1/2 h-[24rem] w-[24rem] rounded-full bg-amber/15 blur-[100px]" />
    </div>
  );
}
