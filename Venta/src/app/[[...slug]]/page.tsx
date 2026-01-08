import HomeClient from "@/components/HomeClient";

// Ce fichier capture TOUTES les routes (y compris la racine /)
// Grâce au [[...slug]] qui est un "optional catch-all segment"
export default function Page() {
  return <HomeClient />;
}

