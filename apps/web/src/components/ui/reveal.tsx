'use client';

import * as React from 'react';

/** Scroll-reveal wrapper. Fades/slides children in as they enter the viewport.
 *
 *  Hydration-safe: we never render animation styles into the markup, so the server
 *  and the client's first paint are identical. After mount we hide the node and use
 *  an IntersectionObserver to reveal it — all via direct DOM style mutation (no
 *  React state), so there's no hydration mismatch and no render-phase setState. */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof IntersectionObserver === 'undefined' || reduce) {
      return;
    }

    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.style.opacity = '1';
            el.style.transform = 'none';
            io.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return React.createElement(
    Tag as React.ElementType<React.HTMLProps<HTMLElement>>,
    { ref, className },
    children,
  );
}
