/**
 * Thin typed wrapper over the Aster API.
 *
 * Every path here exists on the Express server in `server/`. The browser talks
 * to it directly, so `NEXT_PUBLIC_API_BASE` must point at wherever that server
 * is listening (blank means same-origin).
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

export const apiUrl = (path: string) => `${API_BASE}${path}`;

export class ApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  { method = 'GET', body, signal }: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const err = (payload as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(
      err?.message ?? `Request failed with status ${response.status}`,
      response.status,
      err?.code
    );
  }

  return payload as T;
}

/* --- Wire types ----------------------------------------------------------- */

export interface ServerConfig {
  provider: string;
  model: string;
  outputLang?: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  channel?: string;
  uploader?: string;
  duration: number;
  thumbnail?: string;
  isLive?: boolean;
}

/** One described moment, as the timeline pipeline returns it. */
export interface WireDescription {
  id?: string;
  time: number;
  mode: 'brief' | 'explain';
  text: string;
  confidence: number;
  kind?: string;
  /** Present when the model named the concept the visual carries. */
  concept?: string;
  pausesVideo?: boolean;
}

export interface WireTimeline {
  videoId: string;
  language?: string;
  descriptions: WireDescription[];
  candidateCount?: number;
  consideredMoments?: number;
  model?: string;
}

export interface JobStatus {
  jobId: string;
  state: 'queued' | 'running' | 'done' | 'error';
  progress?: number;
  step?: string;
  message?: string;
  result?: WireTimeline;
  error?: { code?: string; message: string };
}

export interface FrameAnswer {
  answer: string;
  grounded: boolean;
  time: number;
  concept?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  url: string;
}

export interface PresetQuestion {
  id: string;
  label: string;
  question: string;
}

/* --- Calls ---------------------------------------------------------------- */

export const api = {
  health: () => request<{ ok: boolean }>('/health'),
  config: () => request<ServerConfig>('/api/config'),
  diagnostics: () => request<Record<string, unknown>>('/api/config/diagnostics'),

  videoInfo: (url: string) => request<VideoInfo>(`/api/video/info?url=${encodeURIComponent(url)}`),
  captions: (url: string) => request<unknown>(`/api/captions?url=${encodeURIComponent(url)}`),

  presets: () => request<{ presets: PresetQuestion[] }>('/api/describe/presets'),

  /** Kick off processing; poll `jobStatus` until state is done or error. */
  startProcessing: (url: string, options: Record<string, unknown> = {}) =>
    request<{ jobId: string }>('/api/process', { method: 'POST', body: { url, ...options } }),

  jobStatus: (jobId: string) => request<JobStatus>(`/api/process/${jobId}`),

  /** Interactive Q&A grounded in one extracted frame. */
  askFrame: (args: {
    videoId: string;
    time: number;
    question?: string;
    presetId?: string;
    signal?: AbortSignal;
  }) =>
    request<FrameAnswer>('/api/describe/frame', {
      method: 'POST',
      body: {
        videoId: args.videoId,
        time: args.time,
        question: args.question,
        presetId: args.presetId,
      },
      signal: args.signal,
    }),

  readyVideos: () => request<{ videos: VideoInfo[] }>('/api/videos/ready'),

  search: (query: string) =>
    request<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`),

  voiceSearchStatus: () => request<{ enabled: boolean }>('/api/voice-search/status'),

  /** Send a recorded clip; the server transcribes it with Whisper and searches. */
  voiceSearch: async (blob: Blob, opts: { language?: string } = {}) => {
    const qs = opts.language ? `?language=${encodeURIComponent(opts.language)}` : '';
    const response = await fetch(apiUrl(`/api/voice-search${qs}`), {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body: blob,
    });

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const err = (payload as { error?: { message?: string; code?: string } } | null)?.error;
      throw new ApiError(
        err?.message ?? `Request failed with status ${response.status}`,
        response.status,
        err?.code
      );
    }

    return payload as { query: string; results: SearchResult[] };
  },
};

export default api;
