'use client';

import * as React from 'react';
import { Eye, EyeOff } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Box-free inputs: a single hairline underline that turns green on focus — no bordered
 * boxes, in keeping with the aesthetic. Label sits above in small slate type.
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

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full border-0 border-b border-hairline bg-transparent px-0 text-lg text-slate-900 outline-none transition-colors placeholder:text-slate-300',
        'focus:border-brand-600',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

/** Password input with a show/hide eye toggle, keeping the box-free underline styling. */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-400 transition-colors hover:text-slate-600"
      >
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
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
    className={cn(
      'h-11 w-full border-0 border-b border-hairline bg-transparent px-0 text-lg text-slate-900 outline-none transition-colors focus:border-brand-600',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
