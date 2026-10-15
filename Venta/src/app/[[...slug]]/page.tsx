import HomeClient from "@/features/accueil/HomeClient";

// Ce fichier capture TOUTES les routes (y compris la racine /)
// Grâce au [[...slug]] qui est un "optional catch-all segment"

// Même HTML pour tous : pré-rendu au build et servi par le CDN ; tout autre chemin l'est à sa première visite
export function generateStaticParams() {
  return [{ slug: [] }, { slug: ['connexion'] }];
}

export default function Page() {
  return <HomeClient />;
}

