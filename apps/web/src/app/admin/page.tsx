'use client';

import * as React from 'react';
import { AdminShell } from './admin-shell';
import { ActivityTab } from './tab-activity';
import { BusinessesTab } from './tab-businesses';
import { OverviewTab } from './tab-overview';
import { PaymentsTab } from './tab-payments';
import { ReviewsTab } from './tab-reviews';
import { UsersTab } from './tab-users';
import type { AdminTab } from './admin-types';

/**
 * Platform-admin console — MUI dashboard (Berry/Toolpad-style) with Beaver branding.
 * Tabs: overview, reviews, businesses, users, payments (admin-recorded
 * subscriptions), activity (read-only audit). Mobile-first responsive shell.
 */
export default function AdminPage() {
  const [tab, setTab] = React.useState<AdminTab>('overview');

  return (
    <AdminShell tab={tab} onTab={setTab}>
      {tab === 'overview' && <OverviewTab />}
      {tab === 'reviews' && <ReviewsTab />}
      {tab === 'businesses' && <BusinessesTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'activity' && <ActivityTab />}
    </AdminShell>
  );
}
