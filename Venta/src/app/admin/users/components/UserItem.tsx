import { ReactNode } from 'react';
import type { UserProfile } from '../types';
import { formatDate } from '../utils';

const CARD_BASE = [
  'w-full text-left p-4 rounded-lg border',
  'transition-all focus:outline-none',
].join(' ');
const CARD_IDLE = [
  'bg-gray-800 border-gray-700',
  'hover:border-gray-600',
].join(' ');
const CARD_ACTIVE = 'bg-blue-900/30 border-blue-500';

type UserItemProps = {
  user: UserProfile;
  isSelected: boolean;
  onSelect: (userId: string) => void;
};

export function UserItem({
  user,
  isSelected,
  onSelect,
}: UserItemProps) {
  const name = user.name ? `🏷️ ${user.name}` : '👤 Anonyme';
  const classes = `${CARD_BASE} ${
    isSelected ? CARD_ACTIVE : CARD_IDLE
  }`;
  return (
    <button
      type="button"
      onClick={() => onSelect(user.id)}
      className={classes}
    >
      <Header name={name} id={user.id} />
      <UserStat>
        📊 {user.visitCount} {suffix(user.visitCount, 'visite')}
      </UserStat>
      <UserStat>
        💬 {user.conversationCount}{' '}
        {suffix(user.conversationCount, 'conversation')}
      </UserStat>
      <UserStat>
        🕒 Dernière visite: {formatDate(user.lastVisit)}
      </UserStat>
    </button>
  );
}

type HeaderProps = {
  name: string;
  id: string;
};

function Header({ name, id }: HeaderProps) {
  return (
    <div className="flex justify-between items-start mb-2">
      <span className="font-semibold text-lg">{name}</span>
      <span className="text-sm text-gray-400 font-mono">
        {id.slice(0, 8)}...
      </span>
    </div>
  );
}

type UserStatProps = {
  children: ReactNode;
};

function UserStat({ children }: UserStatProps) {
  return <p className="text-sm text-gray-400">{children}</p>;
}

function suffix(value: number, label: string) {
  const plural = value > 1 ? 's' : '';
  return `${label}${plural}`;
}

