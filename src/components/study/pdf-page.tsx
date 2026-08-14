'use client';

import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api';

/**
 * Client-side PDF rendering.
 *
 * The document is loaded once and shared by every page component. pdf.js is
 * imported lazily so its ~1MB never lands in the initial bundle for people who
 * only ever use the lesson surface.
 */
type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (opts: { scale: number }) => { width: number; height: number };
    render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
      promise: Promise<void>;
      cancel: () => void;
    };
  }>;
};

const cache = new Map<string, Promise<PdfDoc>>();

export function loadPdf(docId: string): Promise<PdfDoc> {
  const existing = cache.get(docId);
  if (existing) return existing;

  const promise = (async () => {
    const pdfjs = await import('pdfjs-dist');
    // Served from /public so the worker is a plain same-origin URL.
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const task = pdfjs.getDocument({ url: apiUrl(`/api/doc/${docId}/file`) });
    return (await task.promise) as unknown as PdfDoc;
  })();

  cache.set(docId, promise);
  return promise;
}

/**
 * One rendered page.
 *
 * Rendering is deferred until the page is near the viewport: a 102-page
 * document rendered eagerly would allocate a hundred full-size canvases and
 * stall the tab. `aria-hidden` because the page's text is already in the DOM
 * beside it — a canvas tells a screen reader nothing.
 */
export function PdfPage({
  docId,
  page,
  active,
  onRendered,
}: {
  docId: string;
  page: number;
  /** True once the page is close enough to the viewport to be worth drawing. */
  active: boolean;
  onRendered?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const drawnRef = useRef(false);

  useEffect(() => {
    if (!active || drawnRef.current) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;

    (async () => {
      setState('rendering');
      try {
        const pdf = await loadPdf(docId);
        if (cancelled) return;
        const pdfPage = await pdf.getPage(page);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;

        // Render at the element's own width, times the device pixel ratio, so
        // diagrams and small type stay legible rather than resampled to mush.
        const cssWidth = canvas.parentElement?.clientWidth ?? 800;
        const base = pdfPage.getViewport({ scale: 1 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const scale = (cssWidth / base.width) * ratio;
        const viewport = pdfPage.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        const context = canvas.getContext('2d');
        if (!context) return;

        const render = pdfPage.render({ canvasContext: context, viewport });
        task = render;
        await render.promise;
        if (cancelled) return;
        drawnRef.current = true;
        setState('done');
        onRendered?.();
      } catch (err) {
        if (cancelled) return;
        // A cancelled render is expected when scrolling fast; not an error.
        if ((err as { name?: string })?.name === 'RenderingCancelledException') return;
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [active, docId, page, onRendered]);

  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-white">
      <canvas ref={canvasRef} aria-hidden className="block w-full" />
      {/* A neutral minimum rather than a guessed aspect ratio: slides are
          landscape and textbooks portrait, and committing to the wrong one
          makes every page jump when it finally draws. */}
      {state !== 'done' && (
        <div className="flex min-h-[220px] w-full items-center justify-center bg-surface text-xs text-ink-faint">
          {state === 'error' ? 'This page could not be rendered.' : `page ${page}`}
        </div>
      )}
    </div>
  );
}

export default PdfPage;
