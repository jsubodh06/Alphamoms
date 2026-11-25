import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
    '#fff6e8', // bright cream
    '#f6c453', // celebratory gold
    '#e9a9a0', // blush pink
    '#d98b45', // warm caramel
    '#f28b82', // rose coral
    '#e4c29b', // kraft
    '#a66336', // roast caramel
  ],
  updated: [
    '#fff6e8',
    '#f6c453',
    '#d98b45',
    '#e9a9a0',
    '#e4c29b',
  ],
  waitlisted: [
    '#fff6e8',
    '#e9a9a0',
    '#d9b99b',
    '#f6c453',
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
    const sideCount = isCompact ? 36 : 48;
    const centerCount = isCompact ? 34 : 44;

    // Left & right cannons firing high across the viewport
    for (const side of ['left', 'right'] as const) {
      const originX = side === 'left' ? width * 0.06 : width * 0.94;
      const originY = height * 0.78;
      for (let i = 0; i < sideCount; i++) {
        const angle =
          side === 'left'
            ? randomBetween(-1.32, -0.52)
            : randomBetween(-2.62, -1.82);
        const speed = randomBetween(isCompact ? 11 : 13, isCompact ? 20 : 25);
        const roll = Math.random();
        const shape: ParticleShape =
          roll < 0.16 ? 'emoji' : roll < 0.48 ? 'ribbon' : roll < 0.82 ? 'rect' : 'circle';

        particles.push({
          x: originX + randomBetween(-18, 18),
          y: originY + randomBetween(-18, 18),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: randomBetween(0.24, 0.34),
          drag: randomBetween(0.974, 0.986),
          size: shape === 'emoji' ? randomBetween(18, 26) : randomBetween(6, 10),
          width: shape === 'ribbon' ? randomBetween(5.5, 9) : randomBetween(8, 13),
          height: shape === 'ribbon' ? randomBetween(16, 24) : randomBetween(6, 10),
          color: palette[Math.floor(Math.random() * palette.length)],
          shape,
          emoji:
            shape === 'emoji'
              ? i % 3 === 0
                ? '☕'
                : i % 3 === 1
                  ? '🤍'
                  : '✨'
              : undefined,
          rotation: randomBetween(0, Math.PI * 2),
          rotationSpeed: randomBetween(-0.15, 0.15),
          tiltAngle: randomBetween(0, Math.PI * 2),
          tiltSpeed: randomBetween(0.08, 0.18),
          wobblePhase: randomBetween(0, Math.PI * 2),
          wobbleSpeed: randomBetween(0.05, 0.11),
          opacity: 1,
          life: 0,
          maxLife: randomBetween(145, 210),
        });
      }
    }

    // Center celebratory burst directly over the RSVP card
    for (let i = 0; i < centerCount; i++) {
      const angle = randomBetween(-Math.PI * 0.96, -Math.PI * 0.04);
      const speed = randomBetween(7.5, isCompact ? 15.5 : 19);
      const roll = Math.random();
      const shape: ParticleShape =
        roll < 0.22 ? 'emoji' : roll < 0.58 ? 'rect' : roll < 0.84 ? 'ribbon' : 'circle';

      particles.push({
        x: width * 0.5 + randomBetween(-56, 56),
        y: height * 0.48 + randomBetween(-28, 28),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: randomBetween(0.21, 0.31),
        drag: randomBetween(0.97, 0.985),
        size: shape === 'emoji' ? randomBetween(19, 27) : randomBetween(6, 9),
        width: shape === 'ribbon' ? randomBetween(5, 8) : randomBetween(8, 12),
        height: shape === 'ribbon' ? randomBetween(14, 22) : randomBetween(6, 9),
        color: palette[Math.floor(Math.random() * palette.length)],
        shape,
        emoji:
          shape === 'emoji'
            ? i % 3 === 0
              ? '☕'
              : i % 3 === 1
                ? '🤍'
                : '🎉'
            : undefined,
        rotation: randomBetween(0, Math.PI * 2),
        rotationSpeed: randomBetween(-0.14, 0.14),
        tiltAngle: randomBetween(0, Math.PI * 2),
        tiltSpeed: randomBetween(0.07, 0.16),
        wobblePhase: randomBetween(0, Math.PI * 2),
        wobbleSpeed: randomBetween(0.04, 0.1),
        opacity: 1,
        life: 0,
        maxLife: randomBetween(140, 200),
      });
    }
  } else {
    // Second canopy shower from top of viewport
    const topCount = isCompact ? 34 : 46;
    for (let i = 0; i < topCount; i++) {
      const roll = Math.random();
      const shape: ParticleShape =
        roll < 0.2 ? 'emoji' : roll < 0.54 ? 'ribbon' : roll < 0.84 ? 'rect' : 'circle';

      particles.push({
        x: randomBetween(width * 0.06, width * 0.94),
        y: randomBetween(-28, height * 0.1),
        vx: randomBetween(-2.6, 2.6),
        vy: randomBetween(2.2, 5.8),
        gravity: randomBetween(0.11, 0.18),
        drag: randomBetween(0.985, 0.994),
        size: shape === 'emoji' ? randomBetween(17, 23) : randomBetween(5.5, 8.5),
        width: shape === 'ribbon' ? randomBetween(4.5, 7.5) : randomBetween(7, 11),
        height: shape === 'ribbon' ? randomBetween(14, 20) : randomBetween(5, 8.5),
        color: palette[Math.floor(Math.random() * palette.length)],
        shape,
        emoji: shape === 'emoji' ? (i % 2 === 0 ? '🤍' : '☕') : undefined,
        rotation: randomBetween(0, Math.PI * 2),
        rotationSpeed: randomBetween(-0.11, 0.11),
        tiltAngle: randomBetween(0, Math.PI * 2),
        tiltSpeed: randomBetween(0.06, 0.14),
        wobblePhase: randomBetween(0, Math.PI * 2),
        wobbleSpeed: randomBetween(0.05, 0.1),
        opacity: 1,
        life: 0,
        maxLife: randomBetween(145, 205),
      });
    }
  }

  return particles;
}

