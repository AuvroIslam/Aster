'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { UploadZone } from './upload';
import { Reader } from './reader';
import { PageReader } from './pages';
import { useDoc } from './use-doc';
import { AsterMark, SpeakerIcon } from '@/components/icons';
import { studyDoc as sampleDoc } from '@/lib/fixtures';

export function StudySurface() {
  const loader = useDoc();
  const [useSample, setUseSample] = useState(false);

  const doc = loader.doc ?? (useSample ? sampleDoc : null);

  return (
    <div className="min-h-dvh">
      <header className="panel sticky top-0 z-30 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <AsterMark className="h-5 w-5" />
            <span className="tracking-tight">Aster</span>
          </Link>
          <span className="ml-2 hidden text-sm text-ink-faint sm:block">Notes and PDFs</span>

          <div className="ml-auto flex items-center gap-2">
            {doc && (
              <button
                onClick={() => {
                  loader.clear();
                  setUseSample(false);
                }}
                className="rounded-full border border-line px-3 py-1.5 text-xs transition-colors hover:border-line-strong"
              >
                New document
              </button>
            )}
            <Link
              href="/learn"
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs transition-colors hover:border-line-strong"
            >
              <SpeakerIcon className="h-3.5 w-3.5" />
              Back to the lesson
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <AnimatePresence mode="wait">
          {doc ? (
            <motion.div
              key="reader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/*
                A real document is read page by page with Aster explaining as
                it goes. The fixture chapter has no server behind it, so it
                keeps the older reader with its own canned Q&A and quiz.
              */}
              {loader.doc ? <PageReader doc={doc} /> : <Reader doc={doc} />}
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
              <UploadZone
                phase={loader.phase}
                error={loader.error}
                onUpload={loader.upload}
                onSample={() => setUseSample(true)}
                onOpen={loader.open}
                onRetry={loader.clear}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
