/** Notes and PDFs: upload, extract, ask, quiz. */
import express from 'express';
import { asyncRoute, badRequest, notFound } from '../errors.js';
import { logger } from '../logger.js';
import { extractDocument } from '../services/pdf.js';

export const docRouter = express.Router();

/**
 * Documents live in memory for the life of the process. They are a working
 * session, not a library — nothing is written to disk, which is also the
 * privacy answer: an uploaded chapter never outlives the server.
 */
const documents = new Map();
const MAX_DOCUMENTS = 20;

function remember(doc) {
  if (documents.size >= MAX_DOCUMENTS) {
    // Evict the oldest; Map preserves insertion order.
    const oldest = documents.keys().next().value;
    documents.delete(oldest);
  }
  documents.set(doc.id, doc);
}

export function getDocument(id) {
  const doc = documents.get(id);
  if (!doc) throw notFound('That document is no longer loaded. Upload it again.');
  return doc;
}

/**
 * Accepts a raw PDF body (`Content-Type: application/pdf`). Raw rather than
 * multipart so the server needs no upload middleware.
 */
docRouter.post(
  '/api/doc/upload',
  express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '25mb' }),
  asyncRoute(async (req, res) => {
    if (!req.body?.length) {
      throw badRequest('Send the PDF as the request body with Content-Type: application/pdf.');
    }

    const title = String(req.query.title || 'Untitled document').slice(0, 200);
    const extracted = await extractDocument(req.body);

    const id = `doc-${Date.now().toString(36)}`;
    const doc = { id, title, ...extracted, createdAt: Date.now() };
    remember(doc);

    logger.info(
      `Extracted ${title}: ${doc.pages} pages, ${doc.blocks.length} blocks, ` +
        `${doc.blocks.filter((b) => b.described).length} to describe`
    );

    res.json({
      id: doc.id,
      title: doc.title,
      pages: doc.pages,
      words: doc.words,
      truncated: doc.truncated,
      blocks: doc.blocks,
    });
  })
);

docRouter.get(
  '/api/doc/:id',
  asyncRoute(async (req, res) => {
    const doc = getDocument(req.params.id);
    res.json({
      id: doc.id,
      title: doc.title,
      pages: doc.pages,
      words: doc.words,
      blocks: doc.blocks,
    });
  })
);

export default docRouter;
