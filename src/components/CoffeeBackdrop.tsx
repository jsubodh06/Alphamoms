import type { CSSProperties } from 'react';

interface BeanConfig {
  id: number;
  left: string;
  size: number;
  duration: string;
  delay: string;
  sway: string;
  rot: string;
  opacity: number;
}

const BEANS: BeanConfig[] = [
  { id: 1, left: '7%', size: 22, duration: '24s', delay: '-4s', sway: '22px', rot: '240deg', opacity: 0.2 },
  { id: 2, left: '19%', size: 17, duration: '29s', delay: '-14s', sway: '-18px', rot: '-210deg', opacity: 0.16 },
  { id: 3, left: '34%', size: 24, duration: '26s', delay: '-8s', sway: '28px', rot: '300deg', opacity: 0.18 },
  { id: 4, left: '53%', size: 16, duration: '32s', delay: '-21s', sway: '-24px', rot: '180deg', opacity: 0.15 },
  { id: 5, left: '71%', size: 23, duration: '25s', delay: '-11s', sway: '16px', rot: '-270deg', opacity: 0.21 },
  { id: 6, left: '84%', size: 18, duration: '30s', delay: '-18s', sway: '-20px', rot: '220deg', opacity: 0.17 },
  { id: 7, left: '93%', size: 20, duration: '27s', delay: '-3s', sway: '-14px', rot: '-190deg', opacity: 0.19 },
];

export function CoffeeBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden z-0 espresso-canvas"
      aria-hidden="true"
    >
      {/* Subtle grain texture */}
      <div className="absolute inset-0 grain-overlay" />

      {/* Warm bottom espresso-caramel glow */}
      <div
        className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[125vw] max-w-[960px] h-72 rounded-full opacity-45"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(201,138,75,0.48) 0%, rgba(233,169,160,0.16) 45%, transparent 74%)',
        }}
      />

      {/* Slowly drifting roasted coffee beans */}
      {BEANS.map((bean) => {
        const style = {
          left: bean.left,
          top: '-8vh',
          width: `${bean.size}px`,
          height: `${Math.round(bean.size * 1.32)}px`,
          '--bean-duration': bean.duration,
          '--bean-delay': bean.delay,
          '--bean-sway': bean.sway,
          '--bean-rot': bean.rot,
          '--bean-opacity': String(bean.opacity),
        } as CSSProperties;

        return (
          <svg
            key={bean.id}
            viewBox="0 0 32 42"
            style={style}
            className="absolute drifting-bean"
            fill="none"
          >
            <ellipse
              cx="16"
              cy="21"
              rx="12.5"
              ry="17.5"
              fill="#5d3621"
              stroke="#8c5736"
              strokeWidth="1.2"
            />
            <path
              d="M16.5 5.5C13 13 19.5 22 15.5 36.5"
              stroke="#241209"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        );
      })}
    </div>
  );
}
