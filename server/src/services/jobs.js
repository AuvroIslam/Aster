/** In-process job registry for video processing. */
import { randomUUID } from 'node:crypto';
import { logger } from '../logger.js';

const jobs = new Map();
const byVideo = new Map();

const RETENTION_MS = 60 * 60 * 1000;

/** Removes finished jobs older than the retention window. */
function sweep() {
  const cutoff = Date.now() - RETENTION_MS;
  for (const [id, job] of jobs) {
    if (job.status !== 'running' && job.finishedAt && job.finishedAt < cutoff) {
      jobs.delete(id);
      if (byVideo.get(job.videoId) === id) byVideo.delete(job.videoId);
    }
  }
}

/** Public view of a job — safe to serialise to the client. */
export function serialiseJob(job) {
  if (!job) return null;
  return {
    jobId: job.id,
    videoId: job.videoId,
    status: job.status,
    stage: job.stage,
    percent: job.percent,
    message: job.message,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt ?? null,
    result: job.result ?? null,
    error: job.error ?? null,
  };
}

export const getJob = (jobId) => jobs.get(jobId) || null;

export function getJobForVideo(videoId) {
  const id = byVideo.get(videoId);
  return id ? jobs.get(id) || null : null;
}

/** Starts a job, or returns the existing one for this video. */
export function startJob({ videoId, run, refresh = false }) {
  sweep();

  const existing = getJobForVideo(videoId);
  if (existing && existing.status === 'running') return existing;
  if (existing && existing.status === 'done' && !refresh) return existing;

  const job = {
    id: randomUUID(),
    videoId,
    status: 'running',
    stage: 'queued',
    percent: 0,
    message: 'Starting',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    result: null,
    error: null,
  };

  jobs.set(job.id, job);
  byVideo.set(videoId, job.id);

  const report = ({ stage, percent, message }) => {
    job.stage = stage ?? job.stage;
    job.percent = Number.isFinite(percent) ? percent : job.percent;
    job.message = message ?? job.message;
  };

  run(report)
    .then((result) => {
      job.status = 'done';
      job.stage = 'done';
      job.percent = 100;
      job.message = 'Processing complete';
      job.result = result;
      job.finishedAt = Date.now();
    })
    .catch((err) => {
      logger.error(`Job ${job.id} for ${videoId} failed: ${err.message}`);
      job.status = 'error';
      job.stage = 'error';
      job.message = err.message;
      job.error = { code: err.code || 'internal_error', message: err.message };
      job.finishedAt = Date.now();
    });

  return job;
}

/** Test hook. */
export function __clearJobs() {
  jobs.clear();
  byVideo.clear();
}
