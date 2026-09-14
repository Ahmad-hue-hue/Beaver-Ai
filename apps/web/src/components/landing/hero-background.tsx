'use client';

import * as React from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  drift: number;
  driftSpeed: number;
  twinklePhase: number;
  twinkleSpeed: number;
  glow: boolean;
}

/**
 * Aceternity-style Particles: brand-green bokeh particles drift upward and scatter
 * away from the cursor. Larger "bloom" particles render with a soft radial gradient
 * for a natural depth-of-field effect. Confined to the hero section.
 *   - Honors prefers-reduced-motion (static frame, no pointer tracking)
 *   - Pauses offscreen via IntersectionObserver
 *   - DPR-aware, all listeners passive
 */
export function HeroBackground() {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let running = false;
    let visible = true;
    const mouse = { x: -9999, y: -9999 };

    const COUNT = 90;
    const MOUSE_RADIUS = 200;
    const MOUSE_STRENGTH = 0.025;

    const makeParticles = () => {
      const scale = Math.max(0.6, Math.min(1, Math.sqrt((width * height) / 250000)));
      const count = Math.max(40, Math.round(COUNT * scale));
      particles = Array.from({ length: count }, () => {
        const r = Math.random();
        const isGlow = r < 0.12;
        const isLarge = !isGlow && r < 0.3;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.12,
          vy: -(0.15 + Math.random() * 0.35),
          size: isGlow ? 5 + Math.random() * 5 : isLarge ? 2.5 + Math.random() * 2.5 : 1 + Math.random() * 1.8,
          alpha: isGlow ? 0.12 + Math.random() * 0.18 : isLarge ? 0.3 + Math.random() * 0.35 : 0.4 + Math.random() * 0.4,
          drift: Math.random() * Math.PI * 2,
          driftSpeed: 0.003 + Math.random() * 0.008,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.4 + Math.random() * 1.2,
          glow: isGlow,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      makeParticles();
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onPointerLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const draw = (t: number) => {
      const time = t / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (!reduced) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d2 = dx * dx + dy * dy;
          const r2 = MOUSE_RADIUS * MOUSE_RADIUS;
          if (d2 < r2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / MOUSE_RADIUS) * MOUSE_STRENGTH;
            p.vx -= (dx / d) * f;
            p.vy -= (dy / d) * f;
          }

          p.vy -= 0.0004;
          const speed = Math.hypot(p.vx, p.vy);
          const max = 1.0;
          if (speed > max) {
            p.vx = (p.vx / speed) * max;
            p.vy = (p.vy / speed) * max;
          }

          p.x += p.vx + Math.sin(time * p.driftSpeed * 40 + p.drift) * 0.12;
          p.y += p.vy;
          p.vx *= 0.992;
          p.vy *= 0.992;
        }

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const twinkle = reduced
          ? 1
          : 0.55 + 0.45 * Math.sin(time * p.twinkleSpeed + p.twinklePhase);
        const alpha = p.alpha * twinkle;
        if (alpha < 0.01) continue;

        if (p.glow) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
          g.addColorStop(0, `rgba(3, 152, 85, ${alpha * 0.9})`);
          g.addColorStop(0.35, `rgba(3, 152, 85, ${alpha * 0.4})`);
          g.addColorStop(0.7, `rgba(3, 152, 85, ${alpha * 0.1})`);
          g.addColorStop(1, 'rgba(3, 152, 85, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.size > 3) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
          g.addColorStop(0, `rgba(3, 152, 85, ${alpha})`);
          g.addColorStop(0.45, `rgba(3, 152, 85, ${alpha * 0.35})`);
          g.addColorStop(1, 'rgba(3, 152, 85, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#039855';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      if (!running) return;
      if (visible) draw(t);
      if (running) raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running) return;
      running = true;
      draw(performance.now());
      if (!reduced) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(canvas);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <canvas
      id="bvr-hero-particles"
      ref={ref}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
