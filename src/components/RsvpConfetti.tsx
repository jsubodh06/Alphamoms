import { useEffect, useRef, useState } from 'react';

export type ConfettiVariant = 'confirmed' | 'updated' | 'waitlisted';

interface RsvpConfettiProps {
  /** Increment this counter whenever an RSVP is successfully saved to fire a new burst. */
  trigger: number;
  /** Optional tone variation for confirmed vs. updated vs. waitlisted saves. */
  variant?: ConfettiVariant;
  /** Called after the confetti animation finishes and clears. */
  onComplete?: () => void;
}

type ParticleShape = 'ribbon' | 'rect' | 'circle' | 'emoji';

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  size: number;
  width: number;
  height: number;
  color: string;
  shape: ParticleShape;
  emoji?: string;
  rotation: number;
  rotationSpeed: number;
  tiltAngle: number;
  tiltSpeed: number;
  wobblePhase: number;
  wobbleSpeed: number;
  opacity: number;
  life: number;
  maxLife: number;
}

const COFFEE_PALETTE: Record<ConfettiVariant, string[]> = {
  confirmed: [
    '#f7ecdc', // foam cream
    '#c98a4b', // caramel
    '#e9a9a0', // blush pink
    '#e4c29b', // kraft
    '#f3c98b', // warm gold
    '#d9b99b', // latte
    '#8c5736', // cinnamon roast
  ],
  updated: [
    '#f7ecdc',
    '#e4c29b',
    '#c98a4b',
    '#e9a9a0',
    '#f3c98b',
  ],
  waitlisted: [
    '#f7ecdc',
    '#e9a9a0',
    '#d9b99b',
    '#e4c29b',
    '#c98a4b',
  ],
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createBurstParticles(
  width: number,
  height: number,
  palette: string[],
  wave: 'primary' | 'secondary',
): ConfettiParticle[] {
  const particles: ConfettiParticle[] = [];
  const isCompact = width < 520;

  if (wave === 'primary') {
    const sideCount = isCompact ? 26 : 38;
    const centerCount = isCompact ? 24 : 34;

    // Left & right warm cannons aimed toward the upper center
    for (const side of ['left', 'right'] as const) {
      const originX = side === 'left' ? width * 0.08 : width * 0.92;
      const originY = height * 0.72;
      for (let i = 0; i < sideCount; i++) {
        const angle =
          side === 'left'
            ? randomBetween(-1.28, -0.58)
            : randomBetween(-2.56, -1.86);
        const speed = randomBetween(isCompact ? 9.5 : 11.5, isCompact ? 17.5 : 22);
        const roll = Math.random();
        const shape: ParticleShape =
          roll < 0.14 ? 'emoji' : roll < 0.42 ? 'ribbon' : roll < 0.78 ? 'rect' : 'circle';

        particles.push({
          x: originX + randomBetween(-16, 16),
          y: originY + randomBetween(-16, 16),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: randomBetween(0.24, 0.34),
          drag: randomBetween(0.972, 0.985),
          size: shape === 'emoji' ? randomBetween(16, 22) : randomBetween(5, 9),
          width: shape === 'ribbon' ? randomBetween(5, 8) : randomBetween(7, 12),
          height: shape === 'ribbon' ? randomBetween(14, 22) : randomBetween(5, 9),
          color: palette[Math.floor(Math.random() * palette.length)],
          shape,
          emoji: shape === 'emoji' ? (i % 2 === 0 ? '☕' : '🤍') : undefined,
          rotation: randomBetween(0, Math.PI * 2),
          rotationSpeed: randomBetween(-0.14, 0.14),
          tiltAngle: randomBetween(0, Math.PI * 2),
          tiltSpeed: randomBetween(0.08, 0.18),
          wobblePhase: randomBetween(0, Math.PI * 2),
          wobbleSpeed: randomBetween(0.05, 0.11),
          opacity: 1,
          life: 0,
          maxLife: randomBetween(135, 195),
        });
      }
    }

    // Center bloom behind the RSVP confirmation card
    for (let i = 0; i < centerCount; i++) {
      const angle = randomBetween(-Math.PI * 0.92, -Math.PI * 0.08);
      const speed = randomBetween(6.5, isCompact ? 13.5 : 16.5);
      const roll = Math.random();
      const shape: ParticleShape =
        roll < 0.2 ? 'emoji' : roll < 0.55 ? 'rect' : roll < 0.8 ? 'ribbon' : 'circle';

      particles.push({
        x: width * 0.5 + randomBetween(-48, 48),
        y: height * 0.42 + randomBetween(-24, 24),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: randomBetween(0.2, 0.3),
        drag: randomBetween(0.968, 0.984),
        size: shape === 'emoji' ? randomBetween(17, 23) : randomBetween(5, 8),
        width: shape === 'ribbon' ? randomBetween(4.5, 7.5) : randomBetween(7, 11),
        height: shape === 'ribbon' ? randomBetween(13, 20) : randomBetween(5, 8),
        color: palette[Math.floor(Math.random() * palette.length)],
        shape,
        emoji: shape === 'emoji' ? (i % 2 === 0 ? '☕' : '🤍') : undefined,
        rotation: randomBetween(0, Math.PI * 2),
        rotationSpeed: randomBetween(-0.12, 0.12),
        tiltAngle: randomBetween(0, Math.PI * 2),
        tiltSpeed: randomBetween(0.07, 0.16),
        wobblePhase: randomBetween(0, Math.PI * 2),
        wobbleSpeed: randomBetween(0.04, 0.1),
        opacity: 1,
        life: 0,
        maxLife: randomBetween(130, 185),
      });
    }
  } else {
    // Gentle top canopy shimmer wave
    const topCount = isCompact ? 24 : 36;
    for (let i = 0; i < topCount; i++) {
      const roll = Math.random();
      const shape: ParticleShape =
        roll < 0.18 ? 'emoji' : roll < 0.52 ? 'ribbon' : roll < 0.82 ? 'rect' : 'circle';

      particles.push({
        x: randomBetween(width * 0.1, width * 0.9),
        y: randomBetween(-24, height * 0.08),
        vx: randomBetween(-2.2, 2.2),
        vy: randomBetween(1.8, 5.2),
        gravity: randomBetween(0.11, 0.17),
        drag: randomBetween(0.985, 0.994),
        size: shape === 'emoji' ? randomBetween(15, 20) : randomBetween(4.5, 7.5),
        width: shape === 'ribbon' ? randomBetween(4, 6.5) : randomBetween(6, 10),
        height: shape === 'ribbon' ? randomBetween(12, 18) : randomBetween(4.5, 7.5),
        color: palette[Math.floor(Math.random() * palette.length)],
        shape,
        emoji: shape === 'emoji' ? (i % 2 === 0 ? '🤍' : '☕') : undefined,
        rotation: randomBetween(0, Math.PI * 2),
        rotationSpeed: randomBetween(-0.1, 0.1),
        tiltAngle: randomBetween(0, Math.PI * 2),
        tiltSpeed: randomBetween(0.06, 0.14),
        wobblePhase: randomBetween(0, Math.PI * 2),
        wobbleSpeed: randomBetween(0.05, 0.1),
        opacity: 1,
        life: 0,
        maxLife: randomBetween(135, 190),
      });
    }
  }

  return particles;
}

export function RsvpConfetti({
  trigger,
  variant = 'confirmed',
  onComplete,
}: RsvpConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger <= 0) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      onCompleteRef.current?.();
      return;
    }

    setIsActive(true);

    let rafId = 0;
    let secondaryTimerId = 0;
    let cancelled = false;
    let particles: ConfettiParticle[] = [];

    const startAnimation = () => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const palette = COFFEE_PALETTE[variant] ?? COFFEE_PALETTE.confirmed;

      const resizeCanvas = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      particles = createBurstParticles(
        window.innerWidth,
        window.innerHeight,
        palette,
        'primary',
      );

      secondaryTimerId = window.setTimeout(() => {
        if (cancelled) return;
        particles.push(
          ...createBurstParticles(
            window.innerWidth,
            window.innerHeight,
            palette,
            'secondary',
          ),
        );
      }, 240);

      let lastTime = performance.now();

      const frame = (now: number) => {
        if (cancelled) return;
        const dt = Math.min((now - lastTime) / 16.6667, 2.2);
        lastTime = now;

        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);

        let aliveCount = 0;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.life += dt;
          if (p.life >= p.maxLife || p.y > h + 40) continue;

          aliveCount++;

          const dragFactor = Math.pow(p.drag, dt);
          p.vx *= dragFactor;
          p.vy = p.vy * dragFactor + p.gravity * dt;

          p.wobblePhase += p.wobbleSpeed * dt;
          p.x += (p.vx + Math.sin(p.wobblePhase) * 0.75) * dt;
          p.y += p.vy * dt;

          p.rotation += p.rotationSpeed * dt;
          p.tiltAngle += p.tiltSpeed * dt;

          const fadeStart = p.maxLife * 0.68;
          if (p.life > fadeStart) {
            p.opacity = Math.max(
              0,
              1 - (p.life - fadeStart) / (p.maxLife - fadeStart),
            );
          }

          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);

          if (p.shape === 'emoji' && p.emoji) {
            ctx.font = `${p.size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.emoji, 0, 0);
          } else if (p.shape === 'circle') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.52, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // 3D paper tumble simulation via scaleY
            const flipScale = Math.cos(p.tiltAngle);
            ctx.scale(1, Math.abs(flipScale) < 0.15 ? 0.15 : flipScale);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          }

          ctx.restore();
        }

        if (aliveCount > 0) {
          rafId = window.requestAnimationFrame(frame);
        } else {
          window.removeEventListener('resize', resizeCanvas);
          setIsActive(false);
          onCompleteRef.current?.();
        }
      };

      rafId = window.requestAnimationFrame(frame);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    };

    // Wait one animation frame so the mounted canvas ref is ready
    let cleanupResize: (() => void) | undefined;
    const initRaf = window.requestAnimationFrame(() => {
      cleanupResize = startAnimation();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(initRaf);
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(secondaryTimerId);
      cleanupResize?.();
    };
  }, [trigger, variant]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}
