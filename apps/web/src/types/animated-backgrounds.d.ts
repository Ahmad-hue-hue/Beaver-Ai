declare module 'animated-backgrounds' {
  import * as React from 'react';

  export type AnimationName =
    | 'starryNight'
    | 'floatingBubbles'
    | 'gradientWave'
    | 'particleNetwork'
    | 'galaxySpiral'
    | 'rainbowWaves'
    | 'geometricShapes'
    | 'fireflies'
    | 'matrixRain'
    | 'quantumField'
    | 'electricStorm'
    | 'cosmicDust'
    | 'neonPulse'
    | 'auroraBorealis'
    | 'oceanWaves'
    | 'neuralNetwork'
    | 'dnaHelix'
    | 'snowFall'
    | 'realisticRain'
    | 'realisticClouds'
    | 'fireflyForest'
    | 'autumnLeaves'
    | 'fallingFoodFiesta'
    | 'hauntedForest'
    | 'ghostlyApparitions'
    | 'spiderwebOverlay'
    | 'undeadGraveyard'
    | 'bloodRain'
    | 'creepyCrawlies';

  export type BlendMode =
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'color-burn'
    | 'hard-light'
    | 'soft-light'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity';

  export interface InteractionConfig {
    effect?: 'attract' | 'repel' | 'follow' | 'burst' | 'gravity';
    strength?: number;
    radius?: number;
    continuous?: boolean;
    multiTouch?: boolean;
  }

  export interface AnimationControls {
    isPlaying: boolean;
    speed: number;
    play: () => void;
    pause: () => void;
    reset: () => void;
    setSpeed: (speed: number) => void;
    toggle: () => void;
  }

  export interface AnimatedBackgroundProps {
    animationName: AnimationName;
    fallbackAnimation?: AnimationName;
    fps?: number;
    blendMode?: BlendMode;
    interactive?: boolean;
    interactionConfig?: InteractionConfig;
    theme?: string;
    animationControls?: AnimationControls;
    enablePerformanceMonitoring?: boolean;
    adaptivePerformance?: boolean;
    style?: React.CSSProperties;
  }

  export const AnimatedBackground: React.FC<AnimatedBackgroundProps>;
  export const LayeredBackground: React.FC<{
    layers: Array<{ animation: AnimationName; opacity?: number; blendMode?: BlendMode; speed?: number }>;
    fps?: number;
    style?: React.CSSProperties;
  }>;
  export function useAnimationControls(initial?: {
    initialSpeed?: number;
    autoPlay?: boolean;
  }): AnimationControls;
}