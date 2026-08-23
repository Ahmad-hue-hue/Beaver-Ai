'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Button — the one strong green affordance. Rounded-xl, generous tap target (POS-friendly).
 * Variants stay restrained: a solid brand primary, a quiet ghost, and a subtle slate.
 */
const button = cva(
  'tap inline-flex items-center justify-center gap-2 rounded-xl px-6 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700',
        ghost: 'text-slate-700 hover:text-slate-900',
        subtle: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
        danger: 'text-red-600 hover:text-red-700',
      },
      size: {
        md: 'h-13',
        sm: 'h-10 min-h-0 px-4 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

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
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
