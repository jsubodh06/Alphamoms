import type { CSSProperties } from 'react';

interface Particle {
  id: number;
  emoji: string;
  left: string;
  cx: string;
  cy: string;
  crot: string;
  cdur: string;
  cdelay: string;
  size: string;
}

const PARTICLES: Particle[] = Array.from({ length: 18 }, (_, i) => {
  const isCoffee = i % 2 === 0;
  const spread = ((i % 7) - 3) * 34;
  return {
    id: i,
    emoji: isCoffee ? '☕' : '🤍',
    left: `${8 + ((i * 5.1) % 84)}%`,
    cx: `${spread}px`,
    cy: `${170 + (i % 5) * 38}px`,
    crot: `${(i % 2 === 0 ? 1 : -1) * (120 + i * 18)}deg`,
    cdur: `${1.8 + (i % 4) * 0.3}s`,
    cdelay: `${(i % 6) * 0.08}s`,
    size: i % 3 === 0 ? '20px' : '16px',
  };
});

export function ConfettiBurst({ burstKey }: { burstKey: number }) {
  if (burstKey <= 0) return null;

  return (
    <div
      key={burstKey}
      className="pointer-events-none fixed inset-x-0 top-14 z-40 mx-auto h-64 max-w-md overflow-hidden"
      aria-hidden="true"
    >
      {PARTICLES.map((p) => {
        const style = {
          left: p.left,
          top: '0px',
          fontSize: p.size,
          '--cx': p.cx,
          '--cy': p.cy,
          '--crot': p.crot,
          '--cdur': p.cdur,
          '--cdelay': p.cdelay,
        } as CSSProperties;

        return (
          <span key={p.id} style={style} className="absolute confetti-emoji">
            {p.emoji}
          </span>
        );
      })}
    </div>
  );
}
