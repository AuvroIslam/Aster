import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
};

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 5.5v13l11-6.5z" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}

export function SpeakerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

export function MuteIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" />
      <path d="M16.5 10l4 4M20.5 10l-4 4" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />
      <path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </svg>
  );
}

export function DocIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h7.5L18 8v12.5H6z" />
      <path d="M13.5 3.5V8H18" />
      <path d="M9 12.5h6M9 16h4" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20.5 12c0 4-3.8 7-8.5 7a10 10 0 0 1-2.6-.34L4.5 20.5l1.2-3.6A6.6 6.6 0 0 1 3.5 12c0-4 3.8-7 8.5-7s8.5 3 8.5 7z" />
    </svg>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
    </svg>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 8.5L5 12l3.5 3.5M15.5 8.5L19 12l-3.5 3.5M13.5 5l-3 14" />
    </svg>
  );
}

export function GraphIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 19.5V4.5M4.5 19.5h15" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </svg>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M7.5 9.5l3 2.5-3 2.5M13 15h4" />
    </svg>
  );
}

/**
 * The aster flower: sixteen tapering petals around a small dotted disc. Drawn
 * as pure geometry so it stays crisp from 16px in the nav to 96px in the hero.
 */
export function AsterMark({
  petals = 16,
  className,
  ...props
}: IconProps & { petals?: number }) {
  return (
    // Defaults to the bloom yellow; pass a text-* class to override.
    <svg viewBox="0 0 64 64" fill="none" className={cn('text-bloom', className)} {...props}>
      {Array.from({ length: petals }).map((_, i) => (
        <path
          key={i}
          // A leaf shape from the centre outward, mirrored about its own axis.
          d="M32 32 C29.4 24 29.6 15 32 4 C34.4 15 34.6 24 32 32 Z"
          fill="currentColor"
          transform={`rotate(${(360 / petals) * i} 32 32)`}
        />
      ))}
      {/* The disc florets, lighter than the petals as on the real flower. */}
      <circle cx="32" cy="32" r="5.4" fill="currentColor" />
      <circle cx="32" cy="32" r="4" className="fill-bloom-soft" />
    </svg>
  );
}
