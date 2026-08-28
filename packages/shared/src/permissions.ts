import { ROLES, type Role } from './roles.js';

/**
 * Fine-grained permissions. Guards check these (not roles directly), so custom roles are
 * possible later by composing different permission sets. Naming: `<domain>.<action>`.
 */
export const PERMISSIONS = {
  // Sales / POS
  SALES_CREATE: 'sales.create',
  SALES_VIEW: 'sales.view',
  SALES_DISCOUNT: 'sales.discount',
  SALES_CANCEL: 'sales.cancel',
  SALES_REFUND: 'sales.refund',

  // Products
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',
  PRODUCTS_SET_PRICE: 'products.set_price',

  // Inventory
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_RECEIVE: 'inventory.receive',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_COUNT: 'inventory.count',

  // Purchases / suppliers
  PURCHASES_VIEW: 'purchases.view',
  PURCHASES_MANAGE: 'purchases.manage',
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_MANAGE: 'suppliers.manage',

  // Customers / debt
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  DEBTS_VIEW: 'debts.view',
  DEBTS_MANAGE: 'debts.manage',

  // Expenses / cash
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_MANAGE: 'expenses.manage',
  CASH_MANAGE: 'cash.manage',

  // Reports
  REPORTS_VIEW_OPERATIONAL: 'reports.view_operational',
  REPORTS_VIEW_FINANCIAL: 'reports.view_financial',

  // Notifications
  NOTIFICATIONS_VIEW: 'notifications.view',

  // AI
  AI_ASSISTANT_USE: 'ai.assistant.use',
  AI_INSIGHTS_VIEW: 'ai.insights.view',

  // Administration
  EMPLOYEES_VIEW: 'employees.view',
  EMPLOYEES_MANAGE: 'employees.manage',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

const P = PERMISSIONS;

/** Default permission sets per built-in role. Owner implicitly has everything. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.OWNER]: ALL_PERMISSIONS,
  [ROLES.MANAGER]: [
    P.SALES_CREATE, P.SALES_VIEW, P.SALES_DISCOUNT, P.SALES_CANCEL, P.SALES_REFUND,
    P.PRODUCTS_VIEW, P.PRODUCTS_MANAGE, P.PRODUCTS_SET_PRICE,
    P.INVENTORY_VIEW, P.INVENTORY_RECEIVE, P.INVENTORY_ADJUST, P.INVENTORY_COUNT,
    P.PURCHASES_VIEW, P.PURCHASES_MANAGE, P.SUPPLIERS_VIEW, P.SUPPLIERS_MANAGE,
    P.CUSTOMERS_VIEW, P.CUSTOMERS_MANAGE, P.DEBTS_VIEW, P.DEBTS_MANAGE,
    P.EXPENSES_VIEW, P.EXPENSES_MANAGE, P.CASH_MANAGE,
    P.REPORTS_VIEW_OPERATIONAL, P.REPORTS_VIEW_FINANCIAL,
    P.AI_ASSISTANT_USE, P.AI_INSIGHTS_VIEW,
    P.NOTIFICATIONS_VIEW,
    P.EMPLOYEES_VIEW,
  ],
  [ROLES.CASHIER]: [
    P.SALES_CREATE, P.SALES_VIEW,
    P.PRODUCTS_VIEW,
    P.INVENTORY_VIEW,
    P.CUSTOMERS_VIEW, P.CUSTOMERS_MANAGE, P.DEBTS_VIEW,
    P.CASH_MANAGE,
    P.NOTIFICATIONS_VIEW,
  ],
  [ROLES.INVENTORY_STAFF]: [
    P.PRODUCTS_VIEW,
    P.INVENTORY_VIEW, P.INVENTORY_RECEIVE, P.INVENTORY_ADJUST, P.INVENTORY_COUNT,
    P.PURCHASES_VIEW, P.SUPPLIERS_VIEW,
    P.NOTIFICATIONS_VIEW,
  ],
};

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}
