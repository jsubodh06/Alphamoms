import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';

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

const PARTICLES: Particle[] = Array.from({ length: 20 }, (_, i) => {
  const isCoffee = i % 2 === 0;
  const spread = ((i % 7) - 3) * 34;
  return {
    id: i,
    emoji: isCoffee ? '☕' : '🤍',
    left: `${8 + ((i * 4.7) % 84)}%`,
    cx: `${spread}px`,
    cy: `${200 + (i % 5) * 44}px`,
    crot: `${(i % 2 === 0 ? 1 : -1) * (120 + i * 18)}deg`,
    cdur: `${1.8 + (i % 4) * 0.3}s`,
    cdelay: `${(i % 6) * 0.08}s`,
    size: i % 3 === 0 ? '22px' : '17px',
  };
});

export function ConfettiBurst({ burstKey }: { burstKey: number }) {
  if (burstKey <= 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div
      key={burstKey}
      className="pointer-events-none fixed inset-x-0 top-12 z-[9998] mx-auto h-80 max-w-md overflow-hidden"
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
    </div>,
    document.body,
  );
}
