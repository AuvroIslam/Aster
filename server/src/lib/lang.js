/** Language helpers for Aster's multilingual pipeline. */

/** Bare language subtag: "en-US" -> "en", "bn-orig" -> "bn", "" -> "". */
export function baseLang(code) {
  return String(code || '')
    .trim()
    .toLowerCase()
    .replace(/-orig$/i, '')
    .split(/[-_]/)[0];
}

/** English is the pipeline's historical default, so treat "" as English too. */
export const isEnglish = (code) => {
  const base = baseLang(code);
  return base === '' || base === 'en';
};

let englishNames = null;
function englishDisplay() {
  if (!englishNames) {
    try {
      englishNames = new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
      englishNames = { of: (code) => code };
    }
  }
  return englishNames;
}

/** English name of a language code: "bn" -> "Bengali". Falls back to the code. */
export function languageName(code) {
  const base = baseLang(code);
  if (!base) return 'English';
  try {
    return englishDisplay().of(base) || base;
  } catch {
    return base;
  }
}

/** The language's own name: "bn" -> "বাংলা". Falls back to the English name. */
export function nativeLanguageName(code) {
  const base = baseLang(code);
  if (!base) return 'English';
  try {
    return new Intl.DisplayNames([base], { type: 'language' }).of(base) || languageName(base);
  } catch {
    return languageName(base);
  }
}

/** Language descriptor: `code` picks the speech voice, `name`/`native` label it. */
export function describeLanguage(code) {
  const base = baseLang(code) || 'en';
  return {
    code: base,
    name: languageName(base),
    native: nativeLanguageName(base),
    isEnglish: base === 'en',
  };
}

/** Resolves the output language from the configured policy and the language the narration was. */
export function resolveOutputLanguage(configured, narrationLang) {
  const policy = String(configured || 'auto').trim().toLowerCase();
  const code = !policy || policy === 'auto' ? narrationLang : policy;
  return describeLanguage(code || 'en');
}
