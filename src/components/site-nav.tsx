'use client';

import Link from 'next/link';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useState } from 'react';
import { AsterMark } from '@/components/icons';
import { cn } from '@/lib/utils';

const links = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#demo', label: 'Demo' },
  { href: '#privacy', label: 'Privacy' },
];

export function SiteNav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (value) => setScrolled(value > 24));

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-colors duration-500',
        scrolled && 'border-b border-line bg-ground/80 backdrop-blur-xl'
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-[1400px] items-center px-6 py-4 sm:px-10"
      >
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-medium">
          <motion.span
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block"
          >
            <AsterMark className="h-[18px] w-[18px]" />
          </motion.span>
          Aster
        </Link>

        <ul className="mx-auto hidden items-center gap-9 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="group relative text-sm text-ink-soft transition-colors hover:text-ink"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-ink transition-all duration-300 group-hover:w-full" />
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/learn"
          className="ml-auto rounded-full border border-line-strong px-5 py-2 text-sm transition-colors duration-300 hover:bg-ink hover:text-ground md:ml-0"
        >
          Try Aster
        </Link>
      </nav>
    </motion.header>
  );
}
