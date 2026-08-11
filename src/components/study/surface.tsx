'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { UploadZone } from './upload';
import { Reader } from './reader';
import { AsterMark, SpeakerIcon } from '@/components/icons';

export function StudySurface() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="min-h-dvh">
      <header className="panel sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <AsterMark className="h-6 w-6 text-ink" />
            <span className="tracking-tight">Aster</span>
          </Link>
          <span className="ml-2 hidden text-sm text-ink-faint sm:block">Notes and PDFs</span>
          <Link
            href="/learn"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-line-strong hover:text-ink"
          >
            <SpeakerIcon className="h-3.5 w-3.5" />
            Back to the lesson
          </Link>
        </div>
      </header>

      <main id="main">
        <AnimatePresence mode="wait">
          {loaded ? (
            <motion.div
              key="reader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Reader />
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="px-4 py-20"
            >
              <UploadZone onDone={() => setLoaded(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
