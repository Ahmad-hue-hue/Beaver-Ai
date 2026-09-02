import type { QueryClient } from '@tanstack/react-query';

/** Invalidate list caches after the AI agent mutates business data. */
export function invalidateAfterAgentMutations(
  qc: QueryClient,
  actions: { mutated: boolean }[],
): void {
  if (!actions.some((a) => a.mutated)) return;

  const keys = [
    'customers',
    'debts',
    'sales',
    'products',
    'purchases',
    'suppliers',
    'expenses',
    'cash',
    'analytics',
    'audit',
    'notifications',
    'pos-products',
    'pos-customers',
    'members',
    'business',
  ] as const;

  for (const key of keys) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}
