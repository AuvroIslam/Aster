/** The generative model client. */
import { bareModelId, config } from '../config.js';
import { upstreamError, AppError } from '../errors.js';
import { logger } from '../logger.js';
import { parseModelJson } from '../lib/json.js';
import { sleep } from '../lib/pool.js';

/** Cached result of model resolution, so we list models at most once. */
let resolution = null;

/** Splits a candidate's parts into the model's private reasoning and its actual answer. */
export function extractAnswerText(candidate) {
  const parts = candidate?.content?.parts || [];
  const collect = (wantThought) =>
    parts
      .filter((part) => Boolean(part.thought) === wantThought)
      .map((part) => part.text || '')
      .join('')
      .trim();

  return { text: collect(false), thoughts: collect(true) };
}

/** Parses "gemma-3-27b-it" into sortable parts. */
function scoreModel(id) {
  const bare = bareModelId(id);
  const version = Number.parseFloat((bare.match(/gemma-(\d+(?:\.\d+)?)/i) || [])[1] || '0');
  const params = Number.parseFloat((bare.match(/-(\d+(?:\.\d+)?)b/i) || [])[1] || '0');
  const instructionTuned = /-it\b/i.test(bare) ? 1 : 0;
  return { version, params, instructionTuned };
}

/** Every Gemma 4 size is multimodal, as is every Gemma 3 size except the 1B checkpoint, which is text-only. */
function isVisionCapable(id) {
  const { params } = scoreModel(id);
  return params === 0 || params >= 2;
}

function betterThan(a, b) {
  const sa = scoreModel(a);
  const sb = scoreModel(b);
  if (sa.version !== sb.version) return sa.version > sb.version;
  if (sa.instructionTuned !== sb.instructionTuned) return sa.instructionTuned > sb.instructionTuned;
  return sa.params > sb.params;
}

/** Lists every model this API key can reach. */
export async function listModels() {
  if (!config.gemma.apiKey) {
    throw new AppError(
      'GEMMA_API_KEY is not set. Add it to .env — see .env.example.',
      500,
      'missing_api_key',
    );
  }
  const url = `${config.gemma.baseUrl}/models?pageSize=1000&key=${encodeURIComponent(config.gemma.apiKey)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(config.gemma.timeoutMs) });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw upstreamError(`Could not list models (HTTP ${response.status})`, body.slice(0, 400));
  }
  const payload = await response.json();
  return (payload.models || []).map((m) => ({
    id: bareModelId(m.name),
    methods: m.supportedGenerationMethods || [],
    inputTokenLimit: m.inputTokenLimit,
  }));
}

/** Picks the model to use: the pinned id, else the preference list, else the newest. */
export async function resolveModel({ force = false } = {}) {
  if (resolution && !force) return resolution;

  const configured = config.gemma.model;
  const available = await listModels();
  const generative = available.filter((m) => m.methods.includes('generateContent')).map((m) => m.id);

  // The pipeline sends frames on every call, so a text-only model is unusable
  // Frames go on every call, so a text-only model is unusable.
  const usable = generative.filter(isVisionCapable);

  let selected = null;
  let source = 'pinned';
  let requested = configured;

  if (configured && configured !== 'auto') {
    if (usable.includes(bareModelId(configured))) selected = bareModelId(configured);
  }

  if (!selected) {
    source = configured === 'auto' ? 'auto' : 'fallback';
    for (const preference of config.gemma.preferences) {
      if (usable.includes(bareModelId(preference))) {
        selected = bareModelId(preference);
        break;
      }
    }
  }

  if (!selected && usable.length) {
    source = 'auto';
    selected = usable.reduce((best, id) => (betterThan(id, best) ? id : best));
  }

  if (!selected) {
    throw new AppError(
      'No vision-capable model is available to this API key. ' +
        `Models visible to the key: ${generative.join(', ') || '(none)'}.`,
      503,
      'no_model',
    );
  }

  resolution = { model: selected, requested, source, candidates: usable, resolvedAt: new Date().toISOString() };
  logger.info(`Gemma model resolved: ${selected} (requested "${requested}", source: ${source})`);
  return resolution;
}

/** The resolved model, if resolution has already happened. */
export const currentResolution = () => resolution;

/** The model id this process will actually send requests to. */
export async function activeModel() {
  if (config.gemmaProvider === 'featherless') return config.featherless.model;
  const { model } = await resolveModel();
  return model;
}

/** One Gemma generation via the primary provider — Google AI Studio's `generateContent`. */
async function generateViaGoogle(
  model,
  apiKey,
  {
    prompt,
    images = [],
    temperature = 0.1,
    maxOutputTokens = 512,
    maxRetries = config.gemma.maxRetries,
    timeoutMs = config.gemma.timeoutMs,
    thinkingLevel,
  },
) {
  const parts = [];
  for (const image of images) {
    parts.push({
      inline_data: { mime_type: image.mimeType || 'image/jpeg', data: image.data },
    });
  }
  parts.push({ text: prompt });

  const generationConfig = { temperature, maxOutputTokens, topP: 0.9 };
  // Gemma 4 always reasons first; "minimal" turns that off for interactive Q&A.
  if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel };

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig,
  };
  const url = `${config.gemma.baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 429 || response.status >= 500) {
        const detail = await response.text().catch(() => '');
        lastError = upstreamError(`Gemma returned HTTP ${response.status}`, detail.slice(0, 300));
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw upstreamError(`Gemma request failed (HTTP ${response.status})`, detail.slice(0, 400));
      }

      const payload = await response.json();
      const candidate = payload.candidates?.[0];
      const { text, thoughts } = extractAnswerText(candidate);

      // Thinking is billed against maxOutputTokens, so a tight budget truncates the answer.
      if (candidate?.finishReason === 'MAX_TOKENS') {
        logger.warn(
          `Gemma hit the output token limit before finishing` +
            ` (${payload.usageMetadata?.thoughtsTokenCount ?? '?'} tokens spent thinking).` +
            ' Raise maxOutputTokens — the answer was truncated.',
        );
      }

      return {
        text,
        thoughts,
        model,
        provider: 'google',
        usage: payload.usageMetadata || null,
        finishReason: candidate?.finishReason,
      };
    } catch (err) {
      lastError = err;
      if (err instanceof AppError && err.code !== 'upstream_error') throw err;
      if (attempt === maxRetries) break;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError || upstreamError('Gemma request failed');
}

