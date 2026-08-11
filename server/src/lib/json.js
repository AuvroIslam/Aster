/** Robust JSON extraction from a language model's text response. */

/** Finds the first balanced {...} block in `text`, ignoring braces in strings. */
export function findJsonObject(text) {
  const source = String(text ?? '');
  const start = source.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

/** Parses a model response into an object. */
export function parseModelJson(text) {
  if (text == null) return null;
  const raw = String(text).trim();

  // 1. The whole response is already JSON.
  const direct = tryParse(raw);
  if (direct) return direct;

  // 2. Strip a ```json fence.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed) return parsed;
  }

  // 3. Pull out the first balanced object anywhere in the prose.
  const block = findJsonObject(raw);
  if (block) {
    const parsed = tryParse(block);
    if (parsed) return parsed;
    // 4. Last resort: repair trailing commas and single quotes around keys.
    const repaired = block
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*)'/g, ': "$1"');
    const fixed = tryParse(repaired);
    if (fixed) return fixed;
  }

  return null;
}

function tryParse(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** Clamp helper used when normalising model-supplied confidence values. */
export function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
