import { ReactNode } from 'react';

type SectionCardProps = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function SectionCard({
  title,
  actions,
  children,
}: SectionCardProps) {
  return (
    <section className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <SectionHeader title={title} actions={actions} />
      {children}
    </section>
  );
}

type SectionHeaderProps = {
  title: string;
  actions?: ReactNode;
};

function SectionHeader({ title, actions }: SectionHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {actions}
    </div>
  );
}

type StateMessageProps = {
  text: string;
};

export function StateMessage({ text }: StateMessageProps) {
  return (
    <div className="text-center py-8 text-gray-400">
      {text}
    </div>
  );
}

