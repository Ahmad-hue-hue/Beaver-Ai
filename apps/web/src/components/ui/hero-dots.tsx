'use client';

import * as React from 'react';

type Dot = {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  driftPhase: number;
};

/**
 * Lightweight 2D-canvas replacement for the Aceternity WebGL canvas-reveal effect.
 * Brand-green dot grid on a white hero, with a center-out intro reveal, slow drift,
 * and per-dot twinkle. No WebGL / three.js — runs everywhere, including old mobile
 * WebViews. DPR-aware, pauses when offscreen, honors prefers-reduced-motion.
 */
export function HeroDots({ className }: { className?: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cell = 26;
    const color = [3, 152, 85];
    const introDuration = 1600;
    const startDelay = 250;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let dots: Dot[] = [];
    let running = false;
    let visible = true;

    const makeDots = () => {
      const next: Dot[] = [];
      const cols = Math.ceil(width / cell) + 1;
      const rows = Math.ceil(height / cell) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          next.push({
            x: c * cell + cell / 2,
            y: r * cell + cell / 2,
            radius: 1.2 + Math.random() * 1.1,
            baseAlpha: 0.14 + Math.random() * 0.34,
            twinkleSpeed: 0.4 + Math.random() * 1.1,
            twinklePhase: Math.random() * Math.PI * 2,
            driftPhase: Math.random() * Math.PI * 2,
          });
        }
      }
      dots = next;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      makeDots();
    };

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

      const elapsed = reduced ? introDuration : Math.max(0, t - startDelay);
      const progress = Math.min(1, elapsed / introDuration);
      const revealRadius = Math.max(width, height) * progress * 1.2;
      const cx = width / 2;
      const cy = height / 2;

      for (const dot of dots) {
        const dist = Math.hypot(dot.x - cx, dot.y - cy);
        const jitter = dist * 0.18;
        if (dist > revealRadius + jitter) continue;

        const fadeIn = Math.min(1, (revealRadius - dist) / (cell * 1.4) + 1);
        let alpha = dot.baseAlpha * fadeIn;
        if (!reduced) {
          const twinkle =
            0.72 + 0.28 * Math.sin(t / 1000 * dot.twinkleSpeed + dot.twinklePhase);
          alpha *= twinkle;
        }
        if (alpha < 0.004) continue;

        const drift = reduced
          ? 0
          : Math.sin(t / 2600 + dot.driftPhase) * 1.6;

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(dot.x + drift, dot.y, dot.radius, 0, Math.PI * 2);
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
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}