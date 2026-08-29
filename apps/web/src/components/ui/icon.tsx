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
  Coins01Icon,
  InvoiceIcon,
  RoboticIcon,
  ShoppingBag01Icon,
  Tick02Icon,
  TruckDeliveryIcon,
  ViewIcon,
  ViewOffSlashIcon,
  Wallet01Icon,
  DashboardSquare01Icon,
  Loading03Icon,
  Logout01Icon,
  MinusSignIcon,
  PackageIcon,
  PlusSignIcon,
  PrinterIcon,
  ReceiptIcon,
  Search01Icon,
  SendIcon,
  ShoppingCart01Icon,
  SparklesIcon,
  Delete02Icon,
  UserAdd01Icon,
  UserGroupIcon,
  Cancel01Icon,
  BellIcon,
  Settings01Icon,
  Shield01Icon,
  Activity01Icon,
  ChevronDownIcon,
  Menu01Icon,
  Globe02Icon,
  IncognitoIcon,
  Archive01Icon,
  Attachment01Icon,
  GhostIcon,
  HistoryIcon,
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
export const Coins = make(Coins01Icon, 'Coins');
export const Invoice = make(InvoiceIcon, 'Invoice');
export const ShoppingBag = make(ShoppingBag01Icon, 'ShoppingBag');
export const Truck = make(TruckDeliveryIcon, 'Truck');
export const Wallet = make(Wallet01Icon, 'Wallet');
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
export const Send = make(SendIcon, 'Send');
export const Trash2 = make(Delete02Icon, 'Trash2');
export const UserPlus = make(UserAdd01Icon, 'UserPlus');
export const Users = make(UserGroupIcon, 'Users');
export const X = make(Cancel01Icon, 'X');
export const Bell = make(BellIcon, 'Bell');
export const Settings = make(Settings01Icon, 'Settings');
export const Shield = make(Shield01Icon, 'Shield');
export const Activity = make(Activity01Icon, 'Activity');
export const ChevronDown = make(ChevronDownIcon, 'ChevronDown');
export const Menu = make(Menu01Icon, 'Menu');
export const Globe = make(Globe02Icon, 'Globe');
export const Incognito = make(IncognitoIcon, 'Incognito');
export const Archive = make(Archive01Icon, 'Archive');
export const Paperclip = make(Attachment01Icon, 'Paperclip');
export const Ghost = make(GhostIcon, 'Ghost');
export const History = make(HistoryIcon, 'History');
