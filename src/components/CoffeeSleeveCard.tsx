import { useState, type ReactNode } from 'react';

interface CoffeeSleeveCardProps {
  offset: number;
  isReachable: boolean;
  isDragging?: boolean;
  dragShiftPx?: number;
  compact?: boolean;
  tag: string;
  onSelectSideCard?: () => void;
  children: ReactNode;
}

export function CoffeeSleeveCard({
  offset,
  isReachable,
  isDragging = false,
  dragShiftPx = 0,
  compact = false,
  tag,
  onSelectSideCard,
  children,
}: CoffeeSleeveCardProps) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const isActive = offset === 0;
  const absOffset = Math.abs(offset);

  let translateX = offset * 72;
  let translateY = absOffset === 1 ? 8 : 16;
  let translateZ = absOffset === 0 ? 0 : absOffset === 1 ? -145 : -290;
  let rotateY = offset === 0 ? 0 : offset < 0 ? 26 : -26;
  let scale = absOffset === 0 ? 1 : absOffset === 1 ? 0.84 : 0.7;
  let opacity = absOffset === 0 ? 1 : absOffset === 1 ? 0.56 : 0;

  if (absOffset >= 2) {
    translateX = offset * 105;
    rotateY = offset < 0 ? 38 : -38;
  }

  // Add live drag follow feel while swiping
  const dragXCalc = isDragging ? dragShiftPx * (isActive ? 0.55 : 0.35) : 0;

  const transform = isActive
    ? `translate3d(${dragXCalc}px, 0px, 0px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry + (isDragging ? dragShiftPx * 0.04 : 0)}deg) scale(1)`
    : `translate3d(calc(${translateX}% + ${dragXCalc}px), ${translateY}px, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isActive || e.pointerType !== 'mouse') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-ny * 3.5).toFixed(2)),
      ry: Number((nx * 4.5).toFixed(2)),
    });
  };

  const handlePointerLeave = () => {
    if (tilt.rx !== 0 || tilt.ry !== 0) {
      setTilt({ rx: 0, ry: 0 });
    }
  };

  return (
    <div
      aria-hidden={!isActive}
      inert={!isActive ? true : undefined}
      onClick={!isActive && isReachable ? onSelectSideCard : undefined}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        transform,
        opacity,
        zIndex: isActive ? 30 : absOffset === 1 ? 20 : 10,
        pointerEvents:
          isActive || (absOffset === 1 && isReachable) ? 'auto' : 'none',
      }}
      className={`carousel-card-gpu ${
        isDragging ? 'carousel-card-dragging' : ''
      } absolute left-1/2 top-0 -ml-[min(45vw,210px)] sm:-ml-[225px] w-[min(90vw,420px)] sm:w-[450px] ${
        !isActive && isReachable ? 'cursor-pointer' : ''
      }`}
    >
      <div
        className={`relative overflow-hidden rounded-[26px] foam-paper text-[#241209] shadow-[0_24px_55px_-14px_rgba(8,3,1,0.72),0_8px_20px_-6px_rgba(36,18,9,0.45)] border border-[#e4c29b]/80 ${
          !isActive ? 'select-none' : ''
        }`}
      >
        {/* Corrugated Caramel & Roast Coffee-Sleeve Band */}
        <div className="relative h-5 w-full coffee-sleeve-band border-b border-[#4a2a1a]/25">
          <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-black/15" />
        </div>

        {/* Faint Coffee-Ring Stain in bottom-right corner */}
        <svg
          viewBox="0 0 120 120"
          className="pointer-events-none absolute -bottom-7 -right-6 w-32 h-32 text-[#8b4c24] opacity-[0.075]"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="60"
            cy="60"
            r="42"
            stroke="currentColor"
            strokeWidth="6.5"
            strokeDasharray="195 14 40 8"
          />
          <circle
            cx="63"
            cy="58"
            r="38"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeOpacity="0.65"
          />
          <circle cx="24" cy="36" r="2.8" fill="currentColor" fillOpacity="0.5" />
        </svg>

        {/* Card Content */}
        <div
          className={`relative z-10 ${
            compact ? 'px-5 py-4' : 'px-6 py-6 sm:px-8 sm:py-7'
          }`}
        >
          <div className="mb-3 flex items-center justify-between text-xs font-medium tracking-wide text-[#7a4526]">
            <span>{tag}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
