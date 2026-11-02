import HomeClient from "@/features/accueil/HomeClient";

// Capture toutes les routes, racine comprise, par le [[...slug]] optionnel

// Même HTML pour tous, pré-rendu au build ; un autre chemin l'est à sa visite
export function generateStaticParams() {
  return [{ slug: [] }, { slug: ['connexion'] }];
}

export default function Page() {
  return <HomeClient />;
}

