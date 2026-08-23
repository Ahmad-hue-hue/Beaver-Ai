'use client';

/**
 * App icon set — Hugeicons behind a thin wrapper that mirrors the lucide-react call shape
 * (`<Package className="size-6" />`), so screens stay declarative and the underlying library
 * can change in one place. Icons inherit `currentColor`, so `text-*` classes still tint them,
 * and `size-*` classes still size them. Stroke defaults to 2 for a bold, "huge" presence.
 */
import * as React from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  ChartColumnIcon,
  RoboticIcon,
  Tick02Icon,
  ViewIcon,
  ViewOffSlashIcon,
  DashboardSquare01Icon,
  Loading03Icon,
  Logout01Icon,
  MinusSignIcon,
  PackageIcon,
  PlusSignIcon,
  PrinterIcon,
  ReceiptIcon,
  Search01Icon,
  ShoppingCart01Icon,
  SparklesIcon,
  Delete02Icon,
  UserAdd01Icon,
  UserGroupIcon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';

export interface IconProps {
  className?: string;
  size?: string | number;
  strokeWidth?: number;
}

function make(icon: IconSvgElement, displayName: string) {
  const Icon = ({ className, size, strokeWidth = 2 }: IconProps) => (
    <HugeiconsIcon icon={icon} className={className} size={size} strokeWidth={strokeWidth} />
  );
  Icon.displayName = displayName;
  return Icon;
}

export const ArrowRight = make(ArrowRight01Icon, 'ArrowRight');
export const BarChart3 = make(ChartColumnIcon, 'BarChart3');
export const Bot = make(RoboticIcon, 'Bot');
export const Check = make(Tick02Icon, 'Check');
export const Eye = make(ViewIcon, 'Eye');
export const EyeOff = make(ViewOffSlashIcon, 'EyeOff');
export const LayoutDashboard = make(DashboardSquare01Icon, 'LayoutDashboard');
export const Loader2 = make(Loading03Icon, 'Loader2');
export const LogOut = make(Logout01Icon, 'LogOut');
export const Minus = make(MinusSignIcon, 'Minus');
export const Package = make(PackageIcon, 'Package');
export const Plus = make(PlusSignIcon, 'Plus');
export const Printer = make(PrinterIcon, 'Printer');
export const Receipt = make(ReceiptIcon, 'Receipt');
export const Search = make(Search01Icon, 'Search');
export const ShoppingCart = make(ShoppingCart01Icon, 'ShoppingCart');
export const Sparkles = make(SparklesIcon, 'Sparkles');
export const Trash2 = make(Delete02Icon, 'Trash2');
export const UserPlus = make(UserAdd01Icon, 'UserPlus');
export const Users = make(UserGroupIcon, 'Users');
export const X = make(Cancel01Icon, 'X');
