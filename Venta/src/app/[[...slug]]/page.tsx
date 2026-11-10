import type { Metadata } from "next";
import HomeClient from "@/features/accueil/HomeClient";

// Capture toutes les routes, racine comprise, par le [[...slug]] optionnel

// Même HTML pour tous, pré-rendu au build ; un autre chemin l'est à sa visite
export function generateStaticParams() {
  return [{ slug: [] }, { slug: ['connexion'] }];
}

// Seul l'accueil s'indexe : tout autre chemin rend la même page
export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  return (await params).slug?.length ? { robots: { index: false } } : {};
}

export default function Page() {
  return <HomeClient />;
}

