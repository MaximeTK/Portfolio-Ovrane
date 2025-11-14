'use client';

import { InfoPanel } from './components/InfoPanel';
import { ErrorBanner, PageHeader, PageShell } from './components/PageShell';
import { UserDetailsSection } from './components/UserDetailsSection';
import { UserListSection } from './components/UserListSection';
import { useUsersData } from './useUsersData';

export default function AdminUsersPage() {
  const data = useUsersData();
  return (
    <PageShell>
      <PageHeader />
      {data.error && <ErrorBanner message={data.error} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserListSection
          users={data.users}
          selectedId={data.selectedUser?.id ?? null}
          loading={data.loading}
          onRefresh={data.fetchUsers}
          onSelect={data.fetchUserDetails}
        />
        <UserDetailsSection user={data.selectedUser} />
      </div>
      <InfoPanel />
    </PageShell>
  );
}

