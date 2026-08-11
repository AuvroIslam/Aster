'use client';

import { motion } from 'motion/react';
import { SpeakerIcon } from '@/components/icons';
import { Waveform } from '@/components/motion/waveform';

export function SettingsPanel({
  rate,
  onRate,
  descriptionsOn,
  onDescriptionsOn,
  speaking,
}: {
  rate: number;
  onRate: (value: number) => void;
  descriptionsOn: boolean;
  onDescriptionsOn: (value: boolean) => void;
  speaking: boolean;
}) {
  return (
    <section className="glass lift rounded-panel" aria-label="Speech and display">
      <header className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <SpeakerIcon className="h-5 w-5 text-rust" />
          Speech and display
        </h2>
      </header>

      <div className="space-y-6 p-5">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="rate" className="text-sm font-medium">
              Speech speed
            </label>
            <motion.span
              key={rate}
              initial={{ scale: 1.25, color: 'var(--rust)' }}
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
            className="mt-2 w-full accent-rust"
          />
          <div className="mt-1 flex justify-between text-xs text-ink-faint">
            <span>0.5x</span>
            <span>Normal</span>
            <span>2.5x</span>
          </div>
        </div>

        <Toggle
          id="descriptions"
          label="Speak audio descriptions automatically"
          checked={descriptionsOn}
          onChange={onDescriptionsOn}
        />

        <div className="rounded-card border border-line bg-surface/60 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="text-rust">
              <Waveform active={speaking} bars={4} />
            </span>
            {speaking ? 'Aster is speaking' : 'Aster is quiet'}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
            Press <kbd className="rounded bg-ground-deep px-1 py-0.5 font-mono">S</kbd> to skip a
            description, <kbd className="rounded bg-ground-deep px-1 py-0.5 font-mono">R</kbd> to
            replay the last one.
          </p>
        </div>
      </div>
    </section>
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
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
          checked ? 'bg-rust' : 'bg-line'
        }`}
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
