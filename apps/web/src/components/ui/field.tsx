'use client';

import * as React from 'react';
import { Eye, EyeOff } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Mobile-first inputs. Clearly-bordered fields (rounded, subtle fill) so they read as
 * tappable inputs on any screen — no fragile "hidden underline" styling that can look
 * broken on phones. Label sits above in small slate type.
 */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-sm text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

const FIELD =
  'h-12 w-full rounded-xl border border-hairline bg-surface px-3.5 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 ' +
  'focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(FIELD, className)} {...props} />
  ),
);
Input.displayName = 'Input';

/** Password input with a show/hide eye toggle, keeping the bordered field styling. */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} className={cn('pr-12', className)} {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 transition-colors hover:text-slate-600"
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(FIELD, 'appearance-none pr-10', className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
