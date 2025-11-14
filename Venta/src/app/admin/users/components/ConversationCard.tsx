import type { Conversation } from '../types';
import { formatDate } from '../utils';

const CARD_CLASS = [
  'bg-gray-800 p-4 rounded-lg border',
  'border-gray-700',
].join(' ');
const META_CLASS = 'text-xs text-gray-400 mb-2';
const TEXT_CLASS = 'space-y-2 text-sm text-gray-300';

type ConversationCardProps = {
  conv: Conversation;
};

export function ConversationCard({ conv }: ConversationCardProps) {
  return (
    <div className={CARD_CLASS}>
      <div className={META_CLASS}>
        {formatDate(conv.timestamp)}
        {conv.detectedName && (
          <span className="ml-2 text-green-400">
            🏷️ {conv.detectedName}
          </span>
        )}
      </div>
      <div className={TEXT_CLASS}>
        <Message label="👤 Utilisateur" text={conv.prompt} />
        <Message label="🤖 IA" text={conv.response} />
      </div>
    </div>
  );
}

type MessageProps = {
  label: string;
  text: string;
};

function Message({ label, text }: MessageProps) {
  return (
    <div>
      <div className="text-blue-400 font-semibold mb-1">
        {label}
      </div>
      <p className="pl-4">{text}</p>
    </div>
  );
}

