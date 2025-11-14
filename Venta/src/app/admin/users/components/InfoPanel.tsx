import { SectionCard } from './SectionCard';

const INFO_ITEMS = [
  'Les utilisateurs sont identifiés par IP + User-Agent',
  'Les adresses IP sont hashées pour la confidentialité',
  "L'historique se limite aux 100 dernières conversations",
  "Les 5 dernières conversations servent de contexte à l'IA",
];

export function InfoPanel() {
  return (
    <SectionCard title="Informations">
      <ul className="text-sm text-gray-300 space-y-1">
        {INFO_ITEMS.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </SectionCard>
  );
}

