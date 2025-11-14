import type { UserProfile } from '../types';
import { SectionCard, StateMessage } from './SectionCard';
import { UserItem } from './UserItem';

const ACTION_CLASS =
  'px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors';
const LIST_CLASS = 'space-y-3 max-h-[600px] overflow-y-auto';
const LOADING_TEXT = 'Chargement...';
const EMPTY_TEXT = 'Aucun utilisateur enregistré';

type UserListSectionProps = {
  users: UserProfile[];
  selectedId: string | null;
  loading: boolean;
  onRefresh: () => void;
  onSelect: (userId: string) => void;
};

export function UserListSection(props: UserListSectionProps) {
  const title = `Utilisateurs (${props.users.length})`;
  return (
    <SectionCard
      title={title}
      actions={<RefreshButton onRefresh={props.onRefresh} />}
    >
      {renderListContent(props)}
    </SectionCard>
  );
}

function renderListContent({
  users,
  selectedId,
  loading,
  onSelect,
}: UserListSectionProps) {
  if (loading) return <StateMessage text={LOADING_TEXT} />;
  if (!users.length) return <StateMessage text={EMPTY_TEXT} />;
  return (
    <div className={LIST_CLASS}>
      {users.map((user) => (
        <UserItem
          key={user.id}
          user={user}
          isSelected={user.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

type RefreshButtonProps = {
  onRefresh: () => void;
};

function RefreshButton({ onRefresh }: RefreshButtonProps) {
  return (
    <button
      type="button"
      className={ACTION_CLASS}
      onClick={onRefresh}
    >
      🔄 Actualiser
    </button>
  );
}


