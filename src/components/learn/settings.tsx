'use client';

import { motion } from 'motion/react';
import { SpeakerIcon, SparkIcon } from '@/components/icons';
import { Waveform } from '@/components/motion/waveform';
import { cn } from '@/lib/utils';
import type { NarrationMode } from '@/lib/types';

export function SettingsPanel({
  rate,
  onRate,
  volume,
  onVolume,
  voiceURI,
  onVoiceURI,
  voices,
  voiceAvailable,
  speechSupported,
  descriptionsOn,
  onDescriptionsOn,
  narration,
  onNarration,
  language,
  highContrast,
  onHighContrast,
  speaking,
  onTestVoice,
}: {
  rate: number;
  onRate: (value: number) => void;
  volume: number;
  onVolume: (value: number) => void;
  voiceURI: string;
  onVoiceURI: (value: string) => void;
  voices: SpeechSynthesisVoice[];
  voiceAvailable: boolean;
  speechSupported: boolean;
  descriptionsOn: boolean;
  onDescriptionsOn: (value: boolean) => void;
  narration: NarrationMode;
  onNarration: (value: NarrationMode) => void;
  /** The lesson's own language, detected from its captions. */
  language: string;
  highContrast: boolean;
  onHighContrast: (value: boolean) => void;
  speaking: boolean;
  onTestVoice: () => void;
}) {
  return (
    <section className="panel rounded-panel" aria-label="Speech and display">
      <header className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight">
          <SpeakerIcon className="h-5 w-5 text-bloom" />
          Speech and display
        </h2>
      </header>

      <div className="space-y-5 p-4">
        {/* The central choice: let the creator lead, or have Aster explain it
            all. A segmented control rather than two paragraph cards — the
            difference is one line, and only the chosen one needs explaining. */}
        <fieldset>
          <legend className="text-sm font-medium">How much should I say?</legend>
          <div
            role="radiogroup"
            aria-label="How much should I say?"
            className="mt-2 flex gap-1 rounded-full border border-line p-1"
          >
            {NARRATION_MODES.map((mode) => (
              <button
                key={mode.value}
                role="radio"
                aria-checked={narration === mode.value}
                onClick={() => onNarration(mode.value)}
                className={cn(
                  'relative flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  narration === mode.value ? 'text-ground' : 'text-ink-soft hover:text-ink'
                )}
              >
                {narration === mode.value && (
                  <motion.span
                    layoutId="narration-active"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-ink"
                  />
                )}
                <span className="relative z-10">{mode.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            {NARRATION_MODES.find((m) => m.value === narration)?.body}
          </p>
        </fieldset>

        <Slider
          id="rate"
          label="Speed"
          value={rate}
          min={0.5}
          max={2.5}
          step={0.05}
          onChange={onRate}
          display={`${rate.toFixed(2)}x`}
        />

        <Slider
          id="volume"
          label="Volume"
          value={volume}
          min={0.1}
          max={1}
          step={0.05}
          onChange={onVolume}
          display={`${Math.round(volume * 100)}%`}
        />

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="voice" className="text-sm font-medium">
              Voice <span className="font-normal text-ink-faint">({language})</span>
            </label>
            <button
              onClick={onTestVoice}
              disabled={!speechSupported}
              className="text-xs text-ink-faint transition-colors hover:text-ink disabled:opacity-50"
            >
              Test
            </button>
          </div>
          <select
            id="voice"
            value={voiceURI}
            onChange={(e) => onVoiceURI(e.target.value)}
            disabled={!speechSupported || voices.length === 0}
            className="mt-2 w-full rounded-card border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-ink disabled:opacity-50"
          >
            <option value="">Best available</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} — {voice.lang}
              </option>
            ))}
          </select>

          {/* Voice availability is a real limitation for non-English lessons,
              so it is stated plainly rather than failing silently. */}
          {!speechSupported ? (
            <p className="mt-2 text-xs leading-relaxed text-live">
              This browser has no speech synthesis. Descriptions will appear as text only.
            </p>
          ) : !voiceAvailable ? (
            <p className="mt-2 text-xs leading-relaxed text-live">
              No voice installed for this language. Microsoft Edge ships online voices for most
              languages, including Bangla.
            </p>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <Toggle
            id="descriptions"
            label="Speak descriptions automatically"
            checked={descriptionsOn}
            onChange={onDescriptionsOn}
          />
          <Toggle
            id="contrast"
            label="High contrast"
            checked={highContrast}
            onChange={onHighContrast}
          />
        </div>

        <div className="space-y-2 border-t border-line pt-4 text-xs text-ink-faint">
          <p className="flex items-center gap-2">
            <span className="text-bloom">
              <Waveform active={speaking} bars={4} />
            </span>
            {speaking ? 'Aster is speaking' : 'Aster is quiet'}
          </p>
          <p className="leading-relaxed">
            <Key>S</Key> skip · <Key>R</Key> replay · <Key>?</Key> all shortcuts
          </p>
          <p className="flex items-center gap-1.5 leading-relaxed">
            <SparkIcon className="h-3.5 w-3.5 shrink-0 text-bloom" />
            Running on Gemma — no per-request API cost.
          </p>
        </div>
      </div>
    </section>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
}) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <motion.span
          key={display}
          initial={{ scale: 1.2, color: 'var(--bloom)' }}
          animate={{ scale: 1, color: 'var(--ink-soft)' }}
          className="font-mono text-sm"
        >
          {display}
        </motion.span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="scrubber mt-2 w-full"
        style={{
          background: `linear-gradient(to right, var(--bloom) ${percent}%, var(--line-strong) ${percent}%)`,
        }}
      />
    </div>
  );
}

const NARRATION_MODES: { value: NarrationMode; label: string; body: string }[] = [
  {
    value: 'adaptive',
    label: 'Adaptive',
    body: 'I speak only into the creator’s pauses, and only when the screen carries something they never mention.',
  },
  {
    value: 'full',
    label: 'Full explanation',
    body: 'I explain the whole lesson for a learner who cannot see it — not a transcript read aloud.',
  },
];

/** A keyboard key in running text. */
function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-ink-soft">{children}</kbd>;
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
          checked ? 'bg-bloom' : 'bg-line-strong'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full',
            checked ? 'bg-ground' : 'bg-ink-soft'
          )}
          style={{ left: checked ? 'calc(100% - 1.375rem)' : '0.125rem' }}
        />
      </button>
    </div>
  );
}
