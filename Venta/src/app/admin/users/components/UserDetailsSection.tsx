import type { UserDetails, Conversation } from '../types';
import { formatDate } from '../utils';
import { SectionCard, StateMessage } from './SectionCard';
import { SummaryLine } from './SummaryLine';
import { ConversationCard } from './ConversationCard';

type UserDetailsSectionProps = {
  user: UserDetails | null;
};

export function UserDetailsSection({ user }: UserDetailsSectionProps) {
  const title = user?.name
    ? `🏷️ ${user.name}`
    : '👤 Profil utilisateur';
  if (!user) {
    return (
      <SectionCard title={title}>
        <StateMessage text="Sélectionnez un utilisateur" />
      </SectionCard>
    );
  }
  return (
    <SectionCard title={title}>
      <DetailsSummary user={user} />
      <ConversationList conversations={user.conversations} />
    </SectionCard>
  );
}

type DetailsSummaryProps = {
  user: UserDetails;
};

function DetailsSummary({ user }: DetailsSummaryProps) {
  return (
    <div className="space-y-2 text-sm mb-6">
      <SummaryLine label="ID" value={user.id} />
      <SummaryLine label="IP Hash" value={user.ipHash} mono />
      <SummaryLine
        label="Dernière visite"
        value={formatDate(user.lastVisit)}
      />
      <SummaryLine
        label="Visites"
        value={String(user.visitCount)}
      />
    </div>
  );
}

type ConversationListProps = {
  conversations: Conversation[];
};

function ConversationList({ conversations }: ConversationListProps) {
  if (!conversations.length) {
    return <StateMessage text="Aucune conversation" />;
  }
  return (
    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
      {conversations.map((conv, index) => (
        <ConversationCard
          key={`${conv.timestamp}-${index}`}
          conv={conv}
        />
      ))}
    </div>
  );
}

