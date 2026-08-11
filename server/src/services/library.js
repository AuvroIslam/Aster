// Lists fully processed videos so the client can offer them as examples.
// These need no yt-dlp call, so they open instantly.
import fs from 'node:fs/promises';
import path from 'node:path';
import { cachePath, exists, readJson } from '../lib/cache.js';
import { logger } from '../logger.js';

// Ready means every artefact is on disk. The video file matters too: Q&A
// extracts frames from it with ffmpeg.
async function isReady(videoId, dataFiles) {
  const hasTimeline = dataFiles.some(
    (name) => name.startsWith(`${videoId}.timeline.`) && name.endsWith('.json'),
  );
  if (!hasTimeline) return false;
  if (!(await exists(cachePath('data', `${videoId}.transcript.json`)))) return false;

  // Extension is not fixed — the download keeps its original container.
  const videoDir = cachePath('videos');
  let entries = [];
  try {
    entries = await fs.readdir(videoDir);
  } catch {
    return false;
  }
  return entries.some((name) => name.startsWith(`${videoId}.`));
}

// How many descriptions a video has, for display. Never throws.
async function describedCount(videoId, dataFiles) {
  const name = dataFiles.find(
    (file) => file.startsWith(`${videoId}.timeline.`) && file.endsWith('.json'),
  );
  if (!name) return null;
  try {
    const timeline = await readJson('data', name);
    return Array.isArray(timeline?.descriptions) ? timeline.descriptions.length : null;
  } catch {
    return null;
  }
}

/** Every fully-processed video, newest first. */
export async function listReadyVideos() {
  let dataFiles;
  try {
    dataFiles = await fs.readdir(cachePath('data'));
  } catch {
    return []; // nothing processed yet
  }

  const ids = dataFiles
    .filter((name) => name.endsWith('.info.json'))
    .map((name) => name.slice(0, -'.info.json'.length));

  const ready = [];
  for (const videoId of ids) {
    try {
      if (!(await isReady(videoId, dataFiles))) continue;
      const info = await readJson('data', `${videoId}.info.json`);
      if (!info?.title) continue;

      // A video with no descriptions demonstrates nothing.
      const descriptions = await describedCount(videoId, dataFiles);
      if (!descriptions) continue;

      const { mtimeMs } = await fs.stat(path.join(cachePath('data'), `${videoId}.info.json`));
      ready.push({
        videoId,
        title: info.title,
        channel: info.channel || null,
        duration: info.duration ?? null,
        language: info.language || null,
        thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        url: info.webpageUrl || `https://www.youtube.com/watch?v=${videoId}`,
        descriptions,
        cachedAt: mtimeMs,
      });
    } catch (err) {
      // One bad entry must not blank the whole library.
      logger.debug(`skipping ${videoId} in ready library: ${err.message}`);
    }
  }

  ready.sort((a, b) => b.cachedAt - a.cachedAt);
  return ready.map(({ cachedAt, ...video }) => video);
}

export default listReadyVideos;
