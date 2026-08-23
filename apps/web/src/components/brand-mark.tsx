import Image from 'next/image';
import { cn } from '@/lib/utils';

/** The Beaver emblem logo. Sized via `size` (px, square). */
export function BrandMark({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/beaver-mark.png"
      alt="Beaver"
      width={size}
      height={size}
      className={cn('rounded-2xl', className)}
      priority
    />
  );
}
