import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1020] via-[#0b0b14] to-[#0a0a0d] text-[#e9ecff] font-sans flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl mb-8">Page non trouvée</p>
        <Link 
          href="/" 
          className="inline-block px-6 py-3 bg-gradient-to-r from-[#2dd4ff] to-[#7c4dff] text-[#0a0a0d] font-bold rounded-xl hover:opacity-90 transition-opacity"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
