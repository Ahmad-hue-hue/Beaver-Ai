'use client';

import * as React from 'react';
import { Eye, EyeOff } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Mobile-first inputs on DaisyUI `input`/`select`. Same exports as before
 * (Field/Input/PasswordInput/Select); border radius comes from the Beaver theme.
 * Label sits above in small type; error/hint below.
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
      <span className="mb-1.5 block text-sm font-medium text-base-content/70">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-sm text-error">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-base-content/50">{hint}</span>
      ) : null}
    </label>
  );
}

const FIELD =
  'input input-bordered h-12 w-full text-base text-base-content placeholder:text-base-content/40 ' +
  'focus:border-primary focus:outline-primary';

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
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-base-content/40 transition-colors hover:text-base-content"
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
    className={cn('select select-bordered h-12 w-full text-base text-base-content focus:border-primary focus:outline-primary', className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
