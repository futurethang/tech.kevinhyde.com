/**
 * Diamond Component - SVG baseball diamond
 * v5 Topps design: gold occupied bases, navy palette
 */

interface DiamondProps {
  bases: [boolean, boolean, boolean];
}

export function Diamond({ bases }: DiamondProps) {
  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path d="M50 85 L15 50 L50 15 L85 50 Z" fill="none" stroke="var(--color-text-dim)" strokeWidth="2" />
        <polygon points="50,85 45,80 50,75 55,80" fill="var(--color-text-muted)" />
        <rect
          x="78" y="43" width="14" height="14"
          fill={bases[0] ? 'var(--color-topps-gold)' : 'var(--color-surface-hover)'}
          stroke={bases[0] ? 'var(--color-topps-gold-shadow)' : 'var(--color-text-dim)'}
          strokeWidth="1"
        />
        <rect
          x="43" y="8" width="14" height="14"
          fill={bases[1] ? 'var(--color-topps-gold)' : 'var(--color-surface-hover)'}
          stroke={bases[1] ? 'var(--color-topps-gold-shadow)' : 'var(--color-text-dim)'}
          strokeWidth="1"
        />
        <rect
          x="8" y="43" width="14" height="14"
          fill={bases[2] ? 'var(--color-topps-gold)' : 'var(--color-surface-hover)'}
          stroke={bases[2] ? 'var(--color-topps-gold-shadow)' : 'var(--color-text-dim)'}
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