/** One generation via Featherless.ai's OpenAI-compatible endpoint. */
async function generateViaFeatherless(
  model,
  apiKey,
  {
    prompt,
    images = [],
    temperature = 0.1,
    maxOutputTokens = 512,
    maxRetries = config.gemma.maxRetries,
    timeoutMs = config.gemma.timeoutMs,
  },
) {
  // Featherless asks for the text first, then each image as its own entry.
  const content = [{ type: 'text', text: prompt }];
  for (const image of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType || 'image/jpeg'};base64,${image.data}` },
    });
  }

  const body = {
    model,
    messages: [{ role: 'user', content }],
    temperature,
    max_tokens: maxOutputTokens,
    top_p: 0.9,
  };

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(`${config.featherless.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 429 || response.status >= 500) {
        const detail = await response.text().catch(() => '');
        lastError = upstreamError(
          `Featherless returned HTTP ${response.status}`,
          detail.slice(0, 300),
        );
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw upstreamError(
          `Featherless request failed (HTTP ${response.status})`,
          detail.slice(0, 400),
        );
      }

      const payload = await response.json();
      const choice = payload.choices?.[0];
      const text = (choice?.message?.content || '').trim();

      if (choice?.finish_reason === 'length') {
        logger.warn(
          'Featherless hit the output token limit before finishing — the answer was truncated. ' +
            'Raise maxOutputTokens.',
        );
      }

      return {
        text,
        // No separate reasoning channel here, unlike AI Studio's thought parts.
        thoughts: '',
        model: payload.model || model,
        provider: 'featherless',
        usage: payload.usage || null,
        finishReason: choice?.finish_reason,
      };
    } catch (err) {
      lastError = err;
      if (err instanceof AppError && err.code !== 'upstream_error') throw err;
      if (attempt === maxRetries) break;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError || upstreamError('Featherless request failed');
}

/** Single generation call, routed to the configured provider. */
export async function generate(options = {}) {
  const { model: modelOverride, allowFallback = true, ...genOptions } = options;

  if (config.gemmaProvider === 'featherless') {
    const model = modelOverride || config.featherless.model;
    try {
      return await generateViaFeatherless(model, config.featherless.apiKey, genOptions);
    } catch (primaryErr) {
      const alternate = config.featherless.modelFallback;
      if (!allowFallback || !alternate || alternate === model) throw primaryErr;
      logger.warn(
        `Featherless model ${model} failed: ${primaryErr.message}. Trying ${alternate}.`,
      );
      try {
        return await generateViaFeatherless(alternate, config.featherless.apiKey, genOptions);
      } catch (fallbackErr) {
        logger.warn(`Featherless fallback model also failed: ${fallbackErr.message}`);
        throw primaryErr; // the primary failure is the more useful one to surface
      }
    }
  }

  // An explicit `model` override (e.g. the faster variant for live Q&A) skips
  // resolution; otherwise use the pinned/auto-resolved model.
  const model = modelOverride || (await resolveModel()).model;

  try {
    return await generateViaGoogle(model, config.gemma.apiKey, genOptions);
  } catch (primaryErr) {
    // Interactive callers opt out: a slow primary should not trigger a second full call.
    if (!allowFallback || !config.gemma.apiKeyFallback) throw primaryErr;
    logger.warn(
      `Primary Gemma key failed: ${primaryErr.message}. Falling back to the secondary Google key.`,
    );
    try {
      const result = await generateViaGoogle(model, config.gemma.apiKeyFallback, genOptions);
      logger.info('Served by the secondary Gemma API key (fallback).');
      return { ...result, provider: 'google-fallback' };
    } catch (fallbackErr) {
      logger.warn(`Secondary Gemma key also failed: ${fallbackErr.message}`);
      throw primaryErr; // surface the primary failure to the caller
    }
  }
}

/** Generation that must produce a JSON object. */
export async function generateJson(options) {
  const result = await generate(options);
  const json = parseModelJson(result.text);
  if (!json) {
    logger.warn(`Gemma returned unparseable JSON: ${result.text.slice(0, 200)}`);
  }
  return { ...result, json };
}

/** Test hook: clears the memoised model resolution. */
export function __resetResolution() {
  resolution = null;
}
