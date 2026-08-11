'use client';

import { motion } from 'motion/react';
import { SpeakerIcon, EyeIcon, SparkIcon } from '@/components/icons';
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

        <Slider
          id="rate"
          label="Speech speed"
          value={rate}
          min={0.5}
          max={2.5}
          step={0.05}
          onChange={onRate}
          display={`${rate.toFixed(2)}x`}
          ticks={['0.5x', 'Normal', '2.5x']}
        />

        <Slider
          id="volume"
          label="Description volume"
          value={volume}
          min={0.1}
          max={1}
          step={0.05}
          onChange={onVolume}
          display={`${Math.round(volume * 100)}%`}
          ticks={['10%', '', '100%']}
        />

        <div>
          <label htmlFor="voice" className="text-sm font-medium">
            Description voice <span className="font-normal text-ink-faint">({language})</span>
          </label>
          <select
            id="voice"
            value={voiceURI}
            onChange={(e) => onVoiceURI(e.target.value)}
            disabled={!speechSupported || voices.length === 0}
            className="mt-2 w-full rounded-card border border-line bg-surface px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink disabled:opacity-50"
          >
            <option value="">Best available</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} — {voice.lang}
              </option>
            ))}
          </select>

          <button
            onClick={onTestVoice}
            disabled={!speechSupported}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-card border border-line py-2.5 text-sm transition-colors hover:border-line-strong disabled:opacity-50"
          >
            <SpeakerIcon className="h-4 w-4" />
            Test this voice
          </button>

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

        <div className="rounded-card border border-line bg-surface-raised p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="text-bloom">
              <Waveform active={speaking} bars={4} />
            </span>
            {speaking ? 'Aster is speaking' : 'Aster is quiet'}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
            Press <kbd className="rounded bg-white/[0.06] px-1 py-0.5 font-mono">S</kbd> to skip a
            description, <kbd className="rounded bg-white/[0.06] px-1 py-0.5 font-mono">R</kbd> to
            replay the last one,{' '}
            <kbd className="rounded bg-white/[0.06] px-1 py-0.5 font-mono">?</kbd> for every
            shortcut.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-card border border-line bg-surface-raised p-4">
          <span className="mt-0.5 text-bloom">
            <SparkIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium">Running on Gemma</p>
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

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  ticks,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
  ticks: string[];
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
        className="scrubber mt-3 w-full"
        style={{
          background: `linear-gradient(to right, var(--bloom) ${percent}%, var(--line-strong) ${percent}%)`,
        }}
      />
      <div className="mt-2 flex justify-between text-xs text-ink-faint">
        {ticks.map((tick, i) => (
          <span key={i}>{tick}</span>
        ))}
      </div>
    </div>
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
        active
          ? 'border-line-strong bg-surface-raised'
          : 'border-line bg-surface hover:border-line-strong'
      )}
    >
      {active && (
        <motion.span
          layoutId="narration-active"
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
          className="absolute inset-y-0 left-0 w-1 bg-bloom"
        />
      )}
      <span className="flex items-center gap-2 text-sm font-medium">
        <EyeIcon className={cn('h-4 w-4', active ? 'text-bloom' : 'text-ink-faint')} />
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