function RsvpConfettiCanvas({
  variant,
  onDone,
}: {
  variant: ConfettiVariant;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onDoneRef.current();
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const palette = COFFEE_PALETTE[variant] ?? COFFEE_PALETTE.confirmed;

    const getViewportSize = () => ({
      w: window.innerWidth || document.documentElement.clientWidth || 390,
      h: window.innerHeight || document.documentElement.clientHeight || 844,
    });

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { w, h } = getViewportSize();
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Gentle non-rapid celebratory shimmer if user enabled reduced motion
    if (prefersReducedMotion) {
      const { w, h } = getViewportSize();
      const spots = Array.from({ length: 14 }, (_, i) => ({
        x: w * (0.1 + ((i * 19) % 80) / 100),
        y: h * (0.14 + ((i * 23) % 58) / 100),
        emoji: i % 3 === 0 ? '☕' : i % 3 === 1 ? '🤍' : '✨',
        size: 20 + (i % 3) * 4,
      }));
      let start = performance.now();
      let raf = 0;
      const drawGentle = (now: number) => {
        const progress = Math.min(1, (now - start) / 1500);
        const alpha = progress < 0.25 ? progress / 0.25 : 1 - (progress - 0.25) / 0.75;
        const size = getViewportSize();
        ctx.clearRect(0, 0, size.w, size.h);
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const s of spots) {
          ctx.font = `${s.size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
          ctx.fillText(s.emoji, s.x, s.y);
        }
        ctx.restore();
        if (progress < 1) {
          raf = window.requestAnimationFrame(drawGentle);
        } else {
          ctx.clearRect(0, 0, size.w, size.h);
          onDoneRef.current();
        }
      };
      raf = window.requestAnimationFrame(drawGentle);
      return () => {
        window.cancelAnimationFrame(raf);
        window.removeEventListener('resize', resizeCanvas);
      };
    }

    let cancelled = false;
    let rafId = 0;

    const initialSize = getViewportSize();
    const particles: ConfettiParticle[] = createBurstParticles(
      initialSize.w,
      initialSize.h,
      palette,
      'primary',
    );

    const secondaryTimerId = window.setTimeout(() => {
      if (cancelled) return;
      const s = getViewportSize();
      particles.push(...createBurstParticles(s.w, s.h, palette, 'secondary'));
    }, 240);

    let lastTime = performance.now();

    const frame = (now: number) => {
      if (cancelled) return;
      const dt = Math.min((now - lastTime) / 16.6667, 2.2);
      lastTime = now;

      const { w, h } = getViewportSize();
      ctx.clearRect(0, 0, w, h);

      let aliveCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife || p.y > h + 50) continue;

        aliveCount++;

        const dragFactor = Math.pow(p.drag, dt);
        p.vx *= dragFactor;
        p.vy = p.vy * dragFactor + p.gravity * dt;

        p.wobblePhase += p.wobbleSpeed * dt;
        p.x += (p.vx + Math.sin(p.wobblePhase) * 0.75) * dt;
        p.y += p.vy * dt;

        p.rotation += p.rotationSpeed * dt;
        p.tiltAngle += p.tiltSpeed * dt;

        const fadeStart = p.maxLife * 0.7;
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
        ctx.clearRect(0, 0, w, h);
        onDoneRef.current();
      }
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(secondaryTimerId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999]"
    />
  );
}

export function RsvpConfetti({
  trigger,
  variant = 'confirmed',
  onComplete,
}: RsvpConfettiProps) {
  const [activeRun, setActiveRun] = useState<{
    id: number;
    variant: ConfettiVariant;
  } | null>(null);

  useEffect(() => {
    if (trigger <= 0) return;
    setActiveRun({ id: trigger, variant });
  }, [trigger, variant]);

  if (!activeRun || typeof document === 'undefined') return null;

  return createPortal(
    <RsvpConfettiCanvas
      key={activeRun.id}
      variant={activeRun.variant}
      onDone={() => {
        setActiveRun((cur) => (cur?.id === activeRun.id ? null : cur));
        onComplete?.();
      }}
    />,
    document.body,
  );
}
