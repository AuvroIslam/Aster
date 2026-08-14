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

/** Video metadata. The server names the id `videoId`, consistently with search. */
export interface VideoInfo {
  videoId: string;
  title: string;
  channel?: string;
  uploader?: string;
  duration: number;
  description?: string;
  thumbnail?: string;
  url?: string;
  embedUrl?: string;
  isLive?: boolean;
}

/**
 * The language descriptor the server attaches to a timeline and to an answer.
 * Note this is an object, not a bare code — `code` is the part that picks a
 * speech voice.
 */
export interface WireLanguage {
  code: string;
  name: string;
  native: string;
  isEnglish: boolean;
}

/**
 * One described moment, named exactly as `generateTimeline` emits it.
 *
 * The field names differ from the app's own `Description` type — the server
 * says `description`/`visualType`/`requiresPause` where the UI says
 * `text`/`kind`/`pausesVideo`. `toDescription` in use-lesson.ts is the single
 * place that translates; nothing else should read this shape directly.
 */
export interface WireDescription {
  time: number;
  /** The spoken text. */
  description: string;
  mode: 'brief' | 'explain';
  /** The server's name for the kind of visual, e.g. "diagram", "code". */
  visualType?: string;
  confidence: number;
  /** True when the moment is substantial enough to hold the video for. */
  requiresPause?: boolean;
  /** Confidence band the pipeline filed this under: "high" or "critical". */
  tier?: string;
  gapEnd?: number;
  gapDuration?: number;
  /** Present only when the model named the concept the visual carries. */
  concept?: string;
}

/** Pipeline counters. `candidates` is every moment considered, described or not. */
export interface WireTimelineStats {
  candidates: number;
  accepted: number;
  rejected: number;
  explanations?: number;
  duplicatesSuppressed?: number;
  transcriptCues?: number;
  automaticCaptions?: boolean;
  domain?: string;
}

export interface WireTimeline {
  videoId: string;
  title?: string;
  duration?: number;
  language?: WireLanguage;
  descriptions: WireDescription[];
  stats?: WireTimelineStats;
  model?: string;
  cached?: boolean;
}

/**
 * A processing job, as `serialiseJob` returns it. `percent` is 0–100, and the
 * state field is `status` — not `state`/`progress`.
 */
export interface JobStatus {
  jobId: string;
  videoId?: string;
  status: 'running' | 'done' | 'error';
  /** Short slug for the current phase, e.g. "describe". */
  stage?: string;
  /** 0–100. */
  percent?: number;
  /** Human-readable progress line, suitable for showing to the learner. */
  message?: string;
  result?: WireTimeline | null;
  error?: { code?: string; message: string } | null;
}

export interface FrameAnswer {
  videoId: string;
  answer: string;
  grounded: boolean;
  time: number;
  confidence: number;
  /** False when the model could not see the thing being asked about. */
  visible: boolean;
  language?: WireLanguage;
  model?: string;
  /** The server does not currently name a concept; callers fall back. */
  concept?: string;
}

export interface SearchResult {
  /** The YouTube id. Named `videoId` on the wire, not `id`. */
  videoId: string;
  title: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  url: string;
}

export interface WireDocBlock {
  id: string;
  page: number;
  kind: 'heading' | 'text' | 'figure' | 'table' | 'formula' | 'chart';
  content: string;
  described: boolean;
  /** True for an extracted image whose description has not been generated yet. */
  pending?: boolean;
  concept?: string;
}

export interface WireDoc {
  id: string;
  title: string;
  pages: number;
  words: number;
  truncated?: boolean;
  blocks: WireDocBlock[];
}

/** A document shipped with the app, openable without uploading anything. */
export interface LibraryDoc {
  id: string;
  title: string;
  pages: number;
  words: number;
  truncated?: boolean;
  blocks: number;
  visuals: number;
}

/**
 * A video this server has already processed. Offered as one-click examples:
 * the timeline is cached, so they open with no processing wait.
 */
export interface ReadyVideo {
  videoId: string;
  title: string;
  channel?: string | null;
  duration?: number | null;
  language?: string | null;
  thumbnail: string;
  url: string;
  /** How many described moments the cached timeline holds. */
  descriptions: number;
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

  /** Kick off processing; poll `jobStatus` until `status` is done or error. */
  startProcessing: (url: string, options: Record<string, unknown> = {}) =>
    request<JobStatus>('/api/process', { method: 'POST', body: { url, ...options } }),

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

  readyVideos: () => request<{ videos: ReadyVideo[]; count: number }>('/api/videos/ready'),

  search: (query: string) =>
    request<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`),

  voiceSearchStatus: () => request<{ enabled: boolean }>('/api/voice-search/status'),

  /** Upload a PDF as a raw body; the server extracts its block structure. */
  uploadDoc: async (file: File) => {
    const response = await fetch(
      apiUrl(`/api/doc/upload?title=${encodeURIComponent(file.name)}`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      }
    );

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
        err?.message ?? `Upload failed with status ${response.status}`,
        response.status,
        err?.code
      );
    }

    return payload as WireDoc;
  },

  doc: (id: string) => request<WireDoc>(`/api/doc/${id}`),

  /** Documents bundled with the app — no upload needed. */
  docLibrary: () => request<{ documents: LibraryDoc[]; count: number }>('/api/doc/library'),

  /** A spoken orientation to the whole document. Cached server-side. */
  docSummary: (id: string) =>
    request<{ id: string; summary: string; cached: boolean }>(`/api/doc/${id}/summary`, {
      method: 'POST',
    }),

  /** One page, explained rather than read out verbatim. Cached per page. */
  explainPage: (id: string, page: number, signal?: AbortSignal) =>
    request<{ id: string; page: number; explanation: string; cached: boolean; empty?: boolean }>(
      `/api/doc/${id}/page/${page}/explain`,
      { method: 'POST', signal }
    ),

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

    // The server calls the recognised text `transcript`, not `query`.
    return payload as { transcript: string; results: SearchResult[]; message?: string };
  },
};

export default api;
