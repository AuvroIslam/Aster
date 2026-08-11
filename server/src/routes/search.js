/** Search endpoints. */
import { Router } from 'express';
import express from 'express';
import { asyncRoute, badRequest } from '../errors.js';
import { searchYouTube } from '../services/search.js';
import { transcribe, voiceConfigured } from '../services/transcribe.js';

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

searchRouter.get('/api/voice-search/status', (req, res) => {
  res.json({ enabled: voiceConfigured() });
});

searchRouter.post(
  '/api/voice-search',
  // The browser posts the recorded clip as a raw audio body.
  express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '25mb' }),
  asyncRoute(async (req, res) => {
    if (!req.body || !req.body.length) throw badRequest('No audio was received.');
    const mimeType = req.headers['content-type'] || 'audio/webm';
    const language = req.query.language ? String(req.query.language) : undefined;

    const transcript = await transcribe(req.body, { mimeType, language });
    if (!transcript) {
      res.json({ transcript: '', results: [], message: 'I could not hear a search. Please try again.' });
      return;
    }

    const results = await searchYouTube(transcript, req.query.limit);
    res.json({ transcript, results });
  }),
);
