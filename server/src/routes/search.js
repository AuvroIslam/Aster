/**
 * Search endpoints.
 *
 * Text only: speech is recognised in the browser, so a spoken search arrives
 * here already as words. No transcription service, and no API key for it.
 */
import { Router } from 'express';
import { asyncRoute, badRequest } from '../errors.js';
import { searchYouTube } from '../services/search.js';

export const searchRouter = Router();

searchRouter.get(
  '/api/search',
  asyncRoute(async (req, res) => {
    const query = String(req.query.q || req.query.query || '').trim();
    if (!query) throw badRequest('Provide a search phrase with ?q=');
    if (query.length > 200) throw badRequest('That search phrase is too long.');
    const results = await searchYouTube(query, req.query.limit);
    res.json({ query, results });
  }),
);
