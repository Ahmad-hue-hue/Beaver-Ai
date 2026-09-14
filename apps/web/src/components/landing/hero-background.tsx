'use client';

import * as React from 'react';

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

type Dot = { x: number; y: number; r: number };

type Blob = {
  hue: [number, number, number];
  alpha: number;
  size: number; // fraction of the shorter dimension
  px: number; // phase offsets for the Lissajous drift
  py: number;
  fx: number;
  fy: number;
};

const BLOBS: Blob[] = [
  { hue: [182, 244, 197], alpha: 0.55, size: 0.62, px: 1.1, py: 0.4, fx: 0.11, fy: 0.15 },
  { hue: [50, 213, 131], alpha: 0.4, size: 0.5, px: 2.6, py: 1.9, fx: 0.16, fy: 0.2 },
  { hue: [232, 250, 238], alpha: 0.7, size: 0.55, px: 4.1, py: 3.2, fx: 0.13, fy: 0.17 },
  { hue: [186, 230, 253], alpha: 0.3, size: 0.42, px: 5.5, py: 0.9, fx: 0.19, fy: 0.13 },
];

const GREEN: [number, number, number] = [3, 152, 85];

/**
 * Attractive interactive aurora hero background: soft brand-green gradient
 * blobs drift on Lissajous paths over a pastel wash and a faint dot grid,
 * a gentle node/links network drifts on top, and a soft glow follows the
 * cursor/touch. Rendered on a single canvas bounded to the hero — the light
 * palette keeps the dark hero copy fully readable. Honors
 * prefers-reduced-motion and pauses offscreen; all listeners are passive so
 * scrolling is never blocked.
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
    let dots: Dot[] = [];
    let running = false;
    let visible = true;
    const pointer = { x: -1000, y: -1000, active: false };
    let burstAt = -Infinity;

    const makeField = () => {
      const count = Math.max(25, Math.min(85, Math.round((width * height) / 22000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.1 + Math.random() * 1.2,
      }));
      const cell = 32;
      dots = [];
      for (let y = cell / 2; y < height; y += cell) {
        for (let x = cell / 2; x < width; x += cell) {
          dots.push({ x, y, r: 0.9 + Math.random() * 0.7 });
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      makeField();
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

    const LINK_DIST = 130;
    const ATTRACT_DIST = 170;
    const BURST_DIST = 120;

    const blob = (
      x: number,
      y: number,
      radius: number,
      hue: [number, number, number],
      alpha: number,
    ) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(${hue[0]}, ${hue[1]}, ${hue[2]}, ${alpha})`);
      g.addColorStop(1, `rgba(${hue[0]}, ${hue[1]}, ${hue[2]}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };

    const draw = (t: number) => {
      const time = t / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const wash = ctx.createLinearGradient(0, 0, width, height);
      wash.addColorStop(0, '#f0fdf4');
      wash.addColorStop(0.55, '#ffffff');
      wash.addColorStop(1, '#f8fafc');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);

      const dim = Math.min(width, height);
      for (const b of BLOBS) {
        const cx = width * (0.5 + 0.24 * Math.sin(time * b.fx + b.px) + 0.1 * Math.sin(time * 0.31 + b.py));
        const cy = height * (0.5 + 0.2 * Math.cos(time * b.fy + b.py) + 0.08 * Math.sin(time * 0.23 + b.px));
        blob(cx, cy, dim * b.size, b.hue, b.alpha);
      }

      ctx.fillStyle = `rgba(${GREEN[0]}, ${GREEN[1]}, ${GREEN[2]}, 0.16)`;
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const burstLive = t - burstAt < 550;
      const burstStrength = reduced ? 0 : Math.max(0, 1 - (t - burstAt) / 550);

      for (const n of nodes) {
        if (!reduced) {
          if (pointer.active) {
            const dx = pointer.x - n.x;
            const dy = pointer.y - n.y;
            const d2 = dx * dx + dy * dy;
            const r2 = ATTRACT_DIST * ATTRACT_DIST;
            if (d2 < r2 && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const f = (1 - d / ATTRACT_DIST) * 0.018;
              n.vx += (dx / d) * f;
              n.vy += (dy / d) * f;
            }
            if (burstLive && d2 < BURST_DIST * BURST_DIST) {
              const d = Math.sqrt(d2) || 1;
              n.vx += (dx / d) * 0.85 * burstStrength;
              n.vy += (dy / d) * 0.85 * burstStrength;
            }
          }
          const speed = Math.hypot(n.vx, n.vy);
          const max = 1.3;
          if (speed > max) {
            n.vx = (n.vx / speed) * max;
            n.vy = (n.vy / speed) * max;
          }
          n.x += n.vx;
          n.y += n.vy;
          n.vx *= 0.97;
          n.vy *= 0.97;
        }
        if (n.x < -10) n.x = width + 10;
        if (n.x > width + 10) n.x = -10;
        if (n.y < -10) n.y = height + 10;
        if (n.y > height + 10) n.y = -10;
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
          const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.22;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${GREEN[0]}, ${GREEN[1]}, ${GREEN[2]}, ${alpha})`;
          ctx.stroke();
        }
      }

      ctx.fillStyle = `rgba(${GREEN[0]}, ${GREEN[1]}, ${GREEN[2]}, 0.5)`;
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (pointer.active && !reduced) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 260);
        g.addColorStop(0, 'rgba(97, 214, 145, 0.28)');
        g.addColorStop(1, 'rgba(97, 214, 145, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(pointer.x - 260, pointer.y - 260, 520, 520);
        ctx.restore();
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

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-label="Beaver aurora hero" aria-hidden="true" />;
}