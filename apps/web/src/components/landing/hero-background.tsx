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
}

/**
 * Aceternity-style Particles hero background: soft brand-green particles drift
 * upward with bokeh-like size variation and gentle mouse attraction. Confined to
 * the hero section so the rest of the page is completely unaffected.
 *   - Honors prefers-reduced-motion (single static frame, no pointer tracking)
 *   - Pauses offscreen via IntersectionObserver
 *   - DPR-aware canvas, all listeners passive
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

    const COUNT_BASE = 55;
    const MOUSE_RADIUS = 180;
    const MOUSE_STRENGTH = 0.012;

    const makeParticles = () => {
      const count = Math.max(30, Math.min(COUNT_BASE, Math.round((width * height) / 18000)));
      particles = Array.from({ length: count }, () => {
        const big = Math.random() < 0.15;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.15,
          vy: -(0.08 + Math.random() * 0.25),
          size: big ? 2.5 + Math.random() * 3.5 : 0.8 + Math.random() * 1.8,
          alpha: big ? 0.08 + Math.random() * 0.12 : 0.15 + Math.random() * 0.35,
          drift: Math.random() * Math.PI * 2,
          driftSpeed: 0.002 + Math.random() * 0.006,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.3 + Math.random() * 0.8,
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
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }

          p.vy -= 0.0003;
          const speed = Math.hypot(p.vx, p.vy);
          const max = 0.8;
          if (speed > max) {
            p.vx = (p.vx / speed) * max;
            p.vy = (p.vy / speed) * max;
          }

          p.x += p.vx + Math.sin(time * p.driftSpeed * 40 + p.drift) * 0.08;
          p.y += p.vy;
          p.vx *= 0.99;
          p.vy *= 0.99;
        }

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const twinkle = reduced
          ? 1
          : 0.65 + 0.35 * Math.sin(time * p.twinkleSpeed + p.twinklePhase);
        const alpha = p.alpha * twinkle;
        if (alpha < 0.005) continue;

        if (p.size > 3) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          g.addColorStop(0, `rgba(3, 152, 85, ${alpha})`);
          g.addColorStop(0.5, `rgba(3, 152, 85, ${alpha * 0.3})`);
          g.addColorStop(1, 'rgba(3, 152, 85, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
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