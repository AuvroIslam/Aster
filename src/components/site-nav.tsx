'use client';

import Link from 'next/link';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useState } from 'react';
import { AsterMark } from '@/components/icons';
import { cn } from '@/lib/utils';

const links = [
  { href: '#how', label: 'How it works' },
  { href: '#method', label: 'Teaching method' },
  { href: '#features', label: 'Features' },
  { href: '/study', label: 'Notes and PDFs' },
];

export function SiteNav() {
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);

  useMotionValueEvent(scrollY, 'change', (value) => {
    setCondensed(value > 40);
  });

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4"
    >
      <nav
        aria-label="Main"
        className={cn(
          'flex w-full max-w-5xl items-center gap-2 rounded-full px-3 py-2 transition-all duration-500',
          condensed ? 'glass lift max-w-3xl' : 'border border-transparent'
        )}
      >
        <Link href="/" className="flex items-center gap-2 rounded-full px-2 py-1 font-semibold">
          <motion.span
            whileHover={{ rotate: 90 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="text-rust"
          >
            <AsterMark className="h-6 w-6" />
          </motion.span>
          <span className="text-lg tracking-tight">Aster</span>
        </Link>

        <ul className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="relative rounded-full px-3 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/learn"
            className="group relative overflow-hidden rounded-full bg-moss px-5 py-2.5 text-sm font-medium text-ground transition-transform duration-300 hover:scale-[1.03] active:scale-95"
          >
            <span className="relative z-10">Open Aster</span>
            <span className="absolute inset-0 -translate-x-full bg-rust transition-transform duration-500 ease-out-soft group-hover:translate-x-0" />
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
