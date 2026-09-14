'use client';

import * as React from 'react';

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

const GREEN: [number, number, number] = [3, 152, 85];

/**
 * Interactive brand-green particle network for the hero background.
 * Lightweight, DPR-aware, honors prefers-reduced-motion, pauses offscreen, and
 * never blocks pointer/touch scrolling (all listeners are passive). The canvas
 * is bounded to the hero section, so the rest of the page is unaffected.
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
    let nodes: Node[] = [];
    let running = false;
    let visible = true;
    const pointer = { x: -1000, y: -1000, active: false };
    let burstAt = -Infinity;

    const makeNodes = () => {
      const count = Math.max(35, Math.min(130, Math.round((width * height) / 15000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 1.1 + Math.random() * 1.3,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      makeNodes();
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };
    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
      burstAt = performance.now();
    };

    const LINK_DIST = 120;
    const ATTRACT_DIST = 170;
    const BURST_DIST = 110;

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const burstLive = t - burstAt < 500;
      const burstStrength = reduced ? 0 : Math.max(0, 1 - (t - burstAt) / 500);

      for (const n of nodes) {
        if (!reduced) {
          if (pointer.active) {
            const dx = pointer.x - n.x;
            const dy = pointer.y - n.y;
            const d2 = dx * dx + dy * dy;
            const r2 = ATTRACT_DIST * ATTRACT_DIST;
            if (d2 < r2 && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const f = (1 - d / ATTRACT_DIST) * 0.02;
              n.vx += (dx / d) * f;
              n.vy += (dy / d) * f;
            }
            if (burstLive && d2 < BURST_DIST * BURST_DIST) {
              const d = Math.sqrt(d2) || 1;
              n.vx += (dx / d) * 0.9 * burstStrength;
              n.vy += (dy / d) * 0.9 * burstStrength;
            }
          }
          const speed = Math.hypot(n.vx, n.vy);
          const max = 1.4;
          if (speed > max) {
            n.vx = (n.vx / speed) * max;
            n.vy = (n.vy / speed) * max;
          }
          n.x += n.vx;
          n.y += n.vy;
          n.vx *= 0.98;
          n.vy *= 0.98;
        }
        if (n.x < -10) n.x = width + 10;
        if (n.x > width + 10) n.x = -10;
        if (n.y < -10) n.y = height + 10;
        if (n.y > height + 10) n.y = -10;

        if (!reduced) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${GREEN[0]}, ${GREEN[1]}, ${GREEN[2]}, 0.5)`;
          ctx.fill();
        }
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (!a) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          if (!b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DIST * LINK_DIST) continue;
          const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.28;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${GREEN[0]}, ${GREEN[1]}, ${GREEN[2]}, ${alpha})`;
          ctx.stroke();
        }
      }
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
    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
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
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}