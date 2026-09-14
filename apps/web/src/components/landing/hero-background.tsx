'use client';

import { useSyncExternalStore } from 'react';
import { AnimatedBackground } from 'animated-backgrounds';

function subscribe(cb: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * Interactive particle-network hero background (animated-backgrounds).
 * The library renders one fixed full-viewport canvas behind the page, so it is
 * only visible through the transparent hero. Renders a static fallback when the
 * user has reduced motion enabled.
 */
export function HeroBackground() {
  const reduced = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (reduced) {
    return <div className="absolute inset-0 bg-slate-950" aria-hidden="true" />;
  }

  return (
    <AnimatedBackground
      animationName="particleNetwork"
      interactive
      interactionConfig={{ effect: 'attract', strength: 0.85, radius: 170, continuous: true }}
      fps={50}
      adaptivePerformance
    />
  );
}