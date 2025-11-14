import { ReactNode } from 'react';

type PageShellProps = {
  children: ReactNode;
};

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {children}
      </div>
    </div>
  );
}

export function PageHeader() {
  return (
    <header>
      <h1 className="text-4xl font-bold mb-2">
        👥 Administration - Profils utilisateurs
      </h1>
      <p className="text-gray-400">
        Systeme de memoire de l&apos;IA Venta
      </p>
    </header>
  );
}

type ErrorBannerProps = {
  message: string;
};

const ERROR_CLASS = [
  'bg-red-900/20 border border-red-500 text-red-200',
  'px-4 py-3 rounded',
].join(' ');

export function ErrorBanner({ message }: ErrorBannerProps) {
  return <div className={ERROR_CLASS}>❌ {message}</div>;
}

