import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * "bn" -> "Bangla". Language codes travel through the system because
 * speechSynthesis needs them; only the display layer turns them into names.
 */
export function languageName(code: string) {
  if (!code || code === 'auto') return 'Auto';
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** 214 -> "3:34". Used everywhere a timestamp is spoken or shown. */
export function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
