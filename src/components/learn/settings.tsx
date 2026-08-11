'use client';

import { motion } from 'motion/react';
import { SpeakerIcon, EyeIcon, SparkIcon } from '@/components/icons';
import { Waveform } from '@/components/motion/waveform';
import { cn } from '@/lib/utils';
import type { NarrationMode } from '@/lib/types';

const LANGUAGES = [
  { code: 'auto', label: 'Match the video' },
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা — Bangla' },
  { code: 'hi', label: 'हिन्दी — Hindi' },
];

export function SettingsPanel({
  rate,
  onRate,
  descriptionsOn,
  onDescriptionsOn,
  narration,
  onNarration,
  language,
  onLanguage,
  highContrast,
  onHighContrast,
  speaking,
}: {
  rate: number;
  onRate: (value: number) => void;
  descriptionsOn: boolean;
  onDescriptionsOn: (value: boolean) => void;
  narration: NarrationMode;
  onNarration: (value: NarrationMode) => void;
  language: string;
  onLanguage: (value: string) => void;
  highContrast: boolean;
  onHighContrast: (value: boolean) => void;
  speaking: boolean;
}) {
  return (
    <section className="panel rounded-panel" aria-label="Speech and display">
      <header className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <SpeakerIcon className="h-5 w-5 text-ink" />
          Speech and display
        </h2>
      </header>

      <div className="space-y-6 p-5">
        {/* The central choice: let the creator lead, or have Aster explain it all. */}
        <fieldset>
          <legend className="text-sm font-medium">How much should I say?</legend>
          <div className="mt-3 space-y-2">
            <NarrationOption
              value="adaptive"
              current={narration}
              onSelect={onNarration}
              title="Adaptive"
              body="The creator narrates. I speak only into the pauses, and only when the screen carries something they never mention."
            />
            <NarrationOption
              value="full"
              current={narration}
              onSelect={onNarration}
              title="Full explanation"
              body="I explain the whole lesson for a learner who cannot see it — not a transcript read aloud."
            />
          </div>
        </fieldset>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="rate" className="text-sm font-medium">
              Speech speed
            </label>
            <motion.span
              key={rate}
              initial={{ scale: 1.25, color: 'var(--ink)' }}
              animate={{ scale: 1, color: 'var(--ink-soft)' }}
              className="font-mono text-sm"
            >
              {rate.toFixed(2)}x
            </motion.span>
          </div>
          <input
            id="rate"
            type="range"
            min={0.5}
            max={2.5}
            step={0.05}
            value={rate}
            onChange={(e) => onRate(Number(e.target.value))}
            className="mt-2 w-full accent-white"
          />
          <div className="mt-1 flex justify-between text-xs text-ink-faint">
            <span>0.5x</span>
            <span>Normal</span>
            <span>2.5x</span>
          </div>
        </div>

        <div>
          <label htmlFor="lang" className="text-sm font-medium">
            Explain in
          </label>
          <select
            id="lang"
            value={language}
            onChange={(e) => onLanguage(e.target.value)}
            className="mt-2 w-full rounded-card border border-line bg-surface px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink"
          >
            {LANGUAGES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
          {language === 'bn' && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 text-xs leading-relaxed text-live"
            >
              Bangla speech needs a Bangla voice. Microsoft Edge ships one; most other browsers
              need one installed first.
            </motion.p>
          )}
        </div>

        <Toggle
          id="descriptions"
          label="Speak audio descriptions automatically"
          checked={descriptionsOn}
          onChange={onDescriptionsOn}
        />

        <Toggle
          id="contrast"
          label="High contrast mode"
          checked={highContrast}
          onChange={onHighContrast}
        />

        <div className="rounded-card border border-line bg-surface/60 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="text-ink">
              <Waveform active={speaking} bars={4} />
            </span>
            {speaking ? 'Aster is speaking' : 'Aster is quiet'}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
            Press <kbd className="rounded bg-ground-deep px-1 py-0.5 font-mono">S</kbd> to skip a
            description, <kbd className="rounded bg-ground-deep px-1 py-0.5 font-mono">R</kbd> to
            replay the last one, <kbd className="rounded bg-ground-deep px-1 py-0.5 font-mono">?</kbd>{' '}
            for every shortcut.
          </p>
        </div>

        {/* Provenance: one model generates everything, and it is named. */}
        <div className="flex items-start gap-3 rounded-card border border-line bg-white/[0.05] p-4">
          <span className="mt-0.5 text-ink-soft">
            <SparkIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink-soft">Running on gemma-4-31b-it</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Every description, answer and question comes from Gemma — runnable locally, with no
              per-request API cost.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function NarrationOption({
  value,
  current,
  onSelect,
  title,
  body,
}: {
  value: NarrationMode;
  current: NarrationMode;
  onSelect: (value: NarrationMode) => void;
  title: string;
  body: string;
}) {
  const active = current === value;

  return (
    <button
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={cn(
        'relative w-full overflow-hidden rounded-card border p-3 text-left transition-colors duration-300',
        active ? 'border-line-strong bg-white/[0.06]' : 'border-line bg-surface/50 hover:border-line-strong'
      )}
    >
      {active && (
        <motion.span
          layoutId="narration-active"
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
          className="absolute inset-y-0 left-0 w-1 bg-ink"
        />
      )}
      <span className="flex items-center gap-2 text-sm font-medium">
        <EyeIcon className={cn('h-4 w-4', active ? 'text-ink' : 'text-ink-faint')} />
        {title}
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-ink-soft">{body}</span>
    </button>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="text-sm leading-snug">
        {label}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300',
          checked ? 'bg-ink' : 'bg-line'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className="absolute top-0.5 h-5 w-5 rounded-full bg-surface-raised shadow"
          style={{ left: checked ? 'calc(100% - 1.375rem)' : '0.125rem' }}
        />
      </button>
    </div>
  );
}
