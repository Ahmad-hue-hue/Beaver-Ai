'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Button — the one strong green affordance, now on DaisyUI `btn`.
 * Same API as before (variant/size/loading); radius + tap height come from the Beaver theme.
 */
const button = cva('tap btn text-base font-medium', {
  variants: {
    variant: {
      primary: 'btn-primary',
      ghost: 'btn-ghost',
      subtle: 'btn-soft',
      danger: 'btn-error btn-soft',
    },
    size: {
      md: '',
      sm: 'btn-sm min-h-0 text-sm',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="loading loading-spinner loading-sm" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
