/**
 * Built-in roles. The permission system (see permissions.ts) is the source of truth for
 * what a role can do; roles map to permission sets. Custom roles can be added later by
 * composing permissions without changing this enum.
 */
export const ROLES = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  INVENTORY_STAFF: 'INVENTORY_STAFF',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);

/** Platform-level (SaaS operator) role, distinct from per-business roles. */
export const PLATFORM_ADMIN = 'PLATFORM_ADMIN' as const;
