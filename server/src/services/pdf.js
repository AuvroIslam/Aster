/**
 * PDF extraction.
 *
 * Pulls two things out of an uploaded document:
 *
 *   1. **Text**, grouped into blocks per page, with heading and table structure
 *      inferred from font size and column alignment.
 *   2. **Embedded images**, decoded straight from the PDF's object stream.
 *
 * Only the images need the vision model. The text a screen reader can already
 * handle — the figures are what a blind reader is currently locked out of, and
 * they are the whole reason this route exists.
 *
 * Uses pdfjs-dist's legacy build, which runs on plain Node with no canvas and
 * no native dependency.
 */
import { badRequest } from '../errors.js';
import { logger } from '../logger.js';

let pdfjs = null;
async function getPdfjs() {
  if (pdfjs) return pdfjs;
  // The legacy ESM build runs on plain Node with no worker and no canvas.
  pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

/**
 * Joins the text items on one line.
 *
 * A PDF stores no spaces between table cells — it just moves the cursor. Joining
 * naively yields "CaseConditionFixCost", which is worse than useless read aloud.
 * So a visible horizontal gap becomes an explicit separator.
 */
function joinLine(items) {
  let out = '';
  let previousEnd = null;

  for (const item of items) {
    const x = item.transform[4];
    const width = item.width ?? 0;

    if (previousEnd !== null) {
      const gap = x - previousEnd;
      // Roughly a space is ~25% of font size; anything much wider is a column.
      const fontSize = Math.abs(item.transform[0]) || 12;
      if (gap > fontSize * 1.2) out += ' — ';
      else if (gap > fontSize * 0.18 && !out.endsWith(' ')) out += ' ';
    }

    out += item.str;
    previousEnd = x + width;
  }

  return out.replace(/\s+/g, ' ').replace(/\s+—\s+/g, ' — ').trim();
}

/**
 * Groups text items into lines by their vertical position, then lines into
 * blocks by the gap between them.
 */
function groupIntoBlocks(items, medianSize) {
  const lines = new Map();

  for (const item of items) {
    if (!item.str?.trim()) continue;
    // transform[5] is the y translation; round so a line's items land together.
    const y = Math.round(item.transform[5]);
    if (!lines.has(y)) lines.set(y, []);
    lines.get(y).push(item);
  }

  const ordered = [...lines.entries()]
    .sort((a, b) => b[0] - a[0]) // PDF y grows upward
    .map(([y, group]) => {
      const sorted = group.sort((a, b) => a.transform[4] - b.transform[4]);
      const size = Math.max(...sorted.map((i) => Math.abs(i.transform[0]) || 0));
      return { y, text: joinLine(sorted), size, columns: sorted.length };
    })
    .filter((line) => line.text);

  const blocks = [];
  let current = null;

  for (const line of ordered) {
    const isHeading = line.size > medianSize * 1.25 && line.text.length < 120;
    // Many items on one line with wide spacing reads as tabular.
    const isTabular = line.columns >= 4;

    // Classify per line, before merging. Classifying the merged block instead
    // lets one formula line drag its whole surrounding paragraph in with it.
    const kind = isHeading
      ? 'heading'
      : isTabular
        ? 'table'
        : looksLikeFormula(line.text)
          ? 'formula'
          : 'text';

    if (!current || current.kind !== kind || isHeading || kind === 'formula') {
      current = { kind, text: line.text, size: line.size };
      blocks.push(current);
    } else {
      current.text += ` ${line.text}`;
    }
  }

  return blocks;
}

/** Formula-ish text: heavy in operators and single letters, light in words. */
function looksLikeFormula(text) {
  if (text.length > 220) return false;
  const symbols = (text.match(/[=+\-−×÷^_∑∫√≤≥≠<>()[\]]/g) ?? []).length;
  const words = text.split(/\s+/).filter((w) => /^[a-z]{4,}$/i.test(w)).length;
  return symbols >= 3 && symbols > words;
}

/**
 * Finds every embedded raster image on a page and reports its position and
 * size. Returns nothing for pages that are pure text.
 *
 * Dimensions come straight out of the operator arguments, which are shaped
 * `[objectId, width, height]`. This deliberately never touches the object
 * stores: image *pixels* are only populated during rendering, and this runs in
 * Node with no canvas, so nothing ever renders. `objs.get()` is callback-based
 * with no error path for an unresolved object, so asking for one registers a
 * callback that is never invoked — which hung extraction forever on the first
 * document-global image (the `g_`-prefixed ones, shared between pages). The
 * dimensions here are all this function ever needed anyway.
 */
async function extractPageImages(page, pageNumber) {
  const images = [];

  try {
    const ops = await page.getOperatorList();
    const { OPS } = await getPdfjs();
    // One image is often painted many times over; describe it once.
    const seen = new Set();

    for (let i = 0; i < ops.fnArray.length; i += 1) {
      const fn = ops.fnArray[i];
      if (fn !== OPS.paintImageXObject && fn !== OPS.paintInlineImageXObject) continue;

      const [name, width, height] = ops.argsArray[i];
      if (typeof name !== 'string' || seen.has(name)) continue;
      if (!Number.isFinite(width) || !Number.isFinite(height)) continue;

      // Ignore decorative slivers — rules, bullets, logo marks.
      if (width < 80 || height < 80) continue;

      seen.add(name);
      images.push({
        page: pageNumber,
        width,
        height,
        kind: width > height * 1.6 ? 'chart' : 'figure',
      });
    }
  } catch (error) {
    logger.debug(`Image extraction failed on page ${pageNumber}: ${error.message}`);
  }

  return images;
}

/**
 * Parses a PDF buffer into the block structure the client renders.
 * Pure extraction — no model calls happen here.
 */
export async function extractDocument(buffer, { maxPages = 40 } = {}) {
  if (!buffer?.length) throw badRequest('No PDF was uploaded.');

  const lib = await getPdfjs();

  let doc;
  let loadingTask;
  try {
    loadingTask = lib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });
    doc = await loadingTask.promise;
  } catch (error) {
    throw badRequest(`That file could not be read as a PDF: ${error.message}`);
  }

  const totalPages = doc.numPages;
  const pageCount = Math.min(totalPages, maxPages);
  const blocks = [];
  let words = 0;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    const sizes = content.items
      .map((item) => Math.abs(item.transform?.[0] ?? 0))
      .filter(Boolean)
      .sort((a, b) => a - b);
    const medianSize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 12;

    for (const block of groupIntoBlocks(content.items, medianSize)) {
      const kind = block.kind;
      words += block.text.split(/\s+/).length;

      blocks.push({
        id: `b${blocks.length + 1}`,
        page: pageNumber,
        kind,
        content: block.text,
        // Tables and formulas carry meaning a screen reader flattens, so they
        // are marked for description alongside the figures.
        described: kind === 'table' || kind === 'formula',
      });
    }

    for (const image of await extractPageImages(page, pageNumber)) {
      blocks.push({
        id: `b${blocks.length + 1}`,
        page: pageNumber,
        kind: image.kind,
        content: '',
        described: true,
        pending: true,
        width: image.width,
        height: image.height,
      });
    }
  }

  // The loading task owns the worker/transport, not the document.
  await loadingTask.destroy();

  return {
    pages: pageCount,
    truncated: totalPages > pageCount,
    words,
    blocks,
  };
}

export default { extractDocument };
