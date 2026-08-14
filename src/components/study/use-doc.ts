'use client';

import { useCallback, useState } from 'react';
import { api, ApiError, type WireDoc } from '@/lib/api';
import type { DocBlock, StudyDoc } from '@/lib/types';

export type DocPhase = 'idle' | 'uploading' | 'extracting' | 'ready' | 'error';

function toStudyDoc(wire: WireDoc): StudyDoc {
  return {
    id: wire.id,
    title: wire.title,
    pages: wire.pages,
    words: wire.words,
    blocks: wire.blocks.map(
      (block): DocBlock => ({
        id: block.id,
        page: block.page,
        kind: block.kind,
        content:
          block.content ||
          // An extracted image with no description yet still needs something
          // readable, and it must not claim to know what the figure shows.
          'A figure on this page. I have not described it yet.',
        concept: block.concept,
        described: block.described,
      })
    ),
  };
}

/** Uploads a PDF and turns the server's block structure into the reader's shape. */
export function useDoc() {
  const [phase, setPhase] = useState<DocPhase>('idle');
  const [doc, setDoc] = useState<StudyDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    setError(null);
    setDoc(null);
    setPhase('uploading');

    try {
      if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
        throw new ApiError('That is not a PDF. Aster reads PDF documents.', 400);
      }

      setPhase('extracting');
      const wire = await api.uploadDoc(file);
      setDoc(toStudyDoc(wire));
      setPhase('ready');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the Aster server. Is it running on port 5174?'
      );
      setPhase('error');
    }
  }, []);

  /** Opens a document the server already holds — no upload, no wait. */
  const open = useCallback(async (id: string) => {
    setError(null);
    setDoc(null);
    setPhase('extracting');
    try {
      setDoc(toStudyDoc(await api.doc(id)));
      setPhase('ready');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the Aster server. Is it running on port 5174?'
      );
      setPhase('error');
    }
  }, []);

  const clear = useCallback(() => {
    setPhase('idle');
    setDoc(null);
    setError(null);
  }, []);

  return { phase, doc, error, upload, open, clear };
}
